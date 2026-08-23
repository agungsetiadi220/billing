from typing import Any

import routeros_api
from fastapi.concurrency import run_in_threadpool


class RouterUnavailable(RuntimeError):
    pass


class RouterService:
    def __init__(self, host: str, port: int, username: str, password: str,
                 use_ssl: bool = False, timeout: int = 5):
        self.host, self.port = host, port
        self.username, self.password = username, password
        self.use_ssl, self.timeout = use_ssl, timeout
        self.connection = None
        self.api = None

    def __enter__(self):
        try:
            self.connection = routeros_api.RouterOsApiPool(
                self.host,
                username=self.username,
                password=self.password,
                port=self.port,
                use_ssl=self.use_ssl,
                plaintext_login=not self.use_ssl,
                ssl_verify=False,
                socket_timeout=self.timeout,
            )
            self.api = self.connection.get_api()
            return self
        except Exception as exc:
            raise RouterUnavailable(f"Router tidak dapat dihubungi: {self.host}:{self.port}") from exc

    def __exit__(self, *_):
        if self.connection:
            self.connection.disconnect()

    @staticmethod
    def _one(resource, **filters):
        rows = resource.get(**filters)
        return rows[0] if rows else None

    def test(self) -> Any:
        identity = self.api.get_resource("/system/identity").get()
        resource = self.api.get_resource("/system/resource").get()
        return {"identity": identity, "resource": resource}

    def pppoe_add(self, name, password, profile="default", comment=""):
        r = self.api.get_resource("/ppp/secret")
        if self._one(r, name=name):
            raise ValueError("PPPoE secret sudah ada di router")
        return r.add(name=name, password=password, service="pppoe",
                     profile=profile, disabled="no", comment=comment)

    def pppoe_set_disabled(self, name, disabled):
        r = self.api.get_resource("/ppp/secret")
        row = self._one(r, name=name)
        if not row:
            raise KeyError("PPPoE secret tidak ditemukan di router")
        return r.set(id=row["id"], disabled="yes" if disabled else "no")

    def hotspot_add(self, name, password, profile="default"):
        r = self.api.get_resource("/ip/hotspot/user")
        if self._one(r, name=name):
            raise ValueError("User hotspot sudah ada di router")
        return r.add(name=name, password=password, profile=profile, disabled="no")

    def wifi_change(self, interface, ssid, password):
        if not ssid or len(ssid) > 32:
            raise ValueError("Nama WiFi (SSID) maksimal 32 karakter")
        if not password or len(password) < 8 or len(password) > 63:
            raise ValueError("Password WiFi harus 8-63 karakter")
        profile_name = "deliwifi-managed"

        wifi = self.api.get_resource("/interface/wifi")
        if self._one(wifi, name=interface):
            sec = self.api.get_resource("/interface/wifi/security")
            profile = self._one(sec, name=profile_name)
            if not profile:
                sec.add(name=profile_name,
                        **{"authentication-types": "wpa2-psk,wpa3-psk",
                           "passphrase": password, "wps": "disable"})
            else:
                sec.set(id=profile["id"], **{"passphrase": password})
            row = self._one(wifi, name=interface)
            return wifi.set(id=row["id"], **{
                "configuration.ssid": ssid,
                "security": profile_name,
                "disabled": "no",
            })

        wlan = self.api.get_resource("/interface/wireless")
        if self._one(wlan, name=interface):
            sec = self.api.get_resource("/interface/wireless/security-profiles")
            profile = self._one(sec, name=profile_name)
            attrs = {"mode": "dynamic-keys",
                     "authentication-types": "wpa2-psk",
                     "wpa2-pre-shared-key": password,
                     "unicast-ciphers": "aes-ccm",
                     "group-ciphers": "aes-ccm"}
            if profile:
                sec.set(id=profile["id"], **attrs)
            else:
                sec.add(name=profile_name, **attrs)
            row = self._one(wlan, name=interface)
            return wlan.set(id=row["id"], ssid=ssid,
                            **{"security-profile": profile_name, "disabled": "no"})
        raise ValueError(f"Interface wireless '{interface}' tidak ditemukan di router")


async def mikrotik_op(settings: dict, fn):
    m = (settings or {}).get("mikrotik") or {}
    if not m.get("enabled") or not m.get("host"):
        return {"applied": False, "reason": "MikroTik belum dikonfigurasi/diaktifkan (mode simulasi)"}
    def work():
        with RouterService(m["host"], int(m.get("port") or 8728),
                           m.get("username") or "", m.get("password") or "",
                           bool(m.get("use_ssl"))) as r:
            return fn(r)
    try:
        res = await run_in_threadpool(work)
        return {"applied": True, "result": res}
    except RouterUnavailable as e:
        return {"applied": False, "reason": str(e)}
    except Exception as e:
        return {"applied": False, "reason": f"Operasi router gagal: {e}"}
