"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";

type Toast = { message: string; tone: "success" | "error"; id: number };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ message, tone, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.tone === "error" ? 5200 : 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.tone === "error" ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.tone === "error" ? <WarningCircle /> : <CheckCircle />}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
