import { createContext } from "react";

export type ToastKind = "success" | "error";

export type ToastContextType = {
  success: (message: string) => void;
  error: (message: string) => void;
};

// Context object lives in its own .ts file so ToastContext.tsx only exports
// the provider component (react-refresh/only-export-components) and
// hooks/useToast.ts can consume it without importing the provider.
export const ToastContext = createContext<ToastContextType | undefined>(undefined);

/** Module-level bridge so non-React code (axios interceptors, sockets)
 * can show a toast anywhere. The ToastProvider listens for this event. */
export function toast(type: ToastKind, message: string) {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));
}

export const toastSuccess = (message: string) => toast("success", message);
export const toastError = (message: string) => toast("error", message);
