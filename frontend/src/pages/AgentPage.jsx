import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, Ticket, CheckCircle2, Banknote } from "lucide-react";
import api, { errMsg } from "../lib/api";
import { idr, fmtDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Skeleton } from "../components/ui/skeleton";

export default function AgentPage() {
  const [me, setMe] = useState(null);
  const [stok, setStok] = useState(null);
  const [terjual, setTerjual] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);
  const [sellForm, setSellForm] = useState({ price: "", buyer: "" });
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/agent/me").then((r) => setMe(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/agent/vouchers?scope=stok").then((r) => setStok(r.data)).catch(() => setStok([]));
    api.get("/agent/vouchers?scope=terjual").then((r) => setTerjual(r.data)).catch(() => setTerjual([]));
  };
  useEffect(() => { load(); }, []);

  const openSell = (v) => {
    setSellTarget(v);
    setSellForm({ price: String(v.price || ""), buyer: "" });
  };

  const sell = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/agent/vouchers/${sellTarget.code}/sell`, {
        price: parseInt(sellForm.price, 10) || undefined, buyer: sellForm.buyer,
      });
      toast.success(`Voucher ${sellTarget.code} terjual. Komisi ${idr(data.commission)} masuk saldo.`);
      setSellTarget(null);
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  if (!me || stok === null || terjual === null) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6" data-testid="agent-portal">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200" data-testid="agent-saldo-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center"><Wallet className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Saldo Komisi</div>
              <div className="text-xl font-bold font-heading">{idr(me.saldo)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="agent-stock-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-100 text-[#1E3A8A] grid place-items-center"><Ticket className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Stok Voucher</div>
              <div className="text-xl font-bold font-heading">{me.stock}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="agent-sold-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-orange-100 text-[#EA580C] grid place-items-center"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Total Terjual</div>
              <div className="text-xl font-bold font-heading">{me.sold}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-slate-500">Komisi Anda {me.commission_pct}% dari setiap voucher terjual, masuk otomatis ke saldo.</p>

      <Tabs defaultValue="stok">
        <TabsList>
          <TabsTrigger value="stok" data-testid="agent-tab-stok">Stok Saya ({stok.length})</TabsTrigger>
          <TabsTrigger value="terjual" data-testid="agent-tab-terjual">Riwayat Penjualan ({terjual.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="stok">
          <Card className="border-slate-200">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode Voucher</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stok.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">Stok kosong. Minta admin mengirim stok voucher.</TableCell></TableRow>
                  )}
                  {stok.map((v) => (
                    <TableRow key={v.id} data-testid={`agent-stock-${v.code}`}>
                      <TableCell className="font-mono font-semibold text-[#1E3A8A]">{v.code}</TableCell>
                      <TableCell>{v.package_name}</TableCell>
                      <TableCell>{idr(v.price)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" data-testid={`sell-${v.code}`} className="bg-[#EA580C] hover:bg-[#C2410C]" onClick={() => openSell(v)}>
                          <Banknote className="w-3.5 h-3.5 mr-1" /> Jual
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terjual">
          <Card className="border-slate-200">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Harga Jual</TableHead>
                    <TableHead>Komisi</TableHead>
                    <TableHead>Pembeli</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terjual.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada penjualan.</TableCell></TableRow>
                  )}
                  {terjual.map((v) => (
                    <TableRow key={v.id} data-testid={`agent-sold-${v.code}`}>
                      <TableCell className="font-mono">{v.code}</TableCell>
                      <TableCell>{v.package_name}</TableCell>
                      <TableCell>{idr(v.sold_price)}</TableCell>
                      <TableCell className="text-emerald-700 font-semibold">{idr(v.commission)}</TableCell>
                      <TableCell className="text-sm">{v.buyer || "-"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{fmtDate(v.sold_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!sellTarget} onOpenChange={() => setSellTarget(null)}>
        <DialogContent data-testid="sell-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Jual Voucher {sellTarget?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={sell} className="space-y-4">
            <div>
              <Label>Harga Jual (Rp)</Label>
              <Input data-testid="sell-price-input" type="number" min="1" required value={sellForm.price}
                onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })} />
            </div>
            <div>
              <Label>Nama Pembeli (opsional)</Label>
              <Input data-testid="sell-buyer-input" value={sellForm.buyer}
                onChange={(e) => setSellForm({ ...sellForm, buyer: e.target.value })} />
            </div>
            <Button type="submit" data-testid="sell-submit-button" disabled={busy} className="w-full bg-[#EA580C] hover:bg-[#C2410C]">
              {busy ? "Memproses..." : "Konfirmasi Penjualan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
