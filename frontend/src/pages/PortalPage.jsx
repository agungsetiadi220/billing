import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wifi, CreditCard, Save, Signal } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { idr, periodeLabel, statusTagihan, fmtDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Skeleton } from "../components/ui/skeleton";

export default function PortalPage() {
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [wifiForm, setWifiForm] = useState({ ssid: "", password: "" });
  const [payTarget, setPayTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/portal/me").then((r) => {
      setData(r.data);
      if (r.data.customer) setWifiForm({ ssid: r.data.customer.wifi_ssid || "", password: "" });
    }).catch((e) => toast.error(errMsg(e)));
    api.get("/portal/invoices").then((r) => setInvoices(r.data)).catch(() => setInvoices([]));
  };
  useEffect(() => { load(); }, []);

  const bayar = async (inv) => {
    setBusy(true);
    try {
      const { data: res } = await api.post(`/payments/invoice/${inv.id}`);
      if (res.simulated) setPayTarget(inv);
      else window.location.href = res.redirect_url;
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const confirmSimPay = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/simulate/invoice/${payTarget.id}`);
      toast.success("Pembayaran simulasi berhasil. Tagihan lunas.");
      setPayTarget(null);
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const saveWifi = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ssid: wifiForm.ssid };
      if (wifiForm.password) payload.password = wifiForm.password;
      const { data: res } = await api.post("/portal/wifi", payload);
      if (res.applied) toast.success("Pengaturan WiFi berhasil diterapkan ke router");
      else toast.success(`Tersimpan. ${res.reason || "Akan diterapkan saat router terhubung."}`);
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  if (!data || invoices === null) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>;
  }

  const c = data.customer;
  if (!c) {
    return (
      <Card className="border-slate-200 max-w-lg" data-testid="portal-no-customer">
        <CardHeader>
          <CardTitle className="font-heading">Akun Belum Terhubung</CardTitle>
          <CardDescription>
            Akun Anda belum terdaftar sebagai pelanggan PPPoE. Silakan hubungi admin Deliwifi untuk aktivasi layanan.
            Anda tetap dapat membeli voucher hotspot di halaman <a href="/beli" className="text-[#EA580C] font-medium">pembelian voucher</a>.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const unpaid = invoices.filter((i) => i.status !== "paid");

  return (
    <div className="space-y-6" data-testid="customer-portal">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200" data-testid="portal-package-card">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Paket Saya</div>
            <div className="font-heading text-lg font-semibold mt-1">{c.package?.name || "-"}</div>
            <div className="text-sm text-slate-500">{c.package ? `${idr(c.package.price)}/bulan • ${c.package.speed}` : ""}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="portal-status-card">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Status Layanan</div>
            <Badge className={`mt-2 ${c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              {c.status === "active" ? "Aktif" : "Isolir"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="portal-pppoe-card">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Username PPPoE</div>
            <div className="font-mono font-semibold mt-1">{c.pppoe_username}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="portal-unpaid-card">
          <CardContent className="p-6">
            <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Tagihan Aktif</div>
            <div className="font-heading text-2xl font-bold mt-1 text-[#EA580C]">{unpaid.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tagihan">
        <TabsList>
          <TabsTrigger value="tagihan" data-testid="portal-tab-tagihan"><CreditCard className="w-4 h-4 mr-2" />Tagihan</TabsTrigger>
          <TabsTrigger value="wifi" data-testid="portal-tab-wifi"><Wifi className="w-4 h-4 mr-2" />Pengaturan WiFi</TabsTrigger>
        </TabsList>

        <TabsContent value="tagihan">
          <Card className="border-slate-200">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Tagihan</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Belum ada tagihan.</TableCell></TableRow>
                  )}
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} data-testid={`portal-invoice-${inv.invoice_no}`}>
                      <TableCell className="font-mono text-sm">{inv.invoice_no}</TableCell>
                      <TableCell>{periodeLabel(inv.period)}</TableCell>
                      <TableCell className="font-semibold">{idr(inv.amount)}</TableCell>
                      <TableCell>
                        <Badge className={statusTagihan[inv.status]?.cls || "bg-slate-100"}>
                          {statusTagihan[inv.status]?.label || inv.status}
                        </Badge>
                        {inv.paid_at && <div className="text-xs text-slate-500 mt-1">{fmtDate(inv.paid_at)} • {inv.method}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status !== "paid" && (
                          <Button size="sm" data-testid={`pay-${inv.invoice_no}`} disabled={busy}
                            className="bg-[#EA580C] hover:bg-[#C2410C]" onClick={() => bayar(inv)}>
                            Bayar Online
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wifi">
          <Card className="border-slate-200 max-w-lg" data-testid="wifi-settings-card">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2"><Signal className="w-5 h-5" /> Nama &amp; Password WiFi Router</CardTitle>
              <CardDescription>
                Perubahan langsung diterapkan ke router MikroTik Anda (interface {c.wifi_interface || "wlan1"}).
                Jika router belum terhubung ke server, perubahan disimpan dan diterapkan admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveWifi} className="space-y-4">
                <div>
                  <Label>Nama WiFi (SSID)</Label>
                  <Input data-testid="wifi-ssid-input" required maxLength={32} value={wifiForm.ssid}
                    onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })} placeholder="Contoh: Deliwifi-Budi" />
                </div>
                <div>
                  <Label>Password WiFi Baru (8-63 karakter)</Label>
                  <Input data-testid="wifi-password-input" minLength={8} maxLength={63} value={wifiForm.password}
                    onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })} placeholder="Kosongkan jika hanya ubah nama" />
                </div>
                <Button type="submit" data-testid="wifi-save-button" disabled={busy} className="bg-[#1E3A8A] hover:bg-[#1E40AF]">
                  <Save className="w-4 h-4 mr-2" /> {busy ? "Menyimpan..." : "Simpan Pengaturan WiFi"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!payTarget} onOpenChange={() => setPayTarget(null)}>
        <DialogContent data-testid="portal-simulate-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Pembayaran (Mode Simulasi)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Payment gateway Midtrans belum dikonfigurasi admin, jadi pembayaran berjalan dalam mode simulasi.
          </p>
          <div className="rounded-md bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Tagihan</span><span className="font-mono">{payTarget?.invoice_no}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span>{idr(payTarget?.amount)}</span></div>
          </div>
          <Button data-testid="portal-confirm-pay-button" onClick={confirmSimPay} disabled={busy}
            className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
            {busy ? "Memproses..." : "Bayar Sekarang (Simulasi)"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
