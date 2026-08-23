"""Remove QA/TEST residue created by the regression suite (safe, targeted)."""
import asyncio
import re

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")


async def main():
    client = AsyncIOMotorClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]

    # invoices from test periods (non-current, obviously synthetic)
    test_periods = {"2018-07", "2098-07", "2098-09", "2099-01", "2099-02"}
    inv_ids = []
    async for inv in db.invoices.find({"period": {"$in": list(test_periods)}}):
        inv_ids.append(str(inv["_id"]))
    r1 = await db.invoices.delete_many({"period": {"$in": list(test_periods)}})
    r2 = await db.transactions.delete_many({"ref": {"$in": inv_ids}})

    # synthetic buyers / test users
    r3 = await db.users.delete_many({"email": re.compile(r"@qadeliwifi\.com$")})
    r4 = await db.customers.delete_many({"email": re.compile(r"@qadeliwifi\.com$")})
    r5 = await db.voucher_orders.delete_many({"buyer_name": re.compile(r"^(TEST|QA)", re.I)})

    print({"invoices": r1.deleted_count, "transactions": r2.deleted_count,
           "users": r3.deleted_count, "customers": r4.deleted_count,
           "voucher_orders": r5.deleted_count})
    client.close()


asyncio.run(main())
