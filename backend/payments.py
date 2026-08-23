import base64
import hashlib
import hmac
from datetime import datetime, timezone

import httpx
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from auth import get_current_user
from db import db, gen_code, get_settings

router = APIRouter(prefix="/api/payments", tags=["payments"])


async def midtrans_cfg():
    s = await get_settings()
    m = s.get("midtrans") or {}
    if m.get("enabled") and m.get("server_key") and m.get("client_key"):
        return m
    return None


def snap_base(env):
    return "https://app.sandbox.midtrans.com" if env == "sandbox" else "https://app.midtrans.com"


async def create_snap(cfg, order_id, amount, name, email):
    auth = base64.b64encode(f'{cfg["server_key"]}:'.encode()).decode()
    payload = {
        "transaction_details": {"order_id": order_id, "gross_amount": int(amount)},
        "customer_details": {"first_name": name or "Pelanggan", "email": email or ""},
        "expiry": {"unit": "hours", "duration": 24},
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{snap_base(cfg.get('environment', 'sandbox'))}/snap/v1/transactions",
            json=payload,
            headers={"Accept": "application/json", "Content-Type": "application/json",
                     "Authorization": f"Basic {auth}"},
        )
    if r.status_code not in (200, 201):
        raise HTTPException(502, "Gagal membuat transaksi Midtrans")
    return r.json()


async def record_income(category, amount, description, ref):
    await db.transactions.insert_one({
        "type": "income", "category": category, "amount": int(amount),
        "description": description, "ref": ref, "date": datetime.now(timezone.utc),
    })


async def mark_invoice_paid(inv, method):
    if inv.get("status") == "paid":
        return
    await db.invoices.update_one(
        {"_id": inv["_id"]},
        {"$set": {"status": "paid", "method": method, "paid_at": datetime.now(timezone.utc)}})
    await record_income("Tagihan PPPoE", inv["amount"],
                        f"Pembayaran {inv['invoice_no']} ({method})", str(inv["_id"]))
    try:
        cust = await db.customers.find_one({"_id": ObjectId(inv["customer_id"])})
    except Exception:
        cust = None
    if cust and cust.get("status") != "active":
        await db.customers.update_one({"_id": cust["_id"]}, {"$set": {"status": "active"}})
        from mikrotik import mikrotik_op
        s = await get_settings()
        await mikrotik_op(s, lambda r: r.pppoe_set_disabled(cust["pppoe_username"], False))


async def allocate_voucher_code(package_id, amount):
    now = datetime.now(timezone.utc)
    v = await db.vouchers.find_one({"package_id": package_id, "status": "stok"})
    if v:
        await db.vouchers.update_one(
            {"_id": v["_id"]},
            {"$set": {"status": "sold", "sold_price": int(amount), "sold_at": now, "channel": "online"}})
        return v["code"]
    code = gen_code()
    await db.vouchers.insert_one({
        "code": code, "package_id": package_id, "batch_id": "ONLINE",
        "status": "sold", "agent_id": None, "sold_price": int(amount),
        "sold_at": now, "channel": "online", "created_at": now,
    })
    return code


async def mark_voucher_order_paid(order, method):
    if order.get("status") == "paid":
        return
    code = await allocate_voucher_code(order["package_id"], order["amount"])
    await db.voucher_orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": "paid", "method": method, "code": code,
                  "paid_at": datetime.now(timezone.utc)}})
    await record_income("Voucher Hotspot Online", order["amount"],
                        f"Penjualan voucher online {order['order_id']} ({method})", str(order["_id"]))


@router.post("/invoice/{invoice_id}")
async def pay_invoice(invoice_id: str, request: Request):
    user = await get_current_user(request)
    try:
        inv = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    except Exception:
        inv = None
    if not inv:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if inv.get("status") == "paid":
        raise HTTPException(400, "Tagihan sudah lunas")
    cust = None
    try:
        cust = await db.customers.find_one({"_id": ObjectId(inv["customer_id"])})
    except Exception:
        cust = None
    if user["role"] != "admin":
        if not cust or cust.get("user_id") != user["id"]:
            raise HTTPException(403, "Akses ditolak")
    cfg = await midtrans_cfg()
    if not cfg:
        return {"simulated": True, "invoice_id": invoice_id, "amount": inv["amount"]}
    attempt = int(inv.get("attempts", 0)) + 1
    morder = f"{inv['order_id']}-{attempt}"
    res = await create_snap(cfg, morder, inv["amount"],
                            cust.get("name") if cust else "Pelanggan", user.get("email", ""))
    await db.invoices.update_one(
        {"_id": inv["_id"]},
        {"$set": {"midtrans_order": morder, "status": "pending", "attempts": attempt,
                  "snap_token": res["token"], "redirect_url": res["redirect_url"]}})
    return {"simulated": False, "token": res["token"], "redirect_url": res["redirect_url"],
            "client_key": cfg["client_key"], "environment": cfg.get("environment", "sandbox")}


@router.post("/simulate/invoice/{invoice_id}")
async def simulate_invoice(invoice_id: str, request: Request):
    if await midtrans_cfg():
        raise HTTPException(400, "Midtrans aktif, simulasi dimatikan")
    user = await get_current_user(request)
    try:
        inv = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    except Exception:
        inv = None
    if not inv:
        raise HTTPException(404, "Tagihan tidak ditemukan")
    if user["role"] != "admin":
        try:
            cust = await db.customers.find_one({"_id": ObjectId(inv["customer_id"])})
        except Exception:
            cust = None
        if not cust or cust.get("user_id") != user["id"]:
            raise HTTPException(403, "Akses ditolak")
    await mark_invoice_paid(inv, "Simulasi")
    return {"ok": True, "simulated": True}


@router.post("/voucher/{order_id}")
async def pay_voucher_order(order_id: str):
    order = await db.voucher_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    if order.get("status") == "paid":
        raise HTTPException(400, "Order sudah dibayar")
    cfg = await midtrans_cfg()
    if not cfg:
        return {"simulated": True, "order_id": order_id, "amount": order["amount"]}
    attempt = int(order.get("attempts", 0)) + 1
    morder = f"{order_id}-{attempt}"
    res = await create_snap(cfg, morder, order["amount"], order.get("buyer_name", "Pembeli"), "")
    await db.voucher_orders.update_one(
        {"_id": order["_id"]},
        {"$set": {"midtrans_order": morder, "status": "pending", "attempts": attempt,
                  "snap_token": res["token"], "redirect_url": res["redirect_url"]}})
    return {"simulated": False, "token": res["token"], "redirect_url": res["redirect_url"],
            "client_key": cfg["client_key"], "environment": cfg.get("environment", "sandbox")}


@router.post("/simulate/voucher/{order_id}")
async def simulate_voucher(order_id: str):
    if await midtrans_cfg():
        raise HTTPException(400, "Midtrans aktif, simulasi dimatikan")
    order = await db.voucher_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    await mark_voucher_order_paid(order, "Simulasi")
    updated = await db.voucher_orders.find_one({"order_id": order_id})
    return {"ok": True, "simulated": True, "code": updated.get("code")}


@router.post("/midtrans/notification")
async def midtrans_notification(request: Request):
    body = await request.json()
    order_id = str(body.get("order_id", ""))
    inv = await db.invoices.find_one({"midtrans_order": order_id})
    kind = "invoice"
    if not inv:
        inv = await db.voucher_orders.find_one({"midtrans_order": order_id})
        kind = "voucher"
    if not inv:
        return {"ok": True}
    cfg = await midtrans_cfg()
    if not cfg:
        return JSONResponse({"ok": False}, 503)
    raw = order_id + str(body.get("status_code", "")) + str(body.get("gross_amount", "")) + cfg["server_key"]
    expected = hashlib.sha512(raw.encode()).hexdigest()
    if not hmac.compare_digest(expected, str(body.get("signature_key", ""))):
        raise HTTPException(403, "Signature tidak valid")
    status = str(body.get("transaction_status", "")).lower()
    fraud = str(body.get("fraud_status", "")).lower()
    if status in {"settlement", "capture"} and (not fraud or fraud == "accept"):
        if kind == "invoice":
            await mark_invoice_paid(inv, "Midtrans")
        else:
            await mark_voucher_order_paid(inv, "Midtrans")
    elif status in {"deny", "cancel", "expire", "failure"}:
        coll = db.invoices if kind == "invoice" else db.voucher_orders
        if inv.get("status") != "paid":
            await coll.update_one({"_id": inv["_id"]}, {"$set": {"status": "unpaid"}})
    return {"ok": True}
