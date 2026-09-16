import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import api from "@/api/axios";
import { AuthContext } from "./auth-context";
import type { AuthUser } from "./auth-context";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => {
        const u = res.data?.data;
        if (u && (u.role === "admin" || u.role === "superadmin")) {
          setUser({
            id: u.id,
            firstname: u.firstname,
            lastname: u.lastname,
            email: u.email,
            role: u.role,
            assignedBranch: u.assignedBranch,
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const u = res.data?.userResponse;
      if (!u) throw new Error("Invalid response from server");
      if (u.role !== "admin" && u.role !== "superadmin") {
        await api.post("/auth/logout").catch(() => {});
        throw new Error("Access denied. Admin or Superadmin only.");
      }
      setUser({
        id: u.id,
        firstname: u.firstname,
        lastname: u.lastname,
        email: u.email,
        role: u.role,
        assignedBranch: u.assignedBranch,
      });
    } catch (err: any) {
      if (!err?.response && (err?.code === "ERR_NETWORK" || err?.message === "Network Error")) {
        throw new Error(
          "Cannot reach the API server. Make sure the backend is running on http://localhost:5000 (npm run dev in /server).",
        );
      }
      if (err?.response?.data?.message) throw new Error(err.response.data.message);
      throw err;
    }
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
