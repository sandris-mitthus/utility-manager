"use client";

import { useEffect, useId, useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { confirmDialogFooterClassName } from "@/app/components/ui/form-styles";
import { runPendingAction } from "@/app/lib/run-pending-action";

type ConfirmCloseDialogProps = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
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
  const [pendingAction, setPendingAction] = useState<"cancel" | "confirm" | null>(null);
  const isBusy = pendingAction !== null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isBusy) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        void runPendingAction("cancel", setPendingAction, onCancel);
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
        void runPendingAction("confirm", setPendingAction, onConfirm);
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isBusy, onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => {
        if (!isBusy) {
          void runPendingAction("cancel", setPendingAction, onCancel);
        }
      }}
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
        <div className={confirmDialogFooterClassName}>
          <ActionButton
            variant="secondary"
            loading={pendingAction === "cancel"}
            disabled={isBusy}
            onClick={() => void runPendingAction("cancel", setPendingAction, onCancel)}
          >
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant={confirmVariant === "danger" ? "danger" : "primary"}
            loading={pendingAction === "confirm"}
            disabled={isBusy}
            onClick={() => void runPendingAction("confirm", setPendingAction, onConfirm)}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
