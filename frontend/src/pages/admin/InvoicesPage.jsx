import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FilePlus2, CheckCircle2, Trash2 } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { idr, periodeLabel, periodeOptions, statusTagihan, fmtDate } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState("semua");
  const [open, setOpen] = useState(false);
  const [genForm, setGenForm] = useState({ customer_id: "ALL", period: periodeOptions(2)[1] });
  const [busy, setBusy] = useState(false);

  const load = (st = status) => {
    api.get("/admin/invoices", { params: { status: st } }).then((r) => setInvoices(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/admin/customers").then((r) => setCustomers(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const changeStatus = (v) => { setStatus(v); setInvoices(null); load(v); };

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = genForm.customer_id === "ALL"
        ? { all_customers: true, period: genForm.period }
        : { customer_id: genForm.customer_id, period: genForm.period };
      const { data } = await api.post("/admin/invoices/generate", payload);
      toast.success(`${data.created} tagihan dibuat, ${data.skipped} dilewati (sudah ada)`);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (id) => {
    try {
      await api.post(`/admin/invoices/${id}/mark-paid`);
      toast.success("Tagihan ditandai lunas (tunai)");
      load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus tagihan ini?")) return;
    try { await api.delete(`/admin/invoices/${id}`); toast.success("Tagihan dihapus"); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="space-y-4" data-testid="invoices-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select value={status} onValueChange={changeStatus}>
          <SelectTrigger className="w-56" data-testid="invoice-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="unpaid">Belum Lunas</SelectItem>
            <SelectItem value="pending">Menunggu Pembayaran</SelectItem>
            <SelectItem value="paid">Lunas</SelectItem>
          </SelectContent>
        </Select>
        <Button data-testid="generate-invoice-button" className="bg-[#1E3A8A] hover:bg-[#1E40AF]" onClick={() => setOpen(true)}>
          <FilePlus2 className="w-4 h-4 mr-2" /> Buat Tagihan
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0 overflow-x-auto">
          {invoices === null ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Tagihan</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">Belum ada tagihan.</TableCell></TableRow>
                )}
                {invoices.map((inv) => (
                  <TableRow key={inv.id} data-testid={`invoice-row-${inv.invoice_no}`}>
                    <TableCell className="font-mono text-sm">{inv.invoice_no}</TableCell>
                    <TableCell className="font-medium">{inv.customer_name}</TableCell>
                    <TableCell>{periodeLabel(inv.period)}</TableCell>
                    <TableCell>{idr(inv.amount)}</TableCell>
                    <TableCell>
                      <Badge data-testid={`invoice-status-${inv.invoice_no}`} className={statusTagihan[inv.status]?.cls || "bg-slate-100"}>
                        {statusTagihan[inv.status]?.label || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {inv.method || "-"}{inv.paid_at ? ` • ${fmtDate(inv.paid_at)}` : ""}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {inv.status !== "paid" && (
                        <>
                          <Button size="sm" variant="outline" data-testid={`mark-paid-${inv.invoice_no}`} onClick={() => markPaid(inv.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Lunas (Tunai)
                          </Button>
                          <Button size="sm" variant="ghost" data-testid={`delete-invoice-${inv.invoice_no}`} onClick={() => remove(inv.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </Button>
                        </>
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
        <DialogContent data-testid="generate-invoice-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Buat Tagihan Bulanan</DialogTitle>
          </DialogHeader>
          <form onSubmit={generate} className="space-y-4">
            <div>
              <Label>Pelanggan</Label>
              <Select value={genForm.customer_id} onValueChange={(v) => setGenForm({ ...genForm, customer_id: v })}>
                <SelectTrigger data-testid="generate-customer-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Pelanggan Aktif</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.package_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Periode</Label>
              <Select value={genForm.period} onValueChange={(v) => setGenForm({ ...genForm, period: v })}>
                <SelectTrigger data-testid="generate-period-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodeOptions(4).map((p) => (
                    <SelectItem key={p} value={p}>{periodeLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" data-testid="generate-submit-button" disabled={busy} className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
              {busy ? "Membuat..." : "Buat Tagihan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
