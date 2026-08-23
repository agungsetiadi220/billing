import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Ban, Play, Trash2 } from "lucide-react";
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
import { Skeleton } from "../../components/ui/skeleton";

const emptyForm = {
  name: "", email: "", password: "", phone: "", address: "",
  pppoe_username: "", pppoe_password: "", package_id: "", wifi_interface: "wlan1",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState(null);
  const [packages, setPackages] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/admin/customers").then((r) => setCustomers(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/admin/packages").then((r) => setPackages(r.data.filter((p) => p.type === "pppoe"))).catch(() => {});
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/admin/customers", form);
      toast.success(data.mikrotik?.applied
        ? "Pelanggan dibuat & PPPoE secret ditambahkan ke router"
        : `Pelanggan dibuat (${data.mikrotik?.reason || "router belum terhubung"})`);
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    try {
      const { data } = await api.post(`/admin/customers/${id}/${action}`);
      toast.success(data.mikrotik?.applied ? "Status diubah & disinkronkan ke router" : `Status diubah (${data.mikrotik?.reason || "mode simulasi"})`);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus pelanggan ini beserta akun loginnya?")) return;
    try {
      await api.delete(`/admin/customers/${id}`);
      toast.success("Pelanggan dihapus");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="space-y-4" data-testid="customers-page">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Kelola pelanggan PPPoE/rumahan. Akun login portal otomatis dibuat.</p>
        <Button data-testid="add-customer-button" className="bg-[#1E3A8A] hover:bg-[#1E40AF]" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Pelanggan
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0 overflow-x-auto">
          {customers === null ? (
            <div className="p-6 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>PPPoE</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MikroTik</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Belum ada pelanggan.</TableCell></TableRow>
                )}
                {customers.map((c) => (
                  <TableRow key={c.id} data-testid={`customer-row-${c.pppoe_username}`}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.pppoe_username}</TableCell>
                    <TableCell>
                      <div className="text-sm">{c.package_name}</div>
                      <div className="text-xs text-slate-500">{idr(c.package_price)}/bln</div>
                    </TableCell>
                    <TableCell>
                      <Badge data-testid={`customer-status-${c.pppoe_username}`}
                        className={c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                        {c.status === "active" ? "Aktif" : "Isolir"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={c.mikrotik_synced ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}>
                        {c.mikrotik_synced ? "Tersinkron" : "Simulasi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {c.status === "active" ? (
                        <Button size="sm" variant="outline" data-testid={`isolate-${c.pppoe_username}`} onClick={() => act(c.id, "isolate")}>
                          <Ban className="w-3.5 h-3.5 mr-1" /> Isolir
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" data-testid={`activate-${c.pppoe_username}`} onClick={() => act(c.id, "activate")}>
                          <Play className="w-3.5 h-3.5 mr-1" /> Aktifkan
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" data-testid={`delete-${c.pppoe_username}`} onClick={() => remove(c.id)}>
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
        <DialogContent className="max-w-lg" data-testid="customer-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Tambah Pelanggan PPPoE</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nama Lengkap</Label>
              <Input data-testid="customer-name-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email (untuk login portal)</Label>
              <Input data-testid="customer-email-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Password Login</Label>
              <Input data-testid="customer-password-input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label>No. WhatsApp</Label>
              <Input data-testid="customer-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Alamat</Label>
              <Input data-testid="customer-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Username PPPoE</Label>
              <Input data-testid="customer-pppoe-user-input" required value={form.pppoe_username} onChange={(e) => setForm({ ...form, pppoe_username: e.target.value })} />
            </div>
            <div>
              <Label>Password PPPoE</Label>
              <Input data-testid="customer-pppoe-pass-input" required value={form.pppoe_password} onChange={(e) => setForm({ ...form, pppoe_password: e.target.value })} />
            </div>
            <div>
              <Label>Paket</Label>
              <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                <SelectTrigger data-testid="customer-package-select"><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {idr(p.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Interface WiFi Router</Label>
              <Input data-testid="customer-wifi-interface-input" value={form.wifi_interface} onChange={(e) => setForm({ ...form, wifi_interface: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Button type="submit" data-testid="customer-submit-button" disabled={busy || !form.package_id}
                className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
                {busy ? "Menyimpan..." : "Simpan Pelanggan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
