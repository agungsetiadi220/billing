import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Store } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { idr } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";

const emptyForm = { name: "", email: "", password: "", phone: "", commission_pct: "10" };

export default function AgentsPage() {
  const [agents, setAgents] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/agents").then((r) => setAgents(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/agents", { ...form, commission_pct: parseFloat(form.commission_pct) || 0 });
      toast.success("Agen/warung dibuat. Akun bisa langsung login.");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus agen ini? Stok voucher dikembalikan ke admin.")) return;
    try { await api.delete(`/admin/agents/${id}`); toast.success("Agen dihapus"); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="space-y-4" data-testid="agents-page">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Agen warung menjual voucher hotspot offline dan mendapat komisi otomatis.</p>
        <Button data-testid="add-agent-button" className="bg-[#1E3A8A] hover:bg-[#1E40AF]" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Agen
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0 overflow-x-auto">
          {agents === null ? (
            <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agen/Warung</TableHead>
                  <TableHead>Komisi</TableHead>
                  <TableHead>Stok Voucher</TableHead>
                  <TableHead>Terjual</TableHead>
                  <TableHead>Saldo Komisi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    <Store className="w-8 h-8 mx-auto mb-2 text-slate-300" />Belum ada agen.
                  </TableCell></TableRow>
                )}
                {agents.map((a) => (
                  <TableRow key={a.id} data-testid={`agent-row-${a.email}`}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-slate-500">{a.email}{a.phone ? ` • ${a.phone}` : ""}</div>
                    </TableCell>
                    <TableCell>{a.commission_pct}%</TableCell>
                    <TableCell>{a.stock}</TableCell>
                    <TableCell>{a.sold}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">{idr(a.saldo)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" data-testid={`delete-agent-${a.email}`} onClick={() => remove(a.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="agent-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Tambah Agen / Warung</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Nama Warung/Agen</Label>
              <Input data-testid="agent-name-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Login</Label>
                <Input data-testid="agent-email-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Password</Label>
                <Input data-testid="agent-password-input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>No. WhatsApp</Label>
                <Input data-testid="agent-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Komisi (%)</Label>
                <Input data-testid="agent-commission-input" type="number" min="0" max="100" step="0.5" value={form.commission_pct}
                  onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} />
              </div>
            </div>
            <Button type="submit" data-testid="agent-submit-button" disabled={busy} className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
              {busy ? "Menyimpan..." : "Simpan Agen"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
