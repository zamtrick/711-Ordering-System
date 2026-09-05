import { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

export type ToastData = {
  id: number;
  type: "success" | "error";
  message: string;
};

type Props = {
  toasts: ToastData[];
  onRemove: (id: number) => void;
};

export default function ToastContainer({ toasts, onRemove }: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastData;
  onRemove: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-72 max-w-sm bg-white dark:bg-[#1E1E1E]",
        isSuccess
          ? "border border-[#007A53]/30 dark:border-[#078080]/30"
          : "border border-[#DA291C]/30 dark:border-[#FF5C5C]/30",
      ].join(" ")}
    >
      {isSuccess ? (
        <CheckCircle size={20} className="text-[#007A53] dark:text-[#4CAF50] shrink-0" />
      ) : (
        <XCircle size={20} className="text-[#DA291C] dark:text-[#FF5C5C] shrink-0" />
      )}
      <p className="text-sm text-[#232323] dark:text-white flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-[#777] dark:text-[#A0A0A0] hover:text-[#232323] dark:hover:text-white transition-colors cursor-pointer"
      >
        <X size={15} />
      </button>
    </div>
  );
}
