export const idr = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function periodeLabel(p) {
  if (!p) return "-";
  const [y, m] = p.split("-");
  return `${BULAN[parseInt(m, 10) - 1]} ${y}`;
}

export function periodeOptions(count = 4) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i - 1, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function fmtDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export const statusTagihan = {
  unpaid: { label: "Belum Lunas", cls: "bg-amber-100 text-amber-800" },
  pending: { label: "Menunggu Pembayaran", cls: "bg-blue-100 text-blue-800" },
  paid: { label: "Lunas", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Gagal", cls: "bg-red-100 text-red-800" },
};

export const statusVoucher = {
  stok: { label: "Stok", cls: "bg-slate-100 text-slate-700" },
  with_agent: { label: "Di Agen", cls: "bg-blue-100 text-blue-800" },
  sold: { label: "Terjual", cls: "bg-emerald-100 text-emerald-800" },
  used: { label: "Terpakai", cls: "bg-purple-100 text-purple-800" },
};
