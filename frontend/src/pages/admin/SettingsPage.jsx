import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, PlugZap, RefreshCw, Server } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Skeleton } from "../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [devices, setDevices] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    api.get("/admin/settings").then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/settings", s);
      toast.success("Pengaturan disimpan");
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const testMikrotik = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await save();
      const { data } = await api.get("/admin/mikrotik/test");
      setTestResult(data);
      if (data.applied) toast.success("Terhubung ke MikroTik");
      else toast.warning(data.reason || "Tidak terhubung");
    } catch (err) { toast.error(errMsg(err)); }
    finally { setTesting(false); }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const { data } = await api.get("/admin/genieacs/devices");
      setDevices(data.devices);
      toast.success(`${data.devices.length} perangkat ditemukan`);
    } catch (err) {
      setDevices(null);
      toast.error(errMsg(err));
    } finally { setLoadingDevices(false); }
  };

  if (!s) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}</div>;

  const setM = (patch) => setS({ ...s, midtrans: { ...s.midtrans, ...patch } });
  const setMk = (patch) => setS({ ...s, mikrotik: { ...s.mikrotik, ...patch } });
  const setG = (patch) => setS({ ...s, genieacs: { ...s.genieacs, ...patch } });

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Umum</CardTitle>
          <CardDescription>Nama brand tampil di halaman login & pembelian voucher.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label>Nama Brand</Label>
          <Input data-testid="brand-input" value={s.brand} onChange={(e) => setS({ ...s, brand: e.target.value })} />
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Payment Gateway — Midtrans</CardTitle>
          <CardDescription>
            Isi Server Key &amp; Client Key dari dashboard Midtrans. Jika kosong/nonaktif, pembayaran berjalan mode simulasi.
            Notification URL: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/api/payments/midtrans/notification</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch data-testid="midtrans-enabled-switch" checked={s.midtrans.enabled} onCheckedChange={(v) => setM({ enabled: v })} />
            <Label>Aktifkan pembayaran online Midtrans</Label>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Environment</Label>
              <Select value={s.midtrans.environment} onValueChange={(v) => setM({ environment: v })}>
                <SelectTrigger data-testid="midtrans-env-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client Key</Label>
              <Input data-testid="midtrans-client-key-input" value={s.midtrans.client_key}
                onChange={(e) => setM({ client_key: e.target.value })} placeholder="SB-Mid-client-..." />
            </div>
            <div>
              <Label>Server Key</Label>
              <Input data-testid="midtrans-server-key-input" type="password" value={s.midtrans.server_key}
                onChange={(e) => setM({ server_key: e.target.value })} placeholder="SB-Mid-server-..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Router MikroTik</CardTitle>
          <CardDescription>
            Koneksi API RouterOS (aktifkan service <b>api</b> port 8728 atau <b>api-ssl</b> port 8729 di router).
            Jika tidak terhubung, sistem berjalan mode simulasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch data-testid="mikrotik-enabled-switch" checked={s.mikrotik.enabled} onCheckedChange={(v) => setMk({ enabled: v })} />
            <Label>Aktifkan integrasi MikroTik</Label>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Host / IP Router</Label>
              <Input data-testid="mikrotik-host-input" value={s.mikrotik.host} onChange={(e) => setMk({ host: e.target.value })} placeholder="192.168.88.1" />
            </div>
            <div>
              <Label>Port API</Label>
              <Input data-testid="mikrotik-port-input" type="number" value={s.mikrotik.port} onChange={(e) => setMk({ port: e.target.value })} />
            </div>
            <div>
              <Label>Username</Label>
              <Input data-testid="mikrotik-username-input" value={s.mikrotik.username} onChange={(e) => setMk({ username: e.target.value })} />
            </div>
            <div>
              <Label>Password</Label>
              <Input data-testid="mikrotik-password-input" type="password" value={s.mikrotik.password} onChange={(e) => setMk({ password: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch data-testid="mikrotik-ssl-switch" checked={s.mikrotik.use_ssl} onCheckedChange={(v) => setMk({ use_ssl: v })} />
            <Label>Gunakan API-SSL (port 8729)</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="mikrotik-test-button" onClick={testMikrotik} disabled={testing}>
              {testing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
              Tes Koneksi
            </Button>
          </div>
          {testResult && (
            <div data-testid="mikrotik-test-result"
              className={`text-sm rounded-md p-3 ${testResult.applied ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {testResult.applied
                ? `Terhubung: ${testResult.result?.identity?.[0]?.name || "router"} (RouterOS ${testResult.result?.resource?.[0]?.version || "?"})`
                : testResult.reason}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2"><Server className="w-5 h-5" /> GenieACS (TR-069)</CardTitle>
          <CardDescription>URL NBI GenieACS, contoh: http://ip-server:7557. Digunakan untuk memantau perangkat CPE/ONU pelanggan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch data-testid="genieacs-enabled-switch" checked={s.genieacs.enabled} onCheckedChange={(v) => setG({ enabled: v })} />
            <Label>Aktifkan integrasi GenieACS</Label>
          </div>
          <div>
            <Label>URL GenieACS NBI</Label>
            <Input data-testid="genieacs-url-input" value={s.genieacs.url} onChange={(e) => setG({ url: e.target.value })} placeholder="http://103.x.x.x:7557" />
          </div>
          <Button variant="outline" data-testid="genieacs-load-button" onClick={loadDevices} disabled={loadingDevices}>
            {loadingDevices ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
            Muat Daftar Perangkat
          </Button>
          {devices && (
            <div className="rounded-md border border-slate-200 overflow-x-auto" data-testid="genieacs-devices-table">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Device ID</TableHead><TableHead>Inform Terakhir</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-slate-500 py-6">Tidak ada perangkat.</TableCell></TableRow>}
                  {devices.map((d) => (
                    <TableRow key={d._id}>
                      <TableCell className="font-mono text-xs">{d._id}</TableCell>
                      <TableCell className="text-xs">{d._lastInform ? new Date(d._lastInform).toLocaleString("id-ID") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Button data-testid="settings-save-button" onClick={save} disabled={busy} className="bg-[#1E3A8A] hover:bg-[#1E40AF]">
        <Save className="w-4 h-4 mr-2" /> {busy ? "Menyimpan..." : "Simpan Semua Pengaturan"}
      </Button>
    </div>
  );
}
