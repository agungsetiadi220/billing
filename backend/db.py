import os
import secrets
import string
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def pub(doc):
    if not doc:
        return None
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def pubs(docs):
    return [pub(d) for d in docs]


def gen_code():
    return "DLW" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


DEFAULT_SETTINGS = {
    "brand": "Deliwifi",
    "midtrans": {"enabled": False, "environment": "sandbox", "client_key": "", "server_key": ""},
    "mikrotik": {"enabled": False, "host": "", "port": 8728, "username": "", "password": "", "use_ssl": False},
    "genieacs": {"enabled": False, "url": ""},
}


async def get_settings():
    s = await db.settings.find_one({"_id": "app"})
    base = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULT_SETTINGS.items()}
    if s:
        for k, v in s.items():
            if k == "_id":
                continue
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                base[k].update(v)
            else:
                base[k] = v
    return base
