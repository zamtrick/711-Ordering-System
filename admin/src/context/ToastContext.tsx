import { useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import ToastContainer from "@/components/ui/Toast";
import type { ToastData } from "@/components/ui/Toast";
import { ToastContext } from "./toast-context";
import type { ToastKind } from "./toast-context";

/* Single global toast host: one state list, one ToastContainer rendered
 * here, and a window-event bridge ("app:toast") so non-React code —
 * axios interceptors, socket handlers — can surface messages too.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: ToastKind, message: string) => {
    const id = Math.floor(Date.now() + Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Bridge for non-React callers.
  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ type: ToastKind; message: string }>).detail;
      if (detail?.message) addToast(detail.type, detail.message);
    };
    window.addEventListener("app:toast", onToast);
    return () => window.removeEventListener("app:toast", onToast);
  }, [addToast]);

  const value = useMemo(
    () => ({
      success: (message: string) => addToast("success", message),
      error: (message: string) => addToast("error", message),
    }),
    [addToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};
