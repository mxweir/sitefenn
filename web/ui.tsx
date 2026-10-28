import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react";

export function FennMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M11 31 8 6l18 15a32 32 0 0 1 12 0L56 6l-3 25c5 17-8 28-21 28S6 48 11 31Z"
        fill="currentColor"
        stroke="#1a1a1a"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m15 17 2 12 6-5m26-7-2 12-6-5"
        stroke="#1a1a1a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse cx="24" cy="36" rx="2.5" ry="4" fill="#1a1a1a" />
      <ellipse cx="40" cy="36" rx="2.5" ry="4" fill="#1a1a1a" />
      <path d="m28 45 4 4 4-4Z" fill="#1a1a1a" />
      <path
        d="M27 52q5 3 10 0"
        stroke="#1a1a1a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="detail-placeholder">
      {icon}
      <h3>{title}</h3>
      <div className="empty-description">{children}</div>
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={error ? "error-banner" : "inline-warning"}
      role={error ? "alert" : "status"}
    >
      <CircleAlert size={17} />
      <div>{children}</div>
    </div>
  );
}
export function Busy({ label = "Wird geladen …" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={20} className="spin" />
      {label}
    </div>
  );
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="success-note" role="status">
      <CheckCircle2 size={17} />
      {children}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  busyRef.current = busy;
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (
      dialog.current?.querySelector<HTMLElement>("input, select, textarea") ??
      dialog.current?.querySelector<HTMLElement>("button")
    )?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
      );
      if (!items?.length) {
        event.preventDefault();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (!dialog.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="modal-close"
          aria-label="Dialog schließen"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
        <p className="eyebrow">SITEFENN WORKSPACE</p>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
