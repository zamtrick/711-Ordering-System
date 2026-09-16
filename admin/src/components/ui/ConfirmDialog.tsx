import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (confirmText: string) => void;
  title: string;
  message: string;
  loading?: boolean;
  /** When set (e.g. "DELETE"), the user must type it to enable the confirm button. */
  confirmText?: string;
  confirmLabel?: string;
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
  confirmText = "",
  confirmLabel = "Delete",
}: Props) {
  const [value, setValue] = useState("");

  // Fresh dialog every time it closes — no stale typed text on reopen.
  // Done in the close/confirm event handlers (not an effect) so the reset
  // happens without an extra render pass.
  const handleClose = () => {
    setValue("");
    onClose();
  };

  const handleConfirm = () => {
    setValue("");
    onConfirm(value);
  };

  const required = confirmText.trim().toUpperCase();
  const matched = !required || value.trim().toUpperCase() === required;

  return (
    <Modal open={open} onClose={handleClose} title={title} width="max-w-sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-danger-soft flex items-center justify-center">
          <AlertTriangle size={28} className="text-danger dark:text-danger" />
        </div>
        <p className="text-sm text-muted leading-relaxed">{message}</p>
        {required && (
          <div className="w-full text-left">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={required}
              label={`Type "${required}" to confirm`}
              disabled={loading}
              autoFocus
            />
          </div>
        )}
        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!matched}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
