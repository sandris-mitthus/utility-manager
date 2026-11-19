"use client";

import { useEffect, useState } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import { FeedbackToast, type FeedbackToastVariant } from "@/app/components/ui/feedback-toast";
import { cardClassName, labelClassName, statusBadgeClassName } from "@/app/components/ui/form-styles";
import { IconInput, PasswordInput } from "@/app/components/ui/icon-input";
import { IconMail, IconSave } from "@/app/components/ui/icons";
import { adminMutationHeaders } from "@/app/lib/security/admin-api";
import { runPendingAction } from "@/app/lib/run-pending-action";

type IntegrationItem = {
  key: string;
  fromEmail: string;
  replyToEmail: string;
  hasSecret: boolean;
  configured: boolean;
  enabled: boolean;
};

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

export function AdminIntegrationsTab() {
  const { csrfToken } = useAdminData();
  const [item, setItem] = useState<IntegrationItem | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<"load" | "save" | "toggle" | "reset" | null>(
    null,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const isBusy = pendingAction !== null;

  useEffect(() => {
    let ignore = false;
    void runPendingAction("load", setPendingAction, async () => {
      const response = await fetch("/api/admin/integrations", {
        headers: adminMutationHeaders(csrfToken),
      });
      const json = (await response.json()) as {
        success?: boolean;
        message?: string;
        items?: IntegrationItem[];
      };
      if (ignore) {
        return;
      }
      if (!response.ok || !json.success || !json.items?.[0]) {
        setFeedback({
          message: json.message || "Neizdevās ielādēt integrācijas.",
          variant: "error",
        });
        return;
      }
      const next = json.items[0];
      setItem(next);
      setFromEmail(next.fromEmail);
      setReplyToEmail(next.replyToEmail);
      setApiKey("");
    });
    return () => {
      ignore = true;
    };
  }, [csrfToken]);

  const isDirty =
    item !== null &&
    (fromEmail.trim() !== item.fromEmail ||
      replyToEmail.trim() !== item.replyToEmail ||
      apiKey.trim().length > 0);

  function applyItem(next: IntegrationItem, message: string) {
    setItem(next);
    setFromEmail(next.fromEmail);
    setReplyToEmail(next.replyToEmail);
    setApiKey("");
    setFeedback({ message, variant: "success" });
  }

  async function patch(body: Record<string, unknown>, message: string, action: "save" | "toggle" | "reset") {
    await runPendingAction(action, setPendingAction, async () => {
      const response = await fetch("/api/admin/integrations", {
        method: "PATCH",
        headers: adminMutationHeaders(csrfToken),
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as {
        success?: boolean;
        message?: string;
        item?: IntegrationItem;
      };
      if (!response.ok || !json.success || !json.item) {
        setFeedback({
          message: json.message || "Neizdevās saglabāt integrāciju.",
          variant: "error",
        });
        return;
      }
      applyItem(json.item, message);
    });
  }

  const statusLabel =
    item?.enabled && item.configured
      ? "Ieslēgts"
      : item?.configured
        ? "Konfigurēts"
        : "Nav iestatīts";

  return (
    <>
      {feedback ? (
        <FeedbackToast
          message={feedback.message}
          variant={feedback.variant}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      <section className={cardClassName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900">Resend</h2>
              <span className={statusBadgeClassName(Boolean(item?.enabled && item.configured))}>
                {item ? statusLabel : "Ielādē..."}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              E-pasta sūtīšana caur Resend. Sūtītāja adrese un API atslēga.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(item?.enabled)}
            aria-label="Ieslēgt Resend"
            disabled={isBusy || !item?.configured}
            onClick={() => {
              if (!item) {
                return;
              }
              void patch(
                { key: "resend", enabled: !item.enabled },
                item.enabled ? "Integrācija izslēgta." : "Integrācija ieslēgta.",
                "toggle",
              );
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              item?.enabled ? "bg-emerald-600" : "bg-zinc-300"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                item?.enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-5 space-y-4 border-t border-zinc-100 pt-5">
          <div>
            <label htmlFor="resend-from" className={labelClassName}>
              Sūtītāja e-pasts
            </label>
            <IconInput
              id="resend-from"
              type="email"
              autoComplete="off"
              value={fromEmail}
              disabled={isBusy || !item}
              onChange={(event) => setFromEmail(event.target.value)}
              placeholder="hello@example.com"
              icon={<IconMail className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div>
            <label htmlFor="resend-key" className={labelClassName}>
              API atslēga
            </label>
            <PasswordInput
              id="resend-key"
              autoComplete="new-password"
              value={apiKey}
              disabled={isBusy || !item}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={item?.hasSecret ? "Atstājiet tukšu, ja atslēgu nemaināt" : "re_..."}
              wrapperClassName="mt-1"
            />
            <p className="mt-1 text-xs text-zinc-500">
              {item?.hasSecret
                ? "Atslēga ir saglabāta. Tukšs lauks to nemaina."
                : "Obligāta, lai konfigurētu integrāciju."}
            </p>
          </div>
          <div>
            <label htmlFor="resend-reply" className={labelClassName}>
              Reply-To e-pasts
            </label>
            <IconInput
              id="resend-reply"
              type="email"
              autoComplete="off"
              value={replyToEmail}
              disabled={isBusy || !item}
              onChange={(event) => setReplyToEmail(event.target.value)}
              placeholder="hello@example.com"
              icon={<IconMail className="size-4" />}
              wrapperClassName="mt-1"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton
              type="button"
              variant="secondary"
              disabled={isBusy || !item?.configured}
              loading={pendingAction === "reset"}
              onClick={() => setConfirmReset(true)}
            >
              Atiestatīt
            </ActionButton>
            <ActionButton
              type="button"
              icon={<IconSave />}
              disabled={isBusy || !item || !isDirty}
              loading={pendingAction === "save"}
              onClick={() =>
                void patch(
                  {
                    key: "resend",
                    fromEmail,
                    apiKey,
                    keepSecret: apiKey.trim().length === 0,
                    replyToEmail,
                  },
                  "Integrācija saglabāta.",
                  "save",
                )
              }
            >
              Saglabāt
            </ActionButton>
          </div>
        </div>
      </section>

      {confirmReset ? (
        <ConfirmCloseDialog
          title="Atiestatīt integrāciju?"
          message="Sūtītāja e-pasts, API atslēga un ieslēgtais statuss tiks notīrīti."
          confirmLabel="Atiestatīt"
          confirmVariant="danger"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            void patch({ key: "resend", reset: true }, "Integrācija atiestatīta.", "reset");
          }}
        />
      ) : null}
    </>
  );
}
