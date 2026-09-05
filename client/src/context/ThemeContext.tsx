import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

// ── Same color tokens as customer-mobile/constants/theme.ts ──

export const lightColors = {
  background: "#F8F5F2",
  surface: "#FFFFFE",
  primary: "#007A53",
  primaryDark: "#056666",
  orange: "#FF6720",
  red: "#DA291C",
  secondary: "#F45D48",
  headline: "#232323",
  paragraph: "#222525",
  muted: "#777777",
  border: "#E5E2DE",
  success: "#2E8B57",
  error: "#D64545",
};

export const darkColors = {
  background: "#121212",
  surface: "#1E1E1E",
  primary: "#078080",
  primaryDark: "#056666",
  orange: "#FF6720",
  red: "#DA291C",
  secondary: "#F45D48",
  headline: "#FFFFFF",
  paragraph: "#E5E5E5",
  muted: "#A0A0A0",
  border: "#2E2E2E",
  success: "#4CAF50",
  error: "#FF5C5C",
};

type Theme = "light" | "dark";
type Colors = typeof lightColors;

type ThemeContextType = {
  theme: Theme;
  colors: Colors;
  toggleTheme: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const colors = theme === "dark" ? darkColors : lightColors;

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  };

  // Sync CSS variables on <html> for Tailwind dark: variant
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ theme, colors, toggleTheme, isDark: theme === "dark" }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
