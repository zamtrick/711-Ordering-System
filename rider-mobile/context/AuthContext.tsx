import React, { createContext, useState, useEffect, useContext, useRef } from "react";
import api from "@/api/axios";

type User = {
  _id: string;
  id?: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isActive: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const normalizeUser = (u: any): User => ({
  _id: u._id ?? u.id,
  id: u.id ?? u._id,
  firstname: u.firstname,
  lastname: u.lastname,
  email: u.email,
  role: u.role,
  isActive: u.isActive ?? true,
});

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider not mounted");
  },
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumps on every login/logout so a slow initial GET /auth/me
  // can't wipe a just-logged-in session when it resolves late.
  const sessionSeq = useRef(0);

  const refreshUser = async () => {
    const seq = sessionSeq.current;
    try {
      const res = await api.get("/auth/me");
      // Server returns { success, data: { id, firstname, ... } }
      const u = res.data?.data ?? res.data?.user;
      if (sessionSeq.current !== seq) return;
      if (u) {
        setUser(normalizeUser(u));
      } else {
        setUser(null);
      }
    } catch {
      if (sessionSeq.current !== seq) return;
      setUser(null);
    } finally {
      if (sessionSeq.current === seq) setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    // Server returns { success, userResponse: { id, firstname, ... } }
    const u = res.data?.userResponse ?? res.data?.user ?? res.data?.data;
    if (!u) {
      throw new Error("Invalid response from server");
    }
    if (u.role !== "rider") {
      await api.post("/auth/logout").catch(() => {});
      throw new Error("Access denied. Rider account only.");
    }
    sessionSeq.current += 1;
    const normalized = normalizeUser(u);
    setUser(normalized);
    setLoading(false);
    return normalized;
  };

  const logout = async () => {
    sessionSeq.current += 1;
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
