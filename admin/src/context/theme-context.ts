import { createContext } from "react";

export type Theme = "light" | "dark";

export type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
};

// Context object lives in its own .ts file so ThemeContext.tsx only exports
// the provider component (react-refresh/only-export-components) and
// hooks/useTheme.ts can consume the context without importing the provider.
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
