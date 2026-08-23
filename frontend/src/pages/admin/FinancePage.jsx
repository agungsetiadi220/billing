import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { idr, fmtDate, periodeOptions, periodeLabel } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";

const KATEGORI = ["Listrik & Token", "Perangkat/Jaringan", "Gaji/Teknisi", "Perawatan", "Sewa Tempat", "Internet Upstream", "Lainnya"];

export default function FinancePage() {
  const nowKey = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(nowKey);
  const [txns, setTxns] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: KATEGORI[0], amount: "", description: "" });
  const [busy, setBusy] = useState(false);

  const load = (m = month) => {
    api.get("/admin/transactions", { params: { month: m } }).then((r) => setTxns(r.data)).catch((e) => toast.error(errMsg(e)));
  };
  useEffect(() => { load(); }, []);

  const changeMonth = (v) => { setMonth(v); setTxns(null); load(v); };

  const summary = useMemo(() => {
    const list = txns || [];
    const income = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [txns]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/expenses", { ...form, amount: parseInt(form.amount, 10) || 0 });
      toast.success("Pengeluaran dicatat");
      setOpen(false);
      setForm({ category: KATEGORI[0], amount: "", description: "" });
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus catatan pengeluaran ini?")) return;
    try { await api.delete(`/admin/expenses/${id}`); toast.success("Pengeluaran dihapus"); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="space-y-4" data-testid="finance-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={month} onValueChange={changeMonth}>
          <SelectTrigger className="w-56" data-testid="finance-month-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodeOptions(6).map((p) => (
              <SelectItem key={p} value={p}>{periodeLabel(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button data-testid="add-expense-button" className="bg-[#EA580C] hover:bg-[#C2410C]" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Catat Pengeluaran
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200" data-testid="finance-income-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Pemasukan</div>
              <div className="text-xl font-bold font-heading">{idr(summary.income)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="finance-expense-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-red-100 text-red-700 grid place-items-center"><TrendingDown className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Pengeluaran</div>
              <div className="text-xl font-bold font-heading">{idr(summary.expense)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" data-testid="finance-net-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-blue-100 text-[#1E3A8A] grid place-items-center"><Wallet className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">Laba Bersih</div>
              <div className="text-xl font-bold font-heading">{idr(summary.net)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Jurnal Transaksi — {periodeLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {txns === null ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada transaksi bulan ini.</TableCell></TableRow>
                )}
                {txns.map((t) => (
                  <TableRow key={t.id} data-testid={`txn-row-${t.id}`}>
                    <TableCell className="text-sm">{fmtDate(t.date)}</TableCell>
                    <TableCell className="font-medium">{t.category}</TableCell>
                    <TableCell className="text-sm text-slate-600">{t.description || "-"}</TableCell>
                    <TableCell>
                      <Badge className={t.type === "income" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                        {t.type === "income" ? "Pemasukan" : "Pengeluaran"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${t.type === "income" ? "text-emerald-700" : "text-red-700"}`}>
                      {t.type === "income" ? "+" : "-"}{idr(t.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.type === "expense" && (
                        <Button size="sm" variant="ghost" data-testid={`delete-expense-${t.id}`} onClick={() => remove(t.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="expense-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Catat Pengeluaran Operasional</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="expense-category-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KATEGORI.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jumlah (Rp)</Label>
              <Input data-testid="expense-amount-input" type="number" min="1" required value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Keterangan</Label>
              <Input data-testid="expense-description-input" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Contoh: Beli kabel UTP 50m" />
            </div>
            <Button type="submit" data-testid="expense-submit-button" disabled={busy} className="w-full bg-[#EA580C] hover:bg-[#C2410C]">
              {busy ? "Menyimpan..." : "Simpan Pengeluaran"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
