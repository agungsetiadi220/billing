import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Wallet, Users, FileWarning, Ticket } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api, { errMsg } from "../../lib/api";
import { idr, fmtDate } from "../../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { Badge } from "../../components/ui/badge";

function Stat({ icon: Icon, label, value, tone, testid }) {
  return (
    <Card data-testid={testid} className="border-slate-200 hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200">
      <CardContent className="p-6 flex items-start gap-4">
        <div className={`w-11 h-11 rounded-lg grid place-items-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">{label}</div>
          <div className="text-xl font-bold mt-1 font-heading">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/overview").then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!data) {
    return <div className="grid md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat testid="stat-income" icon={TrendingUp} label="Pemasukan Bulan Ini" value={idr(data.income_month)} tone="bg-emerald-100 text-emerald-700" />
        <Stat testid="stat-expense" icon={TrendingDown} label="Pengeluaran Bulan Ini" value={idr(data.expense_month)} tone="bg-red-100 text-red-700" />
        <Stat testid="stat-net" icon={Wallet} label="Laba Bersih Bulan Ini" value={idr(data.net_month)} tone="bg-blue-100 text-[#1E3A8A]" />
        <Stat testid="stat-customers" icon={Users} label="Pelanggan Aktif" value={`${data.customers_active} / ${data.customers_total}`} tone="bg-indigo-100 text-indigo-700" />
        <Stat testid="stat-unpaid" icon={FileWarning} label="Tagihan Belum Lunas" value={data.unpaid_invoices} tone="bg-amber-100 text-amber-700" />
        <Stat testid="stat-vouchers" icon={Ticket} label="Voucher Terjual Bulan Ini" value={data.vouchers_sold_month} tone="bg-orange-100 text-[#EA580C]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <Card className="lg:col-span-2 min-w-0 border-slate-200" data-testid="finance-chart-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Pemasukan vs Pengeluaran (6 Bulan)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <div className="w-full min-w-0 overflow-hidden h-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                  <Tooltip formatter={(v) => idr(v)} />
                  <Legend />
                  <Bar dataKey="pemasukan" name="Pemasukan" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#EA580C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="recent-transactions-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Transaksi Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.length === 0 && <p className="text-sm text-slate-500">Belum ada transaksi.</p>}
            {data.recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-sm border-b border-slate-100 pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.description || t.category}</div>
                  <div className="text-xs text-slate-500">{fmtDate(t.date)}</div>
                </div>
                <Badge className={t.type === "income" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                  {t.type === "income" ? "+" : "-"}{idr(t.amount)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
