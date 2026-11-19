"use client";

import { useEffect, useState } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import { ActionButton } from "@/app/components/ui/action-button";
import { ConfirmCloseDialog } from "@/app/components/ui/confirm-close-dialog";
import { FeedbackToast, type FeedbackToastVariant } from "@/app/components/ui/feedback-toast";
import { cardClassName, labelClassName, statusBadgeClassName } from "@/app/components/ui/form-styles";
import { IconInput, PasswordInput } from "@/app/components/ui/icon-input";
import { IconCopy, IconLink, IconRefresh } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { adminMutationHeaders } from "@/app/lib/security/admin-api";
import { runPendingAction } from "@/app/lib/run-pending-action";
import { VOICE_AGENT_TOOLSET } from "@/app/lib/utility/voice-agent-tools";

type Access = { key: string; enabled: boolean };

type FeedbackState = {
  message: string;
  variant: FeedbackToastVariant;
};

export function AdminApiTab() {
  const { csrfToken } = useAdminData();
  const [access, setAccess] = useState<Access | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [pendingAction, setPendingAction] = useState<"load" | "toggle" | "rotate" | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const isBusy = pendingAction !== null;

  useEffect(() => {
    let ignore = false;
    void runPendingAction("load", setPendingAction, async () => {
      const response = await fetch("/api/admin/voice-agent", {
        headers: adminMutationHeaders(csrfToken),
      });
      const json = (await response.json()) as { success?: boolean; message?: string; access?: Access; endpoint?: string };
      if (ignore) {
        return;
      }
      if (!response.ok || !json.success || !json.access) {
        setFeedback({ message: json.message || "Neizdevās ielādēt API piekļuvi.", variant: "error" });
        return;
      }
      setAccess(json.access);
      setEndpoint(json.endpoint ?? "");
    });
    return () => {
      ignore = true;
    };
  }, [csrfToken]);

  async function patch(body: Record<string, unknown>, message: string, action: "toggle" | "rotate") {
    await runPendingAction(action, setPendingAction, async () => {
      const response = await fetch("/api/admin/voice-agent", {
        method: "PATCH",
        headers: adminMutationHeaders(csrfToken),
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { success?: boolean; message?: string; access?: Access };
      if (!response.ok || !json.success || !json.access) {
        setFeedback({ message: json.message || "Neizdevās saglabāt API piekļuvi.", variant: "error" });
        return;
      }
      setAccess(json.access);
      setFeedback({ message, variant: "success" });
    });
  }

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback({ message, variant: "success" });
    } catch {
      setFeedback({ message: "Neizdevās nokopēt.", variant: "error" });
    }
  }

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
              <h2 className="text-base font-semibold text-zinc-900">AI Receptionist</h2>
              <span className={statusBadgeClassName(Boolean(access?.enabled))}>
                {access ? (access.enabled ? "Ieslēgts" : "Izslēgts") : "Ielādē..."}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Telefona aģents pieņem skaitītāju rādījumus zvanā. Rādījumi tiek pārbaudīti un saglabāti tāpat kā no mājaslapas.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(access?.enabled)}
            aria-label="Ieslēgt API piekļuvi"
            disabled={isBusy || !access}
            onClick={() => {
              if (!access) {
                return;
              }
              void patch(
                { enabled: !access.enabled },
                access.enabled ? "API piekļuve izslēgta." : "API piekļuve ieslēgta.",
                "toggle",
              );
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              access?.enabled ? "bg-emerald-600" : "bg-zinc-300"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                access?.enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-5 space-y-4 border-t border-zinc-100 pt-5">
          <div>
            <label htmlFor="voice-agent-url" className={labelClassName}>
              API adrese
            </label>
            <div className="mt-1 flex items-center gap-2">
              <IconInput
                id="voice-agent-url"
                readOnly
                value={endpoint}
                icon={<IconLink className="size-4" />}
                wrapperClassName="flex-1"
              />
              <TooltipIconButton
                tooltip="Kopēt adresi"
                icon={<IconCopy />}
                disabled={!endpoint}
                onClick={() => void copy(endpoint, "Adrese nokopēta.")}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              AI Receptionist aģenta laukā „Datu sistēma”. Aģentam jāsasniedz publiskā adrese, nevis localhost.
            </p>
          </div>
          <div>
            <label htmlFor="voice-agent-key" className={labelClassName}>
              Piekļuves atslēga
            </label>
            <div className="mt-1 flex items-center gap-2">
              <PasswordInput
                id="voice-agent-key"
                readOnly
                autoComplete="off"
                value={access?.key ?? ""}
                wrapperClassName="flex-1"
              />
              <TooltipIconButton
                tooltip="Kopēt atslēgu"
                icon={<IconCopy />}
                disabled={!access?.key}
                onClick={() => void copy(access?.key ?? "", "Atslēga nokopēta.")}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              AI Receptionist aģenta laukā „Piekļuves atslēga”. Ar jaunu atslēgu vecā vairs nedarbojas.
            </p>
          </div>
          <div>
            <p className={labelClassName}>Aģenta darbības</p>
            <ul className="mt-1 space-y-1 text-sm text-zinc-700">
              {VOICE_AGENT_TOOLSET.tools.map((tool) => (
                <li key={tool.name}>
                  <span className="font-mono text-xs text-zinc-500">{tool.name}</span> {tool.description}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton
              type="button"
              variant="secondary"
              icon={<IconRefresh />}
              disabled={isBusy || !access}
              loading={pendingAction === "rotate"}
              onClick={() => setConfirmRotate(true)}
            >
              Jauna atslēga
            </ActionButton>
          </div>
        </div>
      </section>

      {confirmRotate ? (
        <ConfirmCloseDialog
          title="Ģenerēt jaunu atslēgu?"
          message="Vecā atslēga uzreiz pārstās darboties. Jaunā atslēga būs jāielīmē AI Receptionist aģentā."
          confirmLabel="Ģenerēt"
          confirmVariant="danger"
          onCancel={() => setConfirmRotate(false)}
          onConfirm={() => {
            setConfirmRotate(false);
            void patch({ rotate: true }, "Jauna atslēga izveidota.", "rotate");
          }}
        />
      ) : null}
    </>
  );
}
