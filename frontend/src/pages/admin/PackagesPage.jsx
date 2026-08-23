import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { idr } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Skeleton } from "../../components/ui/skeleton";
import { Switch } from "../../components/ui/switch";

const emptyForm = { name: "", type: "pppoe", price: "", speed: "", duration_label: "", profile: "default", active: true };

export default function PackagesPage() {
  const [packages, setPackages] = useState(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/packages").then((r) => setPackages(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const openAdd = (type) => { setEditId(null); setForm({ ...emptyForm, type }); setOpen(true); };
  const openEdit = (p) => { setEditId(p.id); setForm({ name: p.name, type: p.type, price: p.price, speed: p.speed, duration_label: p.duration_label, profile: p.profile || "default", active: p.active }); setOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, price: parseInt(form.price, 10) || 0 };
      if (editId) await api.put(`/admin/packages/${editId}`, payload);
      else await api.post("/admin/packages", payload);
      toast.success("Paket disimpan");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus paket ini?")) return;
    try { await api.delete(`/admin/packages/${id}`); toast.success("Paket dihapus"); load(); }
    catch (err) { toast.error(errMsg(err)); }
  };

  const renderTable = (type) => {
    const rows = (packages || []).filter((p) => p.type === type);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Paket</TableHead>
            <TableHead>Harga</TableHead>
            <TableHead>Kecepatan</TableHead>
            <TableHead>Durasi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada paket.</TableCell></TableRow>}
          {rows.map((p) => (
            <TableRow key={p.id} data-testid={`package-row-${p.id}`}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>{idr(p.price)}</TableCell>
              <TableCell>{p.speed || "-"}</TableCell>
              <TableCell>{p.duration_label || "-"}</TableCell>
              <TableCell>
                <Badge className={p.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
                  {p.active ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" data-testid={`edit-package-${p.id}`} onClick={() => openEdit(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" data-testid={`delete-package-${p.id}`} onClick={() => remove(p.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-4" data-testid="packages-page">
      <Tabs defaultValue="pppoe">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="pppoe" data-testid="tab-paket-pppoe">Paket PPPoE</TabsTrigger>
            <TabsTrigger value="hotspot" data-testid="tab-paket-hotspot">Paket Hotspot</TabsTrigger>
          </TabsList>
        </div>
        <Card className="border-slate-200 mt-4">
          <CardContent className="p-0 overflow-x-auto">
            {packages === null ? (
              <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <>
                <TabsContent value="pppoe" className="m-0">{renderTable("pppoe")}</TabsContent>
                <TabsContent value="hotspot" className="m-0">{renderTable("hotspot")}</TabsContent>
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex gap-2 mt-4">
          <Button data-testid="add-pppoe-package-button" variant="outline" onClick={() => openAdd("pppoe")}>
            <Plus className="w-4 h-4 mr-2" /> Paket PPPoE
          </Button>
          <Button data-testid="add-hotspot-package-button" variant="outline" onClick={() => openAdd("hotspot")}>
            <Plus className="w-4 h-4 mr-2" /> Paket Hotspot
          </Button>
        </div>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="package-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Ubah Paket" : "Tambah Paket"} {form.type === "pppoe" ? "PPPoE" : "Hotspot"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Nama Paket</Label>
              <Input data-testid="package-name-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Harga (Rp)</Label>
                <Input data-testid="package-price-input" type="number" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Kecepatan</Label>
                <Input data-testid="package-speed-input" placeholder="10 Mbps" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durasi</Label>
                <Input data-testid="package-duration-input" placeholder={form.type === "pppoe" ? "Per Bulan" : "3 Jam"} value={form.duration_label} onChange={(e) => setForm({ ...form, duration_label: e.target.value })} />
              </div>
              <div>
                <Label>Profile MikroTik</Label>
                <Input data-testid="package-profile-input" value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch data-testid="package-active-switch" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Paket aktif / dapat dibeli</Label>
            </div>
            <Button type="submit" data-testid="package-submit-button" disabled={busy} className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
              {busy ? "Menyimpan..." : "Simpan Paket"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
