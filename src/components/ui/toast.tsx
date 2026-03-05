"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: (dismiss: () => void) => void;
}

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

export interface ToastOptions {
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border/60 bg-card text-card-foreground shadow-elevated",
  success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 shadow-elevated",
  error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 shadow-elevated",
  info: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 shadow-elevated",
};

const variantIcons: Record<ToastVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = variantIcons[t.variant];
  const dismiss = () => onDismiss(t.id);

  React.useEffect(() => {
    const timer = setTimeout(dismiss, 6000);
    return () => clearTimeout(timer);
  }, [t.id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-4 animate-slide-up",
        variantStyles[t.variant]
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{t.message}</p>
      {t.action ? (
        <button
          onClick={() => t.action!.onClick(dismiss)}
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          {t.action.label}
        </button>
      ) : null}
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100 transition-all duration-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = React.useCallback((message: string, variant: ToastVariant = "default", options?: ToastOptions) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant, action: options?.action }]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const contextValue = React.useMemo(() => ({ toast: addToast }), [addToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
