import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from db import db

router = APIRouter(prefix="/api/auth", tags=["auth"])
JWT_ALGORITHM = "HS256"


def jwt_secret():
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    if not token and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        raise HTTPException(401, "Belum login")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi berakhir, silakan login ulang")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    try:
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Pengguna tidak ditemukan")
    user["id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


def require_roles(*roles):
    async def dep(request: Request):
        user = await get_current_user(request)
        if user.get("role") not in roles:
            raise HTTPException(403, "Akses ditolak")
        return user
    return dep


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=604800, path="/",
    )


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if len(data.password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    doc = {
        "name": data.name.strip(), "email": email, "phone": data.phone.strip(),
        "role": "pelanggan", "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    token = create_token(str(res.inserted_id), "pelanggan")
    set_auth_cookie(response, token)
    return {"id": str(res.inserted_id), "name": doc["name"], "email": email, "role": "pelanggan", "token": token}


@router.post("/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower().strip()
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"_id": email})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until:
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > now:
                raise HTTPException(429, "Terlalu banyak percobaan login gagal. Coba lagi 15 menit lagi.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        count = (attempt.get("count", 0) if attempt else 0) + 1
        update = {"count": count, "last_attempt": now}
        if count >= 5:
            update["locked_until"] = now + timedelta(minutes=15)
        await db.login_attempts.update_one({"_id": email}, {"$set": update}, upsert=True)
        raise HTTPException(401, "Email atau password salah")
    await db.login_attempts.delete_one({"_id": email})
    token = create_token(str(user["_id"]), user.get("role", "pelanggan"))
    set_auth_cookie(response, token)
    return {
        "id": str(user["_id"]), "name": user.get("name", ""), "email": email,
        "role": user.get("role", "pelanggan"), "token": token,
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    user.pop("_id", None)
    return user
