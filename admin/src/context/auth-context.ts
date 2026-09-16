import { createContext } from "react";
import type api from "@/api/axios";

export type AuthUser = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  assignedBranch?: string;
};

export type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

// Context object lives in its own .ts file so AuthContext.tsx only exports
// the provider component (react-refresh/only-export-components) and
// hooks/useAuth.ts can consume the context without importing the provider.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Imported only for the axios type reference above; keeps the type import honest.
export type Api = typeof api;
