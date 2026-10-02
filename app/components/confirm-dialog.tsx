"use client";

import { useEffect, useRef } from "react";
import { Warning } from "@phosphor-icons/react/ssr";

// Rückfrage vor endgültigen Aktionen (Löschen). Escape oder Klick daneben bricht ab.
export function ConfirmDialog({
  title,
  text,
  confirmLabel = "Löschen",
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="overlay"
      style={{ placeItems: "center", paddingTop: 20 }}
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
      >
        <div>
          <Warning aria-hidden="true" />
          <div>
            <h2 id="confirm-title">{title}</h2>
            <p id="confirm-text">{text}</p>
          </div>
        </div>
        <footer>
          <button ref={cancel} className="secondary-button" type="button" onClick={onCancel} disabled={pending}>
            Abbrechen
          </button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Bitte warten …" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
