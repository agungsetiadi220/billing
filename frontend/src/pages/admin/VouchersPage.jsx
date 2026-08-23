import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ticket, Send } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { idr, statusVoucher, fmtDate } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Skeleton } from "../../components/ui/skeleton";

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState(null);
  const [packages, setPackages] = useState([]);
  const [agents, setAgents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tab, setTab] = useState("semua");
  const [genOpen, setGenOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [genForm, setGenForm] = useState({ package_id: "", qty: "10" });
  const [assignForm, setAssignForm] = useState({ batch_id: "", agent_id: "" });
  const [busy, setBusy] = useState(false);

  const load = (st = tab) => {
    api.get("/admin/vouchers", { params: { status: st } }).then((r) => setVouchers(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/admin/packages").then((r) => setPackages(r.data.filter((p) => p.type === "hotspot"))).catch(() => {});
    api.get("/admin/agents").then((r) => setAgents(r.data)).catch(() => {});
    api.get("/admin/voucher-batches").then((r) => setBatches(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const changeTab = (v) => { setTab(v); setVouchers(null); load(v); };

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/admin/vouchers/generate", { package_id: genForm.package_id, qty: parseInt(genForm.qty, 10) || 1 });
      toast.success(`${data.created} voucher dibuat (batch ${data.batch_id})`);
      setGenOpen(false);
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/admin/vouchers/assign", assignForm);
      toast.success(`${data.assigned} voucher dikirim ke agen`);
      setAssignOpen(false);
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="vouchers-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList>
            <TabsTrigger value="semua" data-testid="voucher-tab-semua">Semua</TabsTrigger>
            <TabsTrigger value="stok" data-testid="voucher-tab-stok">Stok</TabsTrigger>
            <TabsTrigger value="with_agent" data-testid="voucher-tab-agen">Di Agen</TabsTrigger>
            <TabsTrigger value="sold" data-testid="voucher-tab-terjual">Terjual</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="assign-voucher-button" onClick={() => setAssignOpen(true)}>
            <Send className="w-4 h-4 mr-2" /> Kirim ke Agen
          </Button>
          <Button className="bg-[#1E3A8A] hover:bg-[#1E40AF]" data-testid="generate-voucher-button" onClick={() => setGenOpen(true)}>
            <Ticket className="w-4 h-4 mr-2" /> Generate Voucher
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0 overflow-x-auto">
          {vouchers === null ? (
            <div className="p-6 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agen</TableHead>
                  <TableHead>Harga Jual</TableHead>
                  <TableHead>Terjual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">Tidak ada voucher.</TableCell></TableRow>
                )}
                {vouchers.map((v) => (
                  <TableRow key={v.id} data-testid={`voucher-row-${v.code}`}>
                    <TableCell className="font-mono font-semibold text-[#1E3A8A]">{v.code}</TableCell>
                    <TableCell>{v.package_name}</TableCell>
                    <TableCell className="font-mono text-xs">{v.batch_id}</TableCell>
                    <TableCell>
                      <Badge className={statusVoucher[v.status]?.cls || "bg-slate-100"}>
                        {statusVoucher[v.status]?.label || v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{v.agent_name || "-"}</TableCell>
                    <TableCell>{v.sold_price ? idr(v.sold_price) : "-"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{fmtDate(v.sold_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent data-testid="generate-voucher-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Generate Voucher Hotspot</DialogTitle>
          </DialogHeader>
          <form onSubmit={generate} className="space-y-4">
            <div>
              <Label>Paket Hotspot</Label>
              <Select value={genForm.package_id} onValueChange={(v) => setGenForm({ ...genForm, package_id: v })}>
                <SelectTrigger data-testid="generate-package-select"><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {idr(p.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jumlah Voucher</Label>
              <Input data-testid="generate-qty-input" type="number" min="1" max="500" value={genForm.qty}
                onChange={(e) => setGenForm({ ...genForm, qty: e.target.value })} />
            </div>
            <Button type="submit" data-testid="generate-voucher-submit" disabled={busy || !genForm.package_id}
              className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
              {busy ? "Membuat..." : "Generate"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent data-testid="assign-voucher-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Kirim Stok Voucher ke Agen/Warung</DialogTitle>
          </DialogHeader>
          <form onSubmit={assign} className="space-y-4">
            <div>
              <Label>Batch Voucher</Label>
              <Select value={assignForm.batch_id} onValueChange={(v) => setAssignForm({ ...assignForm, batch_id: v })}>
                <SelectTrigger data-testid="assign-batch-select"><SelectValue placeholder="Pilih batch" /></SelectTrigger>
                <SelectContent>
                  {batches.filter((b) => b.stok > 0).map((b) => (
                    <SelectItem key={b.batch_id} value={b.batch_id}>
                      {b.batch_id} — stok {b.stok}/{b.total}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agen / Warung</Label>
              <Select value={assignForm.agent_id} onValueChange={(v) => setAssignForm({ ...assignForm, agent_id: v })}>
                <SelectTrigger data-testid="assign-agent-select"><SelectValue placeholder="Pilih agen" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} (komisi {a.commission_pct}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" data-testid="assign-submit-button" disabled={busy || !assignForm.batch_id || !assignForm.agent_id}
              className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
              {busy ? "Mengirim..." : "Kirim Stok"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
