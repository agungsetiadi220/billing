import uuid
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import require_roles
from db import db, get_settings, pub, pubs
from mikrotik import mikrotik_op

router = APIRouter(prefix="/api", tags=["portal"])
pelanggan = require_roles("pelanggan", "admin")
agen_only = require_roles("agen")


def oid(value):
    try:
        return ObjectId(value)
    except Exception:
        return None


# ---------- Portal Pelanggan ----------

@router.get("/portal/me")
async def portal_me(user=Depends(pelanggan)):
    c = await db.customers.find_one({"user_id": user["id"]})
    if not c:
        return {"customer": None}
    item = pub(c)
    item.pop("wifi_pass", None)
    item.pop("pppoe_password", None)
    pkg = await db.packages.find_one({"_id": oid(c.get("package_id"))}) if c.get("package_id") else None
    item["package"] = pub(pkg) if pkg else None
    return {"customer": item}


@router.get("/portal/invoices")
async def portal_invoices(user=Depends(pelanggan)):
    c = await db.customers.find_one({"user_id": user["id"]})
    if not c:
        return []
    invs = await db.invoices.find({"customer_id": str(c["_id"])}).sort("created_at", -1).to_list(100)
    return pubs(invs)


class WifiIn(BaseModel):
    ssid: Optional[str] = None
    password: Optional[str] = None


@router.post("/portal/wifi")
async def portal_wifi(data: WifiIn, user=Depends(pelanggan)):
    c = await db.customers.find_one({"user_id": user["id"]})
    if not c:
        raise HTTPException(404, "Data pelanggan tidak ditemukan")
    ssid = (data.ssid or "").strip() or c.get("wifi_ssid") or "Deliwifi"
    password = data.password or c.get("wifi_pass") or ""
    if len(ssid) > 32:
        raise HTTPException(400, "Nama WiFi maksimal 32 karakter")
    if len(password) < 8 or len(password) > 63:
        raise HTTPException(400, "Password WiFi harus 8-63 karakter")
    settings = await get_settings()
    res = await mikrotik_op(settings, lambda r: r.wifi_change(
        c.get("wifi_interface", "wlan1"), ssid, password))
    await db.customers.update_one({"_id": c["_id"]},
                                  {"$set": {"wifi_ssid": ssid, "wifi_pass": password}})
    return {"ok": True, "ssid": ssid, "applied": res.get("applied"), "reason": res.get("reason")}


# ---------- Portal Agen / Warung ----------

@router.get("/agent/me")
async def agent_me(user=Depends(agen_only)):
    ag = await db.agents.find_one({"user_id": user["id"]})
    if not ag:
        raise HTTPException(404, "Profil agen tidak ditemukan")
    item = pub(ag)
    item["name"] = user.get("name")
    item["stock"] = await db.vouchers.count_documents({"agent_id": str(ag["_id"]), "status": "with_agent"})
    item["sold"] = await db.vouchers.count_documents({"agent_id": str(ag["_id"]), "status": "sold"})
    return item


@router.get("/agent/vouchers")
async def agent_vouchers(scope: str = "stok", user=Depends(agen_only)):
    ag = await db.agents.find_one({"user_id": user["id"]})
    if not ag:
        raise HTTPException(404, "Profil agen tidak ditemukan")
    status = "with_agent" if scope == "stok" else "sold"
    vs = await db.vouchers.find({"agent_id": str(ag["_id"]), "status": status}).sort("created_at", -1).to_list(1000)
    out = []
    for v in vs:
        item = pub(v)
        pkg = await db.packages.find_one({"_id": oid(v.get("package_id"))})
        item["package_name"] = pkg["name"] if pkg else "-"
        item["price"] = pkg["price"] if pkg else 0
        out.append(item)
    return out


class SellIn(BaseModel):
    price: Optional[int] = None
    buyer: str = ""


@router.post("/agent/vouchers/{code}/sell")
async def agent_sell(code: str, data: SellIn, user=Depends(agen_only)):
    ag = await db.agents.find_one({"user_id": user["id"]})
    if not ag:
        raise HTTPException(404, "Profil agen tidak ditemukan")
    v = await db.vouchers.find_one({"code": code.upper().strip(), "status": "with_agent",
                                    "agent_id": str(ag["_id"])})
    if not v:
        raise HTTPException(404, "Voucher tidak ditemukan di stok Anda")
    pkg = await db.packages.find_one({"_id": oid(v.get("package_id"))})
    price = int(data.price or (pkg["price"] if pkg else 0))
    if price <= 0:
        raise HTTPException(400, "Harga jual tidak valid")
    commission = round(price * float(ag.get("commission_pct", 0)) / 100)
    now = datetime.now(timezone.utc)
    await db.vouchers.update_one({"_id": v["_id"]}, {"$set": {
        "status": "sold", "sold_price": price, "sold_at": now,
        "buyer": data.buyer, "commission": commission, "channel": "agen",
    }})
    await db.agents.update_one({"_id": ag["_id"]}, {"$inc": {"saldo": commission}})
    await db.transactions.insert_one({
        "type": "income", "category": f"Voucher Hotspot (Agen {user.get('name', '')})",
        "amount": price, "description": f"Voucher {v['code']} terjual", "ref": v["code"],
        "date": now,
    })
    settings = await get_settings()
    await mikrotik_op(settings, lambda r: r.hotspot_add(
        v["code"], v["code"], pkg.get("profile", "default") if pkg else "default"))
    return {"ok": True, "commission": commission}


# ---------- Publik ----------

@router.get("/public/brand")
async def public_brand():
    s = await get_settings()
    return {"brand": s.get("brand", "Deliwifi")}


@router.get("/public/packages")
async def public_packages(type: str = "hotspot"):
    pkgs = await db.packages.find({"type": type, "active": True}).sort("price", 1).to_list(100)
    out = []
    for p in pkgs:
        item = pub(p)
        item.pop("profile", None)
        out.append(item)
    return out


class VoucherPurchaseIn(BaseModel):
    package_id: str
    buyer_name: str
    buyer_contact: str = ""


@router.post("/public/voucher-purchase")
async def voucher_purchase(data: VoucherPurchaseIn):
    pkg = await db.packages.find_one({"_id": oid(data.package_id), "type": "hotspot", "active": True})
    if not pkg:
        raise HTTPException(404, "Paket hotspot tidak ditemukan")
    if not data.buyer_name.strip():
        raise HTTPException(400, "Nama pembeli wajib diisi")
    order_id = "VCH-" + uuid.uuid4().hex[:10].upper()
    doc = {
        "order_id": order_id, "package_id": str(pkg["_id"]), "package_name": pkg["name"],
        "amount": int(pkg["price"]), "buyer_name": data.buyer_name.strip(),
        "buyer_contact": data.buyer_contact.strip(), "status": "unpaid",
        "created_at": datetime.now(timezone.utc),
    }
    await db.voucher_orders.insert_one(doc)
    return {"order_id": order_id, "amount": doc["amount"], "package_name": pkg["name"]}


@router.get("/public/voucher-order/{order_id}")
async def voucher_order_status(order_id: str):
    order = await db.voucher_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    return {
        "order_id": order["order_id"], "status": order["status"],
        "package_name": order["package_name"], "amount": order["amount"],
        "code": order.get("code") if order["status"] == "paid" else None,
    }
