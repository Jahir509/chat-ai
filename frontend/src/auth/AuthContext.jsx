import { createContext, useContext, useEffect, useState } from "react";
import api, { clearTokens, getAccess, setTokens } from "../api/client";

const Auth = createContext(null);
export const useAuth = () => useContext(Auth);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccess()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me/")
      .then(({ data }) => setUser(data))
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login/", { email, password });
    setTokens(data);
    const me = await api.get("/auth/me/");
    setUser(me.data);
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register/", payload);
    setTokens(data);
    setUser(data.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout/", {
        refresh: localStorage.getItem("refresh"),
      });
    } catch {
      /* token already invalid — clear locally regardless */
    }
    clearTokens();
    setUser(null);
  }

  return (
    <Auth.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </Auth.Provider>
  );
}