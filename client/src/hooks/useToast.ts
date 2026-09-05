import { useState, useCallback } from "react";
import type { ToastData } from "@/components/ui/Toast";

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback(
    (type: "success" | "error", message: string) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (msg: string) => addToast("success", msg),
    [addToast],
  );
  const error = useCallback(
    (msg: string) => addToast("error", msg),
    [addToast],
  );

  return { toasts, removeToast, success, error };
}
