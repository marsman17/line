"use client";
import { usePreferences } from "./preferences";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const { t: tx } = usePreferences();
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    const prior = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
      );
      if (!els?.length) return;
      const first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", trap);
      prior?.focus();
    };
  }, [mounted]);
  if (!mounted) return null;
  // A transformed mobile sidebar must not become the dialog's containing block.
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${className}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={tx(title)}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2>{tx(title)}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={tx("Close dialog")}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
