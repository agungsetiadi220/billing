import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Wifi, Ticket, Copy, CheckCircle2 } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { idr } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";

export default function BeliVoucherPage() {
  const [packages, setPackages] = useState(null);
  const [brand, setBrand] = useState("Deliwifi");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ buyer_name: "", buyer_contact: "" });
  const [order, setOrder] = useState(null);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/public/packages?type=hotspot").then((r) => setPackages(r.data)).catch(() => setPackages([]));
    api.get("/public/brand").then((r) => setBrand(r.data.brand)).catch(() => {});
  }, []);

  const createOrder = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/public/voucher-purchase", {
        package_id: selected.id, ...form,
      });
      const pay = await api.post(`/payments/voucher/${data.order_id}`);
      if (pay.data.simulated) {
        setOrder(data);
      } else {
        window.location.href = pay.data.redirect_url;
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const paySimulated = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/payments/simulate/voucher/${order.order_id}`);
      setCode(data.code);
      setOrder(null);
      setSelected(null);
      toast.success("Pembayaran simulasi berhasil");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="beli-voucher-page">
      <header className="bg-[#1E3A8A] text-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#EA580C] grid place-items-center">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="font-heading font-semibold">{brand}</div>
              <div className="text-xs text-blue-200 uppercase tracking-widest">Voucher Hotspot</div>
            </div>
          </div>
          <Link to="/login" data-testid="login-link" className="text-sm font-medium text-blue-100 hover:text-white transition-colors">
            Masuk
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight mb-2">Beli Voucher Hotspot Online</h1>
        <p className="text-slate-500 mb-8">Pilih paket, bayar online, dan langsung dapatkan kode voucher.</p>

        {code ? (
          <Card data-testid="voucher-success-card" className="max-w-md border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" /> Voucher Berhasil Dibeli
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1">Kode Voucher</div>
              <div className="flex items-center gap-3">
                <code data-testid="voucher-code-text" className="text-2xl font-mono font-bold text-[#1E3A8A]">{code}</code>
                <Button size="sm" variant="outline" data-testid="copy-code-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                      toast.success("Kode disalin");
                    } catch {
                      toast.error(`Gagal menyalin otomatis. Salin manual: ${code}`);
                    }
                  }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-slate-500 mt-4">Masukkan kode ini di halaman login hotspot {brand}.</p>
              <Button className="mt-6 bg-[#1E3A8A] hover:bg-[#1E40AF]" data-testid="buy-again-button" onClick={() => setCode(null)}>
                Beli Lagi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages === null
              ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)
              : packages.map((p) => (
                  <Card key={p.id} data-testid={`package-card-${p.id}`}
                    className="hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200 cursor-pointer border-slate-200"
                    onClick={() => setSelected(p)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Ticket className="w-6 h-6 text-[#EA580C]" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.duration_label}</span>
                      </div>
                      <CardTitle className="font-heading text-lg">{p.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-[#1E3A8A]">{idr(p.price)}</div>
                      <div className="text-sm text-slate-500 mt-1">Kecepatan hingga {p.speed}</div>
                      <Button data-testid={`buy-package-${p.id}`}
                        className="w-full mt-4 bg-[#EA580C] hover:bg-[#C2410C]"
                        onClick={(e) => { e.stopPropagation(); setSelected(p); }}>
                        Beli Voucher
                      </Button>
                    </CardContent>
                  </Card>
                ))}
          </div>
        )}
      </main>

      <Dialog open={!!selected && !order} onOpenChange={() => setSelected(null)}>
        <DialogContent data-testid="buyer-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Beli {selected?.name}</DialogTitle>
            <DialogDescription>Isi data pembeli lalu lanjut ke pembayaran online.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createOrder} className="space-y-4">
            <div>
              <Label htmlFor="buyer-name">Nama</Label>
              <Input id="buyer-name" data-testid="buyer-name-input" required
                value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="buyer-contact">No. WhatsApp (opsional)</Label>
              <Input id="buyer-contact" data-testid="buyer-contact-input"
                value={form.buyer_contact} onChange={(e) => setForm({ ...form, buyer_contact: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm">
              <span>Total</span>
              <span className="font-bold text-[#1E3A8A]">{idr(selected?.price)}</span>
            </div>
            <Button type="submit" data-testid="create-order-button" disabled={busy}
              className="w-full bg-[#EA580C] hover:bg-[#C2410C]">
              {busy ? "Memproses..." : "Lanjut ke Pembayaran"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!order} onOpenChange={() => setOrder(null)}>
        <DialogContent data-testid="simulate-pay-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Pembayaran (Mode Simulasi)</DialogTitle>
            <DialogDescription>Konfirmasi pembayaran voucher hotspot Anda.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Payment gateway Midtrans belum dikonfigurasi, jadi pembayaran berjalan dalam mode simulasi.
          </p>
          <div className="rounded-md bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Order</span><span className="font-mono">{order?.order_id}</span></div>
            <div className="flex justify-between"><span>Paket</span><span>{order?.package_name}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span>{idr(order?.amount)}</span></div>
          </div>
          <Button data-testid="simulate-pay-button" onClick={paySimulated} disabled={busy}
            className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
            {busy ? "Memproses..." : "Bayar Sekarang (Simulasi)"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
