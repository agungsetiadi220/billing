import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")
from db import db  # noqa: E402


async def main():
    # Show bcrypt hash prefixes for demo accounts
    async for u in db.users.find({}, {"email": 1, "password_hash": 1, "role": 1}):
        h = u.get("password_hash", "")
        print(f"{u.get('role'):10} {u.get('email'):35} hash_prefix={h[:4]} len={len(h)}")
    # Remove QA/synthetic users created by tests
    res = await db.users.delete_many({"email": {"$regex": "@qadeliwifi.com$"}})
    print("deleted synthetic qa users:", res.deleted_count)
    # Clear lockout counters so demo credentials are never locked
    res2 = await db.login_attempts.delete_many({})
    print("cleared login_attempts:", res2.deleted_count)
    remaining = await db.login_attempts.count_documents({})
    print("login_attempts remaining:", remaining)


asyncio.run(main())
