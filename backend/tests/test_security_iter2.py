"""Iteration 2 regression: brute-force lockout + CORS hardening."""
import uuid

import pytest
import requests

from conftest import ADMIN, BASE_URL

LEGIT_ORIGIN = "https://billing-rt-rw-1.preview.emergentagent.com"
EVIL_ORIGIN = "https://evil.example.com"


def suffix():
    return uuid.uuid4().hex[:6]


# ---------------- Brute force lockout (auth.py) ----------------
class TestBruteForceLockout:
    def test_lockout_after_5_failures_and_blocks_valid_password(self, api):
        email = f"bf_{suffix()}@qadeliwifi.com"
        pwd = "rahasia123"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "BF Test", "email": email, "password": pwd}, timeout=30)
        assert r.status_code == 200, r.text[:300]

        codes = []
        for _ in range(6):
            codes.append(api.post(f"{BASE_URL}/api/auth/login",
                                  json={"email": email, "password": "salahsalah"}, timeout=30).status_code)
        assert codes[:5] == [401] * 5, f"first 5 wrong-password attempts should be 401, got {codes}"
        assert codes[5] == 429, f"6th attempt should be 429 (locked), got {codes}"

        # even the CORRECT password must be rejected while locked
        good = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert good.status_code == 429, f"correct password during lockout should be 429, got {good.status_code}"
        assert "detail" in good.json()

    def test_successful_login_resets_counter(self, api):
        email = f"bf2_{suffix()}@qadeliwifi.com"
        pwd = "rahasia123"
        api.post(f"{BASE_URL}/api/auth/register",
                 json={"name": "BF2", "email": email, "password": pwd}, timeout=30)
        for _ in range(3):
            assert api.post(f"{BASE_URL}/api/auth/login",
                            json={"email": email, "password": "nope"}, timeout=30).status_code == 401
        ok = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert ok.status_code == 200, ok.text[:300]
        # counter reset -> 3 more failures still 401 (not locked)
        for _ in range(3):
            assert api.post(f"{BASE_URL}/api/auth/login",
                            json={"email": email, "password": "nope"}, timeout=30).status_code == 401
        again = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert again.status_code == 200, "counter should have been reset after a successful login"

    def test_demo_admin_still_logs_in(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["role"] == "admin"


# ---------------- CORS ----------------
# NOTE: the preview ingress (cloudflare/k8s edge) rewrites CORS headers to
# "access-control-allow-origin: *" for every origin, so app-level CORS policy can
# only be asserted against the FastAPI app directly (localhost:8001).
APP_URL = "http://localhost:8001"


class TestCorsAppLayer:
    def test_preflight_evil_origin_rejected(self):
        r = requests.options(
            f"{APP_URL}/api/auth/login",
            headers={"Origin": EVIL_ORIGIN,
                     "Access-Control-Request-Method": "POST",
                     "Access-Control-Request-Headers": "content-type"},
            timeout=30)
        allow = r.headers.get("access-control-allow-origin")
        assert allow not in (EVIL_ORIGIN, "*"), \
            f"evil origin allowed: allow-origin={allow} status={r.status_code}"
        assert r.status_code == 400

    def test_actual_request_evil_origin_no_cors_header(self):
        r = requests.post(f"{APP_URL}/api/auth/login",
                          json={"email": ADMIN["email"], "password": "definitelywrong"},
                          headers={"Origin": EVIL_ORIGIN}, timeout=30)
        allow = r.headers.get("access-control-allow-origin")
        assert allow not in (EVIL_ORIGIN, "*"), f"evil origin echoed on actual request: {allow}"

    def test_preflight_legit_origin_allowed(self):
        r = requests.options(
            f"{APP_URL}/api/auth/login",
            headers={"Origin": LEGIT_ORIGIN,
                     "Access-Control-Request-Method": "POST",
                     "Access-Control-Request-Headers": "content-type"},
            timeout=30)
        assert r.status_code in (200, 204), r.status_code
        assert r.headers.get("access-control-allow-origin") == LEGIT_ORIGIN
        assert r.headers.get("access-control-allow-credentials") == "true"

    def test_ingress_does_not_allow_credentialed_wildcard(self):
        """Public edge: if ACAO is '*' it must not also allow credentials (browser would block)."""
        r = requests.options(
            f"{BASE_URL}/api/auth/login",
            headers={"Origin": EVIL_ORIGIN,
                     "Access-Control-Request-Method": "POST"}, timeout=30)
        allow = r.headers.get("access-control-allow-origin")
        creds = r.headers.get("access-control-allow-credentials")
        assert not (allow == "*" and creds == "true"), \
            f"ingress preflight returns wildcard + credentials (allow={allow}, creds={creds})"
