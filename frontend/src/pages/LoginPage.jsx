import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wifi, Ticket, Router } from "lucide-react";
import { useAuth, homeFor } from "../context/AuthContext";
import { errMsg } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", email: "", phone: "", password: "" });

  const doLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(loginForm.email, loginForm.password);
      toast.success(`Selamat datang, ${u.name}`);
      navigate(homeFor(u.role));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register(regForm);
      toast.success(`Akun dibuat. Selamat datang, ${u.name}`);
      navigate(homeFor(u.role));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white" data-testid="login-page">
      <div className="flex flex-col justify-center px-6 sm:px-16 lg:px-24 py-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-lg bg-[#1E3A8A] grid place-items-center">
            <Wifi className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-heading text-xl font-semibold tracking-tight">Deliwifi</div>
            <div className="text-xs tracking-[0.2em] uppercase text-slate-500 font-semibold">RT/RW-Net Billing</div>
          </div>
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl font-semibold tracking-tight mb-2">Masuk ke Akun Anda</h1>
        <p className="text-slate-500 mb-8">Kelola tagihan internet, voucher hotspot, dan pengaturan WiFi Anda.</p>

        <Tabs defaultValue="login" className="max-w-md">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login" data-testid="tab-login">Masuk</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Daftar</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={doLogin} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" data-testid="login-email-input" type="email" required
                  value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="nama@email.com" />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" data-testid="login-password-input" type="password" required
                  value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••" />
              </div>
              <Button data-testid="login-submit-button" type="submit" disabled={busy}
                className="w-full bg-[#1E3A8A] hover:bg-[#1E40AF]">
                {busy ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={doRegister} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="reg-name">Nama Lengkap</Label>
                <Input id="reg-name" data-testid="register-name-input" required
                  value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" data-testid="register-email-input" type="email" required
                  value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="reg-phone">No. WhatsApp</Label>
                <Input id="reg-phone" data-testid="register-phone-input"
                  value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="reg-password">Password</Label>
                <Input id="reg-password" data-testid="register-password-input" type="password" required minLength={6}
                  value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} />
              </div>
              <Button data-testid="register-submit-button" type="submit" disabled={busy}
                className="w-full bg-[#EA580C] hover:bg-[#C2410C]">
                {busy ? "Memproses..." : "Daftar Sekarang"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <Link to="/beli" data-testid="buy-voucher-link"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#EA580C] hover:text-[#C2410C] transition-colors">
          <Ticket className="w-4 h-4" /> Beli voucher hotspot tanpa login
        </Link>
      </div>

      <div className="hidden lg:block relative bg-[#1E3A8A]">
        <img
          src="https://images.pexels.com/photos/29711663/pexels-photo-29711663.jpeg"
          alt="Router WiFi"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="relative z-10 flex flex-col justify-end h-full p-16 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Router className="w-8 h-8 text-[#F97316]" />
            <span className="text-xs tracking-[0.25em] uppercase font-semibold text-blue-200">Internet Kampung Andal</span>
          </div>
          <h2 className="font-heading text-4xl font-semibold leading-tight mb-4">
            PPPoE &amp; Hotspot dalam satu sistem billing.
          </h2>
          <p className="text-blue-100/90 max-w-md leading-relaxed">
            Tagihan otomatis, pembayaran online, voucher hotspot untuk warung, dan laporan keuangan — semua terhubung ke router MikroTik Anda.
          </p>
        </div>
      </div>
    </div>
  );
}
