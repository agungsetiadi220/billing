import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2, LayoutDashboard, Users, Package, FileText, Ticket, Store, Wallet, Settings, Wifi } from "lucide-react";
import { AuthProvider, useAuth, homeFor } from "./context/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import BeliVoucherPage from "./pages/BeliVoucherPage";
import DashboardPage from "./pages/admin/DashboardPage";
import CustomersPage from "./pages/admin/CustomersPage";
import PackagesPage from "./pages/admin/PackagesPage";
import InvoicesPage from "./pages/admin/InvoicesPage";
import VouchersPage from "./pages/admin/VouchersPage";
import AgentsPage from "./pages/admin/AgentsPage";
import FinancePage from "./pages/admin/FinancePage";
import SettingsPage from "./pages/admin/SettingsPage";
import PortalPage from "./pages/PortalPage";
import AgentPage from "./pages/AgentPage";
import { Toaster } from "./components/ui/sonner";

const ADMIN_MENU = [
  { key: "dashboard", to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { key: "pelanggan", to: "/admin/pelanggan", label: "Pelanggan", icon: Users },
  { key: "paket", to: "/admin/paket", label: "Paket", icon: Package },
  { key: "tagihan", to: "/admin/tagihan", label: "Tagihan", icon: FileText },
  { key: "voucher", to: "/admin/voucher", label: "Voucher Hotspot", icon: Ticket },
  { key: "agen", to: "/admin/agen", label: "Agen / Warung", icon: Store },
  { key: "keuangan", to: "/admin/keuangan", label: "Keuangan", icon: Wallet },
  { key: "pengaturan", to: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

const PORTAL_MENU = [
  { key: "portal", to: "/portal", end: true, label: "Portal Pelanggan", icon: Wifi },
];

const AGENT_MENU = [
  { key: "agent", to: "/agent", end: true, label: "Portal Agen", icon: Store },
];

function FullLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#F8FAFC]">
      <Loader2 className="w-8 h-8 animate-spin text-[#1E3A8A]" />
    </div>
  );
}

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <FullLoading />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

function AdminRoute({ title, children }) {
  return (
    <Guard roles={["admin"]}>
      <DashboardLayout title={title} menu={ADMIN_MENU} />
      {children}
    </Guard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/beli" element={<BeliVoucherPage />} />

          <Route path="/admin" element={<Guard roles={["admin"]}><DashboardLayout title="Dashboard" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<DashboardPage />} />
          </Route>
          <Route path="/admin/pelanggan" element={<Guard roles={["admin"]}><DashboardLayout title="Pelanggan PPPoE" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<CustomersPage />} />
          </Route>
          <Route path="/admin/paket" element={<Guard roles={["admin"]}><DashboardLayout title="Paket Internet" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<PackagesPage />} />
          </Route>
          <Route path="/admin/tagihan" element={<Guard roles={["admin"]}><DashboardLayout title="Tagihan Pelanggan" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<InvoicesPage />} />
          </Route>
          <Route path="/admin/voucher" element={<Guard roles={["admin"]}><DashboardLayout title="Voucher Hotspot" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<VouchersPage />} />
          </Route>
          <Route path="/admin/agen" element={<Guard roles={["admin"]}><DashboardLayout title="Agen / Warung" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<AgentsPage />} />
          </Route>
          <Route path="/admin/keuangan" element={<Guard roles={["admin"]}><DashboardLayout title="Keuangan & Akuntansi" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<FinancePage />} />
          </Route>
          <Route path="/admin/pengaturan" element={<Guard roles={["admin"]}><DashboardLayout title="Pengaturan" menu={ADMIN_MENU} /></Guard>}>
            <Route index element={<SettingsPage />} />
          </Route>

          <Route path="/portal" element={<Guard roles={["pelanggan"]}><DashboardLayout title="Portal Pelanggan" menu={PORTAL_MENU} /></Guard>}>
            <Route index element={<PortalPage />} />
          </Route>
          <Route path="/agent" element={<Guard roles={["agen"]}><DashboardLayout title="Portal Agen / Warung" menu={AGENT_MENU} /></Guard>}>
            <Route index element={<AgentPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
