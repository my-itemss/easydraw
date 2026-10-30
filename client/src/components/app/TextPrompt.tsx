import { useEffect, useState } from "react";
import { Button, Field, Modal, inputClass } from "../ui";

export default function TextPrompt({
  open,
  title,
  label,
  initial = "",
  confirm = "Save",
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirm?: string;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setV(initial);
  }, [open, initial]);
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!v.trim()) return;
          setBusy(true);
          try {
            await onSubmit(v.trim());
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={label}>
          <input autoFocus className={inputClass} value={v} onChange={(e) => setV(e.target.value)} maxLength={200} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !v.trim()}>
            {confirm}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
