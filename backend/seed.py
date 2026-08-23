import os
from datetime import datetime, timezone

from auth import hash_password
from db import DEFAULT_SETTINGS, db, gen_code


async def seed_all():
    now = datetime.now(timezone.utc)

    admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if admin_email and admin_password:
        existing = await db.users.find_one({"email": admin_email})
        if not existing:
            await db.users.insert_one({
                "name": "Admin Deliwifi", "email": admin_email, "phone": "",
                "role": "admin", "password_hash": hash_password(admin_password),
                "created_at": now,
            })
        else:
            from auth import verify_password
            if not verify_password(admin_password, existing.get("password_hash", "")):
                await db.users.update_one({"email": admin_email},
                                          {"$set": {"password_hash": hash_password(admin_password)}})

    if await db.packages.count_documents({}) == 0:
        pkgs = [
            {"name": "PPPoE Rumahan 10 Mbps", "type": "pppoe", "price": 100000, "speed": "10 Mbps", "duration_label": "Per Bulan", "profile": "default", "active": True},
            {"name": "PPPoE Rumahan 20 Mbps", "type": "pppoe", "price": 150000, "speed": "20 Mbps", "duration_label": "Per Bulan", "profile": "default", "active": True},
            {"name": "PPPoE Rumahan 50 Mbps", "type": "pppoe", "price": 250000, "speed": "50 Mbps", "duration_label": "Per Bulan", "profile": "default", "active": True},
            {"name": "Hotspot 3 Jam", "type": "hotspot", "price": 2000, "speed": "5 Mbps", "duration_label": "3 Jam", "profile": "default", "active": True},
            {"name": "Hotspot 1 Hari", "type": "hotspot", "price": 5000, "speed": "5 Mbps", "duration_label": "1 Hari", "profile": "default", "active": True},
            {"name": "Hotspot 7 Hari", "type": "hotspot", "price": 20000, "speed": "10 Mbps", "duration_label": "7 Hari", "profile": "default", "active": True},
        ]
        for p in pkgs:
            p["created_at"] = now
        await db.packages.insert_many(pkgs)

    if not await db.users.find_one({"email": "agen@deliwifi.id"}):
        res = await db.users.insert_one({
            "name": "Agen Warung Demo", "email": "agen@deliwifi.id", "phone": "081200000001",
            "role": "agen", "password_hash": hash_password("agen123"), "created_at": now,
        })
        await db.agents.insert_one({
            "user_id": str(res.inserted_id), "commission_pct": 10, "saldo": 0, "created_at": now,
        })

    if not await db.users.find_one({"email": "pelanggan@deliwifi.id"}):
        pkg = await db.packages.find_one({"type": "pppoe", "name": {"$regex": "20 Mbps"}})
        res = await db.users.insert_one({
            "name": "Pelanggan Demo", "email": "pelanggan@deliwifi.id", "phone": "081200000002",
            "role": "pelanggan", "password_hash": hash_password("pelanggan123"), "created_at": now,
        })
        await db.customers.insert_one({
            "user_id": str(res.inserted_id), "name": "Pelanggan Demo",
            "email": "pelanggan@deliwifi.id", "phone": "081200000002",
            "address": "RT 01 / RW 05", "pppoe_username": "demo001", "pppoe_password": "demo001",
            "package_id": str(pkg["_id"]) if pkg else None, "status": "active",
            "wifi_interface": "wlan1", "wifi_ssid": "Deliwifi-Demo", "wifi_pass": "",
            "mikrotik_synced": False, "created_at": now,
        })
        if pkg:
            period = now.strftime("%Y-%m")
            inv_no = f"INV-{period}-DEMO"
            await db.invoices.insert_one({
                "invoice_no": inv_no, "order_id": inv_no, "customer_id": str((await db.customers.find_one({'pppoe_username': 'demo001'}))['_id']),
                "period": period, "amount": int(pkg["price"]), "status": "unpaid",
                "method": None, "paid_at": None, "created_at": now,
            })

    if await db.vouchers.count_documents({}) == 0:
        pkg = await db.packages.find_one({"type": "hotspot", "name": {"$regex": "3 Jam"}})
        agent = await db.agents.find_one({})
        if pkg:
            docs = []
            for i in range(8):
                docs.append({
                    "code": gen_code(), "package_id": str(pkg["_id"]), "batch_id": "DEMO01",
                    "status": "stok", "agent_id": None, "sold_price": None, "sold_at": None,
                    "channel": None, "created_at": now,
                })
            await db.vouchers.insert_many(docs)
            if agent:
                await db.vouchers.update_many(
                    {"batch_id": "DEMO01", "status": "stok"},
                    {"$set": {"status": "with_agent", "agent_id": str(agent["_id"])}},
                )
                await db.vouchers.update_many(
                    {"batch_id": "DEMO01"}, {"$set": {}}
                )
                sisa = await db.vouchers.find({"batch_id": "DEMO01"}).to_list(100)
                for v in sisa[5:]:
                    await db.vouchers.update_one({"_id": v["_id"]},
                                                 {"$set": {"status": "stok", "agent_id": None}})

    await db.settings.update_one({"_id": "app"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True)
