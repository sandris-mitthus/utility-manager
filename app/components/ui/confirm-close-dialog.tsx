"use client";

import { useEffect, useId } from "react";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui/form-styles";

type ConfirmCloseDialogProps = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmCloseDialog({
  title = "Aizvērt modālu?",
  message = "Vai tiešām vēlaties aizvērt modālu? Nesaglabātās izmaiņas tiks zaudētas.",
  confirmLabel = "Aizvērt",
  cancelLabel = "Atcelt",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmCloseDialogProps) {
  const titleId = useId();
  const confirmClassName =
    confirmVariant === "danger" ? dangerButtonClassName : primaryButtonClassName;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }

      if (event.key === "Enter") {
        if (event.defaultPrevented) {
          return;
        }

        const target = event.target as HTMLElement;
        if (target.tagName === "TEXTAREA") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onConfirm();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 id={titleId} className="text-base font-semibold text-zinc-900">
          {title}
        </h4>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={confirmClassName} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
