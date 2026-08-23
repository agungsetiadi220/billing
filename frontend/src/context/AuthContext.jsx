import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export const useAuth = () => useContext(AuthCtx);

export function homeFor(role) {
  if (role === "admin") return "/admin";
  if (role === "agen") return "/agent";
  return "/portal";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hasSession = localStorage.getItem("deliwifi_token") || document.cookie.includes("access_token");
    if (!hasSession) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("deliwifi_token", data.token);
    setUser(data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("deliwifi_token", data.token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* abaikan */ }
    localStorage.removeItem("deliwifi_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
