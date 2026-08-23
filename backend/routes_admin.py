import secrets
from datetime import datetime, timezone
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from auth import hash_password, require_roles
from db import db, gen_code, get_settings, pub, pubs
from mikrotik import mikrotik_op
from payments import mark_invoice_paid

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin = require_roles("admin")


def oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


# ---------- Overview / Dashboard ----------

@router.get("/overview")
async def overview(user=Depends(admin)):
    now = datetime.now(timezone.utc)
    month_key = now.strftime("%Y-%m")
    txns = await db.transactions.find({}).to_list(200000)

    def month_of(t):
        d = t.get("date")
        return d.strftime("%Y-%m") if hasattr(d, "strftime") else ""

    income_month = sum(t["amount"] for t in txns if t["type"] == "income" and month_of(t) == month_key)
    expense_month = sum(t["amount"] for t in txns if t["type"] == "expense" and month_of(t) == month_key)

    y, m = now.year, now.month
    seq = []
    for _ in range(6):
        seq.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    seq.reverse()
    bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    chart = []
    for (yy, mm) in seq:
        key = f"{yy:04d}-{mm:02d}"
        chart.append({
            "label": bulan[mm - 1],
            "pemasukan": sum(t["amount"] for t in txns if t["type"] == "income" and month_of(t) == key),
            "pengeluaran": sum(t["amount"] for t in txns if t["type"] == "expense" and month_of(t) == key),
        })

    recent = sorted(txns, key=lambda t: t.get("date") or now, reverse=True)[:8]
    return {
        "income_month": income_month,
        "expense_month": expense_month,
        "net_month": income_month - expense_month,
        "customers_total": await db.customers.count_documents({}),
        "customers_active": await db.customers.count_documents({"status": "active"}),
        "unpaid_invoices": await db.invoices.count_documents({"status": {"$in": ["unpaid", "pending"]}}),
        "vouchers_sold_month": await db.vouchers.count_documents({"status": "sold", "sold_at": {"$gte": now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)}}),
        "agents_total": await db.agents.count_documents({}),
        "chart": chart,
        "recent": pubs(recent),
    }


# ---------- Paket ----------

class PackageIn(BaseModel):
    name: str
    type: str
    price: int
    speed: str = ""
    duration_label: str = ""
    profile: str = "default"
    active: bool = True


@router.get("/packages")
async def list_packages(user=Depends(admin)):
    return pubs(await db.packages.find({}).sort("price", 1).to_list(500))


@router.post("/packages")
async def create_package(data: PackageIn, user=Depends(admin)):
    if data.type not in ("pppoe", "hotspot"):
        raise HTTPException(400, "Tipe paket harus pppoe atau hotspot")
    doc = data.model_dump()
    doc["created_at"] = datetime.now(timezone.utc)
    res = await db.packages.insert_one(doc)
    return pub(await db.packages.find_one({"_id": res.inserted_id}))


@router.put("/packages/{pkg_id}")
async def update_package(pkg_id: str, data: PackageIn, user=Depends(admin)):
    await db.packages.update_one({"_id": oid(pkg_id)}, {"$set": data.model_dump()})
    return pub(await db.packages.find_one({"_id": oid(pkg_id)}))


@router.delete("/packages/{pkg_id}")
async def delete_package(pkg_id: str, user=Depends(admin)):
    await db.packages.delete_one({"_id": oid(pkg_id)})
    return {"ok": True}


# ---------- Pelanggan PPPoE ----------

class CustomerIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""
    address: str = ""
    pppoe_username: str
    pppoe_password: str
    package_id: str
    wifi_interface: str = "wlan1"


async def customer_with_package(c):
    item = pub(c)
    pkg = await db.packages.find_one({"_id": oid(c.get("package_id"))}) if c.get("package_id") else None
    item["package_name"] = pkg["name"] if pkg else "-"
    item["package_price"] = pkg["price"] if pkg else 0
    return item


@router.get("/customers")
async def list_customers(user=Depends(admin)):
    customers = await db.customers.find({}).sort("created_at", -1).to_list(1000)
    return [await customer_with_package(c) for c in customers]


@router.post("/customers")
async def create_customer(data: CustomerIn, user=Depends(admin)):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if await db.customers.find_one({"pppoe_username": data.pppoe_username}):
        raise HTTPException(400, "Username PPPoE sudah dipakai")
    pkg = await db.packages.find_one({"_id": oid(data.package_id), "type": "pppoe"})
    if not pkg:
        raise HTTPException(404, "Paket PPPoE tidak ditemukan")
    ures = await db.users.insert_one({
        "name": data.name.strip(), "email": email, "phone": data.phone,
        "role": "pelanggan", "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc),
    })
    doc = {
        "user_id": str(ures.inserted_id), "name": data.name.strip(), "email": email,
        "phone": data.phone, "address": data.address,
        "pppoe_username": data.pppoe_username, "pppoe_password": data.pppoe_password,
        "package_id": str(pkg["_id"]), "status": "active",
        "wifi_interface": data.wifi_interface or "wlan1",
        "wifi_ssid": "", "wifi_pass": "", "mikrotik_synced": False,
        "created_at": datetime.now(timezone.utc),
    }
    cres = await db.customers.insert_one(doc)
    settings = await get_settings()
    res = await mikrotik_op(settings, lambda r: r.pppoe_add(
        data.pppoe_username, data.pppoe_password, pkg.get("profile", "default"), comment=data.name))
    if res.get("applied"):
        await db.customers.update_one({"_id": cres.inserted_id}, {"$set": {"mikrotik_synced": True}})
    item = await customer_with_package(await db.customers.find_one({"_id": cres.inserted_id}))
    item["mikrotik"] = res
    return item


@router.post("/customers/{cust_id}/isolate")
async def isolate_customer(cust_id: str, user=Depends(admin)):
    c = await db.customers.find_one({"_id": oid(cust_id)})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    await db.customers.update_one({"_id": c["_id"]}, {"$set": {"status": "isolated"}})
    settings = await get_settings()
    res = await mikrotik_op(settings, lambda r: r.pppoe_set_disabled(c["pppoe_username"], True))
    return {"ok": True, "mikrotik": res}


@router.post("/customers/{cust_id}/activate")
async def activate_customer(cust_id: str, user=Depends(admin)):
    c = await db.customers.find_one({"_id": oid(cust_id)})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    await db.customers.update_one({"_id": c["_id"]}, {"$set": {"status": "active"}})
    settings = await get_settings()
    res = await mikrotik_op(settings, lambda r: r.pppoe_set_disabled(c["pppoe_username"], False))
    return {"ok": True, "mikrotik": res}


@router.delete("/customers/{cust_id}")
async def delete_customer(cust_id: str, user=Depends(admin)):
    c = await db.customers.find_one({"_id": oid(cust_id)})
    if c:
        await db.customers.delete_one({"_id": c["_id"]})
        await db.users.delete_one({"_id": oid(c.get("user_id"))})
    return {"ok": True}


# ---------- Tagihan / Invoice ----------

class GenerateInvoiceIn(BaseModel):
    customer_id: Optional[str] = None
    period: str
    all_customers: bool = False


async def invoice_with_customer(inv):
    item = pub(inv)
    c = await db.customers.find_one({"_id": oid(inv.get("customer_id"))})
    item["customer_name"] = c["name"] if c else "-"
    return item


@router.get("/invoices")
async def list_invoices(status: Optional[str] = None, period: Optional[str] = None, user=Depends(admin)):
    q = {}
    if status and status != "semua":
        q["status"] = status
    if period:
        q["period"] = period
    invs = await db.invoices.find(q).sort("created_at", -1).to_list(2000)
    return [await invoice_with_customer(i) for i in invs]


@router.post("/invoices/generate")
async def generate_invoices(data: GenerateInvoiceIn, user=Depends(admin)):
    targets = []
    if data.all_customers:
        targets = await db.customers.find({"status": {"$in": ["active", "isolated"]}}).to_list(1000)
    elif data.customer_id:
        c = await db.customers.find_one({"_id": oid(data.customer_id)})
        if c:
            targets = [c]
    if not targets:
        raise HTTPException(400, "Tidak ada pelanggan yang dipilih")
    created = 0
    skipped = 0
    for c in targets:
        pkg = await db.packages.find_one({"_id": oid(c.get("package_id"))}) if c.get("package_id") else None
        if not pkg:
            skipped += 1
            continue
        if await db.invoices.find_one({"customer_id": str(c["_id"]), "period": data.period}):
            skipped += 1
            continue
        inv_no = f"INV-{data.period}-{secrets.token_hex(2).upper()}"
        await db.invoices.insert_one({
            "invoice_no": inv_no, "order_id": inv_no, "customer_id": str(c["_id"]),
            "period": data.period, "amount": int(pkg["price"]), "status": "unpaid",
            "method": None, "paid_at": None, "created_at": datetime.now(timezone.utc),
        })
        created += 1
    return {"created": created, "skipped": skipped}


@router.post("/invoices/{inv_id}/mark-paid")
async def mark_paid(inv_id: str, user=Depends(admin)):
    inv = await db.invoices.find_one({"_id": oid(inv_id)})
    if not inv:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    await mark_invoice_paid(inv, "Tunai")
    return {"ok": True}


@router.delete("/invoices/{inv_id}")
async def delete_invoice(inv_id: str, user=Depends(admin)):
    inv = await db.invoices.find_one({"_id": oid(inv_id)})
    if inv and inv.get("status") == "paid":
        raise HTTPException(400, "Tagihan lunas tidak dapat dihapus")
    await db.invoices.delete_one({"_id": oid(inv_id)})
    return {"ok": True}


# ---------- Voucher Hotspot ----------

class GenerateVoucherIn(BaseModel):
    package_id: str
    qty: int


@router.get("/vouchers")
async def list_vouchers(status: Optional[str] = None, user=Depends(admin)):
    q = {}
    if status and status != "semua":
        q["status"] = status
    vs = await db.vouchers.find(q).sort("created_at", -1).to_list(3000)
    out = []
    for v in vs:
        item = pub(v)
        pkg = await db.packages.find_one({"_id": oid(v.get("package_id"))})
        item["package_name"] = pkg["name"] if pkg else "-"
        item["price"] = pkg["price"] if pkg else 0
        if v.get("agent_id"):
            ag = await db.agents.find_one({"_id": oid(v["agent_id"])})
            if ag:
                au = await db.users.find_one({"_id": oid(ag["user_id"])})
                item["agent_name"] = au["name"] if au else "Agen"
        out.append(item)
    return out


@router.post("/vouchers/generate")
async def generate_vouchers(data: GenerateVoucherIn, user=Depends(admin)):
    pkg = await db.packages.find_one({"_id": oid(data.package_id), "type": "hotspot"})
    if not pkg:
        raise HTTPException(404, "Paket hotspot tidak ditemukan")
    qty = max(1, min(data.qty, 500))
    batch = secrets.token_hex(3).upper()
    now = datetime.now(timezone.utc)
    docs = [{
        "code": gen_code(), "package_id": str(pkg["_id"]), "batch_id": batch,
        "status": "stok", "agent_id": None, "sold_price": None, "sold_at": None,
        "channel": None, "created_at": now,
    } for _ in range(qty)]
    await db.vouchers.insert_many(docs)
    return {"batch_id": batch, "created": qty, "codes": [d["code"] for d in docs]}


@router.get("/voucher-batches")
async def voucher_batches(user=Depends(admin)):
    pipeline = [
        {"$group": {"_id": "$batch_id", "total": {"$sum": 1},
                    "stok": {"$sum": {"$cond": [{"$eq": ["$status", "stok"]}, 1, 0]}},
                    "with_agent": {"$sum": {"$cond": [{"$eq": ["$status", "with_agent"]}, 1, 0]}},
                    "sold": {"$sum": {"$cond": [{"$eq": ["$status", "sold"]}, 1, 0]}}}},
        {"$sort": {"_id": -1}},
        {"$limit": 50},
    ]
    return [{"batch_id": b["_id"], "total": b["total"], "stok": b["stok"],
             "with_agent": b["with_agent"], "sold": b["sold"]}
            for b in await db.vouchers.aggregate(pipeline).to_list(50)]


class AssignVoucherIn(BaseModel):
    batch_id: str
    agent_id: str


@router.post("/vouchers/assign")
async def assign_vouchers(data: AssignVoucherIn, user=Depends(admin)):
    agent = await db.agents.find_one({"_id": oid(data.agent_id)})
    if not agent:
        raise HTTPException(404, "Agen tidak ditemukan")
    res = await db.vouchers.update_many(
        {"batch_id": data.batch_id, "status": "stok"},
        {"$set": {"status": "with_agent", "agent_id": str(agent["_id"])}})
    return {"assigned": res.modified_count}


# ---------- Agen / Warung ----------

class AgentIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""
    commission_pct: float = 10


@router.get("/agents")
async def list_agents(user=Depends(admin)):
    out = []
    for ag in await db.agents.find({}).to_list(500):
        item = pub(ag)
        u = await db.users.find_one({"_id": oid(ag["user_id"])})
        item["name"] = u["name"] if u else "-"
        item["email"] = u["email"] if u else "-"
        item["phone"] = u.get("phone", "") if u else ""
        item["stock"] = await db.vouchers.count_documents({"agent_id": str(ag["_id"]), "status": "with_agent"})
        item["sold"] = await db.vouchers.count_documents({"agent_id": str(ag["_id"]), "status": "sold"})
        out.append(item)
    return out


@router.post("/agents")
async def create_agent(data: AgentIn, user=Depends(admin)):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    ures = await db.users.insert_one({
        "name": data.name.strip(), "email": email, "phone": data.phone,
        "role": "agen", "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc),
    })
    res = await db.agents.insert_one({
        "user_id": str(ures.inserted_id), "commission_pct": data.commission_pct,
        "saldo": 0, "created_at": datetime.now(timezone.utc),
    })
    return pub(await db.agents.find_one({"_id": res.inserted_id}))


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, user=Depends(admin)):
    ag = await db.agents.find_one({"_id": oid(agent_id)})
    if ag:
        await db.vouchers.update_many({"agent_id": agent_id, "status": "with_agent"},
                                      {"$set": {"status": "stok", "agent_id": None}})
        await db.agents.delete_one({"_id": ag["_id"]})
        await db.users.delete_one({"_id": oid(ag["user_id"])})
    return {"ok": True}


# ---------- Keuangan ----------

@router.get("/transactions")
async def list_transactions(month: Optional[str] = None, type: Optional[str] = None, user=Depends(admin)):
    txns = await db.transactions.find({}).sort("date", -1).to_list(20000)
    out = []
    for t in txns:
        d = t.get("date")
        if month and (not hasattr(d, "strftime") or d.strftime("%Y-%m") != month):
            continue
        if type and t["type"] != type:
            continue
        out.append(pub(t))
    return out[:2000]


class ExpenseIn(BaseModel):
    category: str
    amount: int
    description: str = ""


@router.post("/expenses")
async def create_expense(data: ExpenseIn, user=Depends(admin)):
    if data.amount <= 0:
        raise HTTPException(400, "Nominal harus lebih dari 0")
    doc = {
        "type": "expense", "category": data.category, "amount": int(data.amount),
        "description": data.description, "ref": None,
        "actor": user.get("name", "admin"), "date": datetime.now(timezone.utc),
    }
    res = await db.transactions.insert_one(doc)
    return pub(await db.transactions.find_one({"_id": res.inserted_id}))


@router.delete("/expenses/{txn_id}")
async def delete_expense(txn_id: str, user=Depends(admin)):
    await db.transactions.delete_one({"_id": oid(txn_id), "type": "expense"})
    return {"ok": True}


# ---------- Pengaturan ----------

@router.get("/settings")
async def get_app_settings(user=Depends(admin)):
    s = await get_settings()
    if s["midtrans"].get("server_key"):
        s["midtrans"]["server_key"] = "********"
    if s["mikrotik"].get("password"):
        s["mikrotik"]["password"] = "********"
    return s


def _keep_secret(new, old):
    return old if new in (None, "", "********") else new


@router.put("/settings")
async def update_settings(data: dict, user=Depends(admin)):
    s = await get_settings()
    m_in, m_old = data.get("midtrans") or {}, s.get("midtrans") or {}
    mk_in, mk_old = data.get("mikrotik") or {}, s.get("mikrotik") or {}
    g_in, g_old = data.get("genieacs") or {}, s.get("genieacs") or {}
    doc = {
        "brand": data.get("brand", s.get("brand", "Deliwifi")),
        "midtrans": {
            "enabled": bool(m_in.get("enabled", m_old.get("enabled", False))),
            "environment": m_in.get("environment", m_old.get("environment", "sandbox")),
            "client_key": _keep_secret(m_in.get("client_key"), m_old.get("client_key", "")),
            "server_key": _keep_secret(m_in.get("server_key"), m_old.get("server_key", "")),
        },
        "mikrotik": {
            "enabled": bool(mk_in.get("enabled", mk_old.get("enabled", False))),
            "host": mk_in.get("host", mk_old.get("host", "")),
            "port": int(mk_in.get("port", mk_old.get("port", 8728)) or 8728),
            "username": mk_in.get("username", mk_old.get("username", "")),
            "password": _keep_secret(mk_in.get("password"), mk_old.get("password", "")),
            "use_ssl": bool(mk_in.get("use_ssl", mk_old.get("use_ssl", False))),
        },
        "genieacs": {
            "enabled": bool(g_in.get("enabled", g_old.get("enabled", False))),
            "url": g_in.get("url", g_old.get("url", "")),
        },
    }
    await db.settings.update_one({"_id": "app"}, {"$set": doc}, upsert=True)
    return {"ok": True}


@router.get("/mikrotik/test")
async def mikrotik_test(user=Depends(admin)):
    settings = await get_settings()
    return await mikrotik_op(settings, lambda r: r.test())


@router.get("/genieacs/devices")
async def genieacs_devices(user=Depends(admin)):
    s = await get_settings()
    g = s.get("genieacs") or {}
    if not g.get("enabled") or not g.get("url"):
        raise HTTPException(400, "GenieACS belum dikonfigurasi/diaktifkan")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"{g['url'].rstrip('/')}/devices",
                                 params={"limit": 50, "projection": "_id,_deviceId,_lastInform"})
        r.raise_for_status()
        return {"devices": r.json()}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Tidak dapat terhubung ke GenieACS")
