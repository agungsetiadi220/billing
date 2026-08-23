"""Deliwifi billing backend regression suite (public preview URL)."""
import time
import uuid

import pytest
import requests

from conftest import ADMIN, AGEN, BASE_URL, PELANGGAN, login_session


def suffix():
    return uuid.uuid4().hex[:6]


# ---------------- Health & Auth ----------------
class TestHealthAuth:
    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    @pytest.mark.parametrize("creds,role", [(ADMIN, "admin"), (PELANGGAN, "pelanggan"), (AGEN, "agen")])
    def test_login_roles(self, api, creds, role):
        r = api.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["role"] == role
        assert data["email"] == creds["email"]
        assert isinstance(data["token"], str) and len(data["token"]) > 20
        # httpOnly cookie must be set
        cookie = next((c for c in r.cookies if c.name == "access_token"), None)
        assert cookie is not None, "access_token cookie not set"
        assert "httponly" in str(r.headers.get("set-cookie", "")).lower()

    def test_login_wrong_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN["email"], "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_me_requires_auth(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "admin"
        assert "_id" not in body and "password_hash" not in body

    def test_register_and_login(self, api):
        email = f"test_{suffix()}@qadeliwifi.com"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"name": "TEST User", "email": email, "password": "rahasia123", "phone": "0812"},
                     timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["role"] == "pelanggan"
        # duplicate
        r2 = api.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "TEST User", "email": email, "password": "rahasia123"}, timeout=30)
        assert r2.status_code == 400
        # short password
        r3 = api.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "x", "email": f"t{suffix()}@qadeliwifi.com", "password": "123"}, timeout=30)
        assert r3.status_code == 400
        # new user has no customer record
        s = login_session({"email": email, "password": "rahasia123"})
        me = s.get(f"{BASE_URL}/api/portal/me", timeout=30)
        assert me.status_code == 200
        assert me.json()["customer"] is None

    def test_role_guards(self, pelanggan_client, agen_client):
        assert pelanggan_client.get(f"{BASE_URL}/api/admin/overview", timeout=30).status_code == 403
        assert pelanggan_client.get(f"{BASE_URL}/api/agent/me", timeout=30).status_code == 403
        assert agen_client.get(f"{BASE_URL}/api/portal/me", timeout=30).status_code == 403
        assert agen_client.get(f"{BASE_URL}/api/admin/customers", timeout=30).status_code == 403

    def test_invalid_token_rejected(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer abc.def.ghi"}, timeout=30)
        assert r.status_code == 401

    def test_brute_force_lockout(self, api):
        """Playbook requirement: account should lock after 5 failed attempts."""
        email = f"bf_{suffix()}@qadeliwifi.com"
        api.post(f"{BASE_URL}/api/auth/register",
                 json={"name": "BF", "email": email, "password": "rahasia123"}, timeout=30)
        codes = []
        for _ in range(6):
            codes.append(api.post(f"{BASE_URL}/api/auth/login",
                                  json={"email": email, "password": "salahsalah"}, timeout=30).status_code)
        after = api.post(f"{BASE_URL}/api/auth/login",
                         json={"email": email, "password": "rahasia123"}, timeout=30)
        assert 429 in codes or after.status_code in (423, 429), (
            f"No brute-force lockout: failed-login codes={codes}, valid login after 6 fails={after.status_code}")


# ---------------- Dashboard ----------------
class TestOverview:
    def test_overview_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/overview", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for key in ["income_month", "expense_month", "net_month", "customers_total", "customers_active",
                    "unpaid_invoices", "vouchers_sold_month", "agents_total", "chart", "recent"]:
            assert key in d, f"missing {key}"
        assert len(d["chart"]) == 6
        assert d["net_month"] == d["income_month"] - d["expense_month"]
        assert all("_id" not in t for t in d["recent"])


# ---------------- Paket ----------------
class TestPackages:
    def test_package_crud(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/packages", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 6

        payload = {"name": f"TEST Paket {suffix()}", "type": "pppoe", "price": 123000,
                   "speed": "30 Mbps", "duration_label": "Per Bulan", "profile": "default", "active": True}
        c = admin_client.post(f"{BASE_URL}/api/admin/packages", json=payload, timeout=30)
        assert c.status_code == 200, c.text[:300]
        pkg = c.json()
        assert pkg["price"] == 123000 and pkg["type"] == "pppoe" and "_id" not in pkg
        pid = pkg["id"]

        payload["price"] = 130000
        payload["active"] = False
        u = admin_client.put(f"{BASE_URL}/api/admin/packages/{pid}", json=payload, timeout=30)
        assert u.status_code == 200
        assert u.json()["price"] == 130000 and u.json()["active"] is False

        listed = admin_client.get(f"{BASE_URL}/api/admin/packages", timeout=30).json()
        found = [p for p in listed if p["id"] == pid][0]
        assert found["price"] == 130000 and found["active"] is False

        bad = admin_client.post(f"{BASE_URL}/api/admin/packages",
                                json={**payload, "type": "satelit"}, timeout=30)
        assert bad.status_code == 400

        d = admin_client.delete(f"{BASE_URL}/api/admin/packages/{pid}", timeout=30)
        assert d.status_code == 200
        listed = admin_client.get(f"{BASE_URL}/api/admin/packages", timeout=30).json()
        assert all(p["id"] != pid for p in listed)


# ---------------- Pelanggan + Tagihan + Keuangan ----------------
class TestCustomersInvoices:
    def test_customer_lifecycle_and_invoice(self, admin_client):
        pkgs = admin_client.get(f"{BASE_URL}/api/admin/packages", timeout=30).json()
        pppoe = [p for p in pkgs if p["type"] == "pppoe" and p["active"]][0]
        sfx = suffix()
        payload = {"name": f"TEST Pelanggan {sfx}", "email": f"cust_{sfx}@qadeliwifi.com",
                   "password": "pelanggan123", "phone": "0812", "address": "RT 02",
                   "pppoe_username": f"test{sfx}", "pppoe_password": "pw123",
                   "package_id": pppoe["id"], "wifi_interface": "wlan1"}
        c = admin_client.post(f"{BASE_URL}/api/admin/customers", json=payload, timeout=60)
        assert c.status_code == 200, c.text[:300]
        cust = c.json()
        cid = cust["id"]
        assert cust["status"] == "active"
        assert cust["package_name"] == pppoe["name"]
        assert cust["mikrotik"]["applied"] is False  # simulation mode expected
        assert "simulasi" in cust["mikrotik"]["reason"].lower()
        assert "pppoe_password" in cust  # note: exposed in admin payload

        # duplicate pppoe username / email rejected
        dup = admin_client.post(f"{BASE_URL}/api/admin/customers", json=payload, timeout=30)
        assert dup.status_code == 400

        # customer login account auto-created
        cs = login_session({"email": payload["email"], "password": "pelanggan123"})
        me = cs.get(f"{BASE_URL}/api/portal/me", timeout=30).json()
        assert me["customer"]["pppoe_username"] == payload["pppoe_username"]
        assert "pppoe_password" not in me["customer"] and "wifi_pass" not in me["customer"]

        # isolate / activate
        iso = admin_client.post(f"{BASE_URL}/api/admin/customers/{cid}/isolate", timeout=30)
        assert iso.status_code == 200 and iso.json()["ok"] is True
        listed = admin_client.get(f"{BASE_URL}/api/admin/customers", timeout=30).json()
        assert [x for x in listed if x["id"] == cid][0]["status"] == "isolated"
        act = admin_client.post(f"{BASE_URL}/api/admin/customers/{cid}/activate", timeout=30)
        assert act.status_code == 200
        listed = admin_client.get(f"{BASE_URL}/api/admin/customers", timeout=30).json()
        assert [x for x in listed if x["id"] == cid][0]["status"] == "active"

        # invoice generate for this customer
        period = "2099-01"
        g = admin_client.post(f"{BASE_URL}/api/admin/invoices/generate",
                              json={"customer_id": cid, "period": period}, timeout=30)
        assert g.status_code == 200 and g.json()["created"] == 1
        g2 = admin_client.post(f"{BASE_URL}/api/admin/invoices/generate",
                               json={"customer_id": cid, "period": period}, timeout=30)
        assert g2.json()["skipped"] == 1, "duplicate invoice guard failed"

        invs = admin_client.get(f"{BASE_URL}/api/admin/invoices", params={"period": period}, timeout=30).json()
        mine = [i for i in invs if i["customer_id"] == cid]
        assert len(mine) == 1
        inv = mine[0]
        assert inv["amount"] == pppoe["price"] and inv["status"] == "unpaid"
        assert inv["customer_name"] == payload["name"]

        # delete unpaid invoice works
        d = admin_client.delete(f"{BASE_URL}/api/admin/invoices/{inv['id']}", timeout=30)
        assert d.status_code == 200
        invs = admin_client.get(f"{BASE_URL}/api/admin/invoices", params={"period": period}, timeout=30).json()
        assert all(i["id"] != inv["id"] for i in invs)

        # regenerate then mark paid -> income transaction
        admin_client.post(f"{BASE_URL}/api/admin/invoices/generate",
                          json={"customer_id": cid, "period": period}, timeout=30)
        inv = [i for i in admin_client.get(f"{BASE_URL}/api/admin/invoices",
                                           params={"period": period}, timeout=30).json()
               if i["customer_id"] == cid][0]
        mp = admin_client.post(f"{BASE_URL}/api/admin/invoices/{inv['id']}/mark-paid", timeout=30)
        assert mp.status_code == 200
        after = [i for i in admin_client.get(f"{BASE_URL}/api/admin/invoices",
                                             params={"period": period}, timeout=30).json()
                 if i["id"] == inv["id"]][0]
        assert after["status"] == "paid" and after["method"] == "Tunai" and after["paid_at"]

        txns = admin_client.get(f"{BASE_URL}/api/admin/transactions", timeout=30).json()
        assert any(t["ref"] == inv["id"] and t["type"] == "income" and t["amount"] == inv["amount"]
                   for t in txns), "paid invoice did not create income transaction"

        # paid invoice cannot be deleted
        assert admin_client.delete(f"{BASE_URL}/api/admin/invoices/{inv['id']}", timeout=30).status_code == 400

        # cleanup customer
        assert admin_client.delete(f"{BASE_URL}/api/admin/customers/{cid}", timeout=30).status_code == 200
        listed = admin_client.get(f"{BASE_URL}/api/admin/customers", timeout=30).json()
        assert all(x["id"] != cid for x in listed)
        # customer login should now fail
        lr = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": payload["email"], "password": "pelanggan123"}, timeout=30)
        assert lr.status_code == 401

    def test_generate_requires_target(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/invoices/generate",
                              json={"period": "2099-02"}, timeout=30)
        assert r.status_code == 400

    def test_invoice_status_filter(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/invoices", params={"status": "unpaid"}, timeout=30)
        assert r.status_code == 200
        assert all(i["status"] == "unpaid" for i in r.json())


# ---------------- Voucher + Agen ----------------
class TestVouchersAgents:
    def test_generate_assign_and_agent_crud(self, admin_client):
        pkgs = admin_client.get(f"{BASE_URL}/api/admin/packages", timeout=30).json()
        hotspot = [p for p in pkgs if p["type"] == "hotspot"][0]
        pppoe = [p for p in pkgs if p["type"] == "pppoe"][0]

        # hotspot-only guard
        bad = admin_client.post(f"{BASE_URL}/api/admin/vouchers/generate",
                                json={"package_id": pppoe["id"], "qty": 2}, timeout=30)
        assert bad.status_code == 404

        g = admin_client.post(f"{BASE_URL}/api/admin/vouchers/generate",
                              json={"package_id": hotspot["id"], "qty": 5}, timeout=30)
        assert g.status_code == 200, g.text[:300]
        batch = g.json()
        assert batch["created"] == 5 and len(set(batch["codes"])) == 5

        batches = admin_client.get(f"{BASE_URL}/api/admin/voucher-batches", timeout=30).json()
        mine = [b for b in batches if b["batch_id"] == batch["batch_id"]]
        assert mine and mine[0]["stok"] == 5

        # new agent
        sfx = suffix()
        acreds = {"email": f"agen_{sfx}@qadeliwifi.com", "password": "agen123"}
        a = admin_client.post(f"{BASE_URL}/api/admin/agents",
                              json={"name": f"TEST Agen {sfx}", "email": acreds["email"],
                                    "password": acreds["password"], "phone": "0813",
                                    "commission_pct": 10}, timeout=30)
        assert a.status_code == 200, a.text[:300]
        aid = a.json()["id"]
        assert a.json()["saldo"] == 0

        agents = admin_client.get(f"{BASE_URL}/api/admin/agents", timeout=30).json()
        row = [x for x in agents if x["id"] == aid][0]
        assert row["email"] == acreds["email"] and row["stock"] == 0

        # assign batch
        asg = admin_client.post(f"{BASE_URL}/api/admin/vouchers/assign",
                                json={"batch_id": batch["batch_id"], "agent_id": aid}, timeout=30)
        assert asg.status_code == 200 and asg.json()["assigned"] == 5
        agents = admin_client.get(f"{BASE_URL}/api/admin/agents", timeout=30).json()
        assert [x for x in agents if x["id"] == aid][0]["stock"] == 5

        # agent sells one voucher -> commission + income
        asession = login_session(acreds)
        stock = asession.get(f"{BASE_URL}/api/agent/vouchers", params={"scope": "stok"}, timeout=30).json()
        assert len(stock) == 5
        code = stock[0]["code"]
        sell = asession.post(f"{BASE_URL}/api/agent/vouchers/{code}/sell",
                             json={"price": 3000, "buyer": "TEST Pembeli"}, timeout=30)
        assert sell.status_code == 200, sell.text[:300]
        assert sell.json()["commission"] == 300
        me = asession.get(f"{BASE_URL}/api/agent/me", timeout=30).json()
        assert me["saldo"] == 300 and me["sold"] == 1 and me["stock"] == 4
        # selling twice fails
        assert asession.post(f"{BASE_URL}/api/agent/vouchers/{code}/sell",
                             json={"price": 3000}, timeout=30).status_code == 404
        sold = asession.get(f"{BASE_URL}/api/agent/vouchers", params={"scope": "sold"}, timeout=30).json()
        assert any(v["code"] == code for v in sold)
        txns = admin_client.get(f"{BASE_URL}/api/admin/transactions", timeout=30).json()
        assert any(t["ref"] == code and t["type"] == "income" and t["amount"] == 3000 for t in txns)

        # admin voucher list & filter
        vlist = admin_client.get(f"{BASE_URL}/api/admin/vouchers", params={"status": "sold"}, timeout=30).json()
        assert all(v["status"] == "sold" for v in vlist)
        assert any(v["code"] == code for v in vlist)

        # delete agent -> stock returned to pool
        assert admin_client.delete(f"{BASE_URL}/api/admin/agents/{aid}", timeout=30).status_code == 200
        batches = admin_client.get(f"{BASE_URL}/api/admin/voucher-batches", timeout=30).json()
        b = [x for x in batches if x["batch_id"] == batch["batch_id"]][0]
        assert b["with_agent"] == 0 and b["stok"] == 4, b

    def test_assign_unknown_agent(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/vouchers/assign",
                              json={"batch_id": "NOPE", "agent_id": "64b7f9f9f9f9f9f9f9f9f9f9"}, timeout=30)
        assert r.status_code == 404


# ---------------- Keuangan ----------------
class TestFinance:
    def test_expense_crud_and_journal(self, admin_client):
        e = admin_client.post(f"{BASE_URL}/api/admin/expenses",
                              json={"category": "TEST Listrik", "amount": 55000,
                                    "description": "TEST bayar listrik"}, timeout=30)
        assert e.status_code == 200, e.text[:300]
        exp = e.json()
        assert exp["type"] == "expense" and exp["amount"] == 55000 and "_id" not in exp

        txns = admin_client.get(f"{BASE_URL}/api/admin/transactions", timeout=30).json()
        assert any(t["id"] == exp["id"] for t in txns)

        only_exp = admin_client.get(f"{BASE_URL}/api/admin/transactions",
                                    params={"type": "expense"}, timeout=30).json()
        assert all(t["type"] == "expense" for t in only_exp)

        bad = admin_client.post(f"{BASE_URL}/api/admin/expenses",
                                json={"category": "TEST", "amount": 0}, timeout=30)
        assert bad.status_code == 400

        d = admin_client.delete(f"{BASE_URL}/api/admin/expenses/{exp['id']}", timeout=30)
        assert d.status_code == 200
        txns = admin_client.get(f"{BASE_URL}/api/admin/transactions", timeout=30).json()
        assert all(t["id"] != exp["id"] for t in txns)


# ---------------- Pengaturan ----------------
class TestSettings:
    def test_settings_get_update(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/settings", timeout=30)
        assert r.status_code == 200
        s = r.json()
        assert s["brand"] and "midtrans" in s and "mikrotik" in s and "genieacs" in s
        original_brand = s["brand"]

        u = admin_client.put(f"{BASE_URL}/api/admin/settings",
                             json={**s, "brand": "TEST Brand",
                                   "genieacs": {"enabled": False, "url": "http://acs.local:7557"}}, timeout=30)
        assert u.status_code == 200
        s2 = admin_client.get(f"{BASE_URL}/api/admin/settings", timeout=30).json()
        assert s2["brand"] == "TEST Brand"
        assert s2["genieacs"]["url"] == "http://acs.local:7557"
        pub = requests.get(f"{BASE_URL}/api/public/brand", timeout=30).json()
        assert pub["brand"] == "TEST Brand"

        # restore
        admin_client.put(f"{BASE_URL}/api/admin/settings",
                         json={**s2, "brand": original_brand,
                               "genieacs": {"enabled": False, "url": ""}}, timeout=30)
        assert admin_client.get(f"{BASE_URL}/api/admin/settings",
                                timeout=30).json()["brand"] == original_brand

    def test_mikrotik_test_simulation(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/mikrotik/test", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["applied"] is False
        assert "simulasi" in r.json()["reason"].lower()

    def test_genieacs_not_configured(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/genieacs/devices", timeout=30)
        assert r.status_code == 400


# ---------------- Portal Pelanggan ----------------
class TestPortalPelanggan:
    def test_portal_data_and_payment(self, pelanggan_client, admin_client):
        me = pelanggan_client.get(f"{BASE_URL}/api/portal/me", timeout=30)
        assert me.status_code == 200, me.text[:300]
        cust = me.json()["customer"]
        assert cust and cust["pppoe_username"] == "demo001"
        assert cust["package"] and cust["package"]["type"] == "pppoe"

        # ensure an unpaid invoice exists for demo customer
        period = f"20{int(time.time()) % 90 + 10:02d}-07"  # unique-ish future period per run
        admin_client.post(f"{BASE_URL}/api/admin/invoices/generate",
                          json={"customer_id": cust["id"], "period": period}, timeout=30)
        invs = pelanggan_client.get(f"{BASE_URL}/api/portal/invoices", timeout=30).json()
        target = [i for i in invs if i["period"] == period][0]
        assert target["status"] == "unpaid"

        # pay endpoint returns simulated flag (Midtrans not configured)
        pay = pelanggan_client.post(f"{BASE_URL}/api/payments/invoice/{target['id']}", timeout=30)
        assert pay.status_code == 200, pay.text[:300]
        assert pay.json()["simulated"] is True

        sim = pelanggan_client.post(f"{BASE_URL}/api/payments/simulate/invoice/{target['id']}", timeout=30)
        assert sim.status_code == 200 and sim.json()["ok"] is True

        invs = pelanggan_client.get(f"{BASE_URL}/api/portal/invoices", timeout=30).json()
        after = [i for i in invs if i["id"] == target["id"]][0]
        assert after["status"] == "paid" and after["method"] == "Simulasi"

        txns = admin_client.get(f"{BASE_URL}/api/admin/transactions", timeout=30).json()
        assert any(t["ref"] == target["id"] and t["type"] == "income" for t in txns)

        # paying again rejected
        assert pelanggan_client.post(f"{BASE_URL}/api/payments/invoice/{target['id']}",
                                     timeout=30).status_code == 400

    def test_pay_other_customer_invoice_forbidden(self, pelanggan_client, admin_client):
        pkgs = admin_client.get(f"{BASE_URL}/api/admin/packages", timeout=30).json()
        pppoe = [p for p in pkgs if p["type"] == "pppoe" and p["active"]][0]
        sfx = suffix()
        payload = {"name": f"TEST Other {sfx}", "email": f"other_{sfx}@qadeliwifi.com",
                   "password": "pelanggan123", "pppoe_username": f"oth{sfx}",
                   "pppoe_password": "pw123", "package_id": pppoe["id"]}
        cid = admin_client.post(f"{BASE_URL}/api/admin/customers", json=payload, timeout=60).json()["id"]
        admin_client.post(f"{BASE_URL}/api/admin/invoices/generate",
                          json={"customer_id": cid, "period": "2098-09"}, timeout=30)
        inv = [i for i in admin_client.get(f"{BASE_URL}/api/admin/invoices",
                                           params={"period": "2098-09"}, timeout=30).json()
               if i["customer_id"] == cid][0]
        r = pelanggan_client.post(f"{BASE_URL}/api/payments/invoice/{inv['id']}", timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"
        r2 = pelanggan_client.post(f"{BASE_URL}/api/payments/simulate/invoice/{inv['id']}", timeout=30)
        assert r2.status_code == 403
        admin_client.delete(f"{BASE_URL}/api/admin/invoices/{inv['id']}", timeout=30)
        admin_client.delete(f"{BASE_URL}/api/admin/customers/{cid}", timeout=30)

    def test_wifi_change_and_validation(self, pelanggan_client):
        short = pelanggan_client.post(f"{BASE_URL}/api/portal/wifi",
                                      json={"ssid": "Deliwifi-QA", "password": "123"}, timeout=30)
        assert short.status_code == 400
        long_ssid = pelanggan_client.post(f"{BASE_URL}/api/portal/wifi",
                                          json={"ssid": "X" * 40, "password": "rahasia12345"}, timeout=30)
        assert long_ssid.status_code == 400

        ok = pelanggan_client.post(f"{BASE_URL}/api/portal/wifi",
                                   json={"ssid": "Deliwifi-QA", "password": "rahasia12345"}, timeout=60)
        assert ok.status_code == 200, ok.text[:300]
        body = ok.json()
        assert body["ssid"] == "Deliwifi-QA" and body["applied"] is False
        assert "simulasi" in (body.get("reason") or "").lower()

        me = pelanggan_client.get(f"{BASE_URL}/api/portal/me", timeout=30).json()["customer"]
        assert me["wifi_ssid"] == "Deliwifi-QA"

        # restore
        pelanggan_client.post(f"{BASE_URL}/api/portal/wifi",
                              json={"ssid": "Deliwifi-Demo", "password": "rahasia12345"}, timeout=60)


# ---------------- Publik / Beli Voucher ----------------
class TestPublicVoucher:
    def test_public_endpoints_and_purchase_flow(self, api, admin_client):
        b = api.get(f"{BASE_URL}/api/public/brand", timeout=30)
        assert b.status_code == 200 and b.json()["brand"]

        pk = api.get(f"{BASE_URL}/api/public/packages", params={"type": "hotspot"}, timeout=30)
        assert pk.status_code == 200
        pkgs = pk.json()
        assert pkgs and all(p["type"] == "hotspot" and p["active"] for p in pkgs)
        assert all("profile" not in p and "_id" not in p for p in pkgs)

        order = api.post(f"{BASE_URL}/api/public/voucher-purchase",
                         json={"package_id": pkgs[0]["id"], "buyer_name": "TEST Pembeli",
                               "buyer_contact": "0812"}, timeout=30)
        assert order.status_code == 200, order.text[:300]
        od = order.json()
        assert od["amount"] == pkgs[0]["price"] and od["order_id"].startswith("VCH-")

        st = api.get(f"{BASE_URL}/api/public/voucher-order/{od['order_id']}", timeout=30).json()
        assert st["status"] == "unpaid" and st["code"] is None

        pay = api.post(f"{BASE_URL}/api/payments/voucher/{od['order_id']}", timeout=30)
        assert pay.status_code == 200 and pay.json()["simulated"] is True

        sim = api.post(f"{BASE_URL}/api/payments/simulate/voucher/{od['order_id']}", timeout=30)
        assert sim.status_code == 200, sim.text[:300]
        code = sim.json()["code"]
        assert code and code.startswith("DLW")

        st = api.get(f"{BASE_URL}/api/public/voucher-order/{od['order_id']}", timeout=30).json()
        assert st["status"] == "paid" and st["code"] == code

        txns = admin_client.get(f"{BASE_URL}/api/admin/transactions", timeout=30).json()
        assert any(t["type"] == "income" and t["amount"] == od["amount"]
                   and "Voucher Hotspot Online" == t["category"] for t in txns)

        # already paid
        assert api.post(f"{BASE_URL}/api/payments/voucher/{od['order_id']}", timeout=30).status_code == 400

    def test_invalid_inputs(self, api):
        assert api.post(f"{BASE_URL}/api/public/voucher-purchase",
                        json={"package_id": "64b7f9f9f9f9f9f9f9f9f9f9",
                              "buyer_name": "X"}, timeout=30).status_code == 404
        pkgs = api.get(f"{BASE_URL}/api/public/packages", timeout=30).json()
        assert api.post(f"{BASE_URL}/api/public/voucher-purchase",
                        json={"package_id": pkgs[0]["id"], "buyer_name": "  "}, timeout=30).status_code == 400
        assert api.get(f"{BASE_URL}/api/public/voucher-order/VCH-NOPE", timeout=30).status_code == 404


# ---------------- Security / hygiene ----------------
class TestSecurity:
    def test_bcrypt_hash_format(self):
        import asyncio
        import os
        import sys
        sys.path.insert(0, "/app/backend")
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")

        async def check():
            client = AsyncIOMotorClient(env["MONGO_URL"])
            u = await client[env["DB_NAME"]].users.find_one({"email": ADMIN["email"]})
            client.close()
            return u

        u = asyncio.new_event_loop().run_until_complete(check())
        assert u is not None, "admin user not seeded"
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]

    def test_cors_credentials_headers(self):
        r = requests.options(f"{BASE_URL}/api/auth/login", headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }, timeout=30)
        allow_origin = r.headers.get("access-control-allow-origin")
        allow_creds = r.headers.get("access-control-allow-credentials")
        assert not (allow_creds == "true" and allow_origin == "https://evil.example.com"), (
            "CORS reflects arbitrary origin with credentials=true (allow_origin_regex=https?://.*)")

    def test_admin_endpoints_require_auth(self):
        for path in ["/api/admin/overview", "/api/admin/customers", "/api/admin/settings",
                     "/api/admin/transactions", "/api/admin/vouchers", "/api/admin/agents"]:
            assert requests.get(f"{BASE_URL}{path}", timeout=30).status_code == 401, path
