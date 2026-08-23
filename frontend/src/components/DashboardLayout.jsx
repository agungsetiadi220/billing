import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Wifi, LogOut } from "lucide-react";
import { Button } from "../components/ui/button";

export default function DashboardLayout({ title, menu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-[background-color,color] duration-150 ${
      isActive ? "bg-white/15 text-white border-l-4 border-[#EA580C]" : "text-blue-100/80 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="dashboard-layout">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-[#1E3A8A] text-white z-30">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/10">
          <div className="w-9 h-9 rounded-md bg-[#EA580C] grid place-items-center">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-heading font-semibold leading-tight">Deliwifi</div>
            <div className="text-[11px] text-blue-200/70 tracking-wide uppercase">Billing RT/RW Net</div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menu.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={linkCls} data-testid={`nav-${m.key}`}>
              <m.icon className="w-4 h-4" />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs text-blue-200/70 truncate mb-3">{user?.email}</div>
          <Button data-testid="logout-button" variant="secondary" size="sm" className="w-full" onClick={doLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 border-b border-slate-200">
          <div className="flex items-center justify-between px-4 md:px-8 h-16">
            <h1 className="font-heading text-xl font-semibold tracking-tight" data-testid="page-title">{title}</h1>
            <div className="flex items-center gap-3 md:hidden">
              <span className="text-sm text-slate-600">{user?.name}</span>
              <Button data-testid="logout-button-mobile" variant="outline" size="sm" onClick={doLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <nav className="md:hidden flex gap-2 overflow-x-auto px-4 pb-3">
            {menu.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                data-testid={`nav-mobile-${m.key}`}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isActive ? "bg-[#1E3A8A] text-white border-[#1E3A8A]" : "bg-white text-slate-600 border-slate-200"
                  }`
                }
              >
                {m.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
