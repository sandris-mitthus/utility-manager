"use client";

import { useCallback, useEffect, useRef } from "react";
import { IconX } from "@/app/components/ui/icons";

export type FeedbackToastVariant = "error" | "success" | "info" | "warning";

type FeedbackToastProps = {
  message: string;
  variant?: FeedbackToastVariant;
  durationMs?: number;
  onDismiss: () => void;
};

const VARIANT_STYLES: Record<FeedbackToastVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-zinc-200 bg-white text-zinc-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function FeedbackToast({
  message,
  variant = "info",
  durationMs = 5000,
  onDismiss,
}: FeedbackToastProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(onDismiss, durationMs);
  }, [clearTimer, durationMs, onDismiss]);

  useEffect(() => {
    if (!hoveredRef.current) {
      startTimer();
    }

    return clearTimer;
  }, [message, startTimer, clearTimer]);

  function handleMouseEnter() {
    hoveredRef.current = true;
    clearTimer();
  }

  function handleMouseLeave() {
    hoveredRef.current = false;
    startTimer();
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[100] w-[min(100%-2rem,28rem)] -translate-x-1/2"
      role="alert"
      aria-live="assertive"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${VARIANT_STYLES[variant]}`}
      >
        <p className="min-w-0 flex-1 leading-relaxed">{message}</p>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-current opacity-70 transition-opacity hover:opacity-100"
          onClick={onDismiss}
          aria-label="Aizvērt"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  );
}
