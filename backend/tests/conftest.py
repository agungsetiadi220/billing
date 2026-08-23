import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN = {"email": "agungsetiadi220@gmail.com", "password": "deliwifi123"}
PELANGGAN = {"email": "pelanggan@deliwifi.id", "password": "pelanggan123"}
AGEN = {"email": "agen@deliwifi.id", "password": "agen123"}


def login_session(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['email']}: {r.status_code} {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("Login response missing token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="class")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="class")
def admin_client():
    return login_session(ADMIN)


@pytest.fixture(scope="class")
def pelanggan_client():
    return login_session(PELANGGAN)


@pytest.fixture(scope="class")
def agen_client():
    return login_session(AGEN)
