import { useContext } from "react";
import { ThemeContext } from "@/context/theme-context";
import type { ThemeContextType } from "@/context/theme-context";

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
