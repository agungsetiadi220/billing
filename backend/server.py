import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from db import db
from payments import router as payments_router
from routes_admin import router as admin_router
from routes_portal import router as portal_router
from seed import seed_all

app = FastAPI(title="Deliwifi Billing RT/RW-Net")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(portal_router)
app.include_router(payments_router)


@app.get("/api/health")
async def health():
    return {"ok": True, "app": "Deliwifi Billing"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.invoices.create_index("order_id", unique=True)
    await db.vouchers.create_index("code", unique=True)
    await db.voucher_orders.create_index("order_id", unique=True)
    await db.customers.create_index("pppoe_username", unique=True)
    await seed_all()


@app.on_event("shutdown")
async def shutdown_db_client():
    from db import client
    client.close()
