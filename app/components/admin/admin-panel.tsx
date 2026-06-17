"use client";

import { useMemo, useState } from "react";
import { AdminEmailTab } from "@/app/components/admin/admin-email-tab";
import { AdminClientsTab } from "@/app/components/admin/admin-clients-tab";
import { AdminMetersTab } from "@/app/components/admin/admin-meters-tab";
import { AdminSettingsTab } from "@/app/components/admin/admin-settings-tab";
import { AdminSubmissionsTab } from "@/app/components/admin/admin-submissions-tab";
import { tabButtonClassName } from "@/app/components/ui/form-styles";
import {
  IconChart,
  IconGauge,
  IconLogOut,
  IconMail,
  IconSettings,
  IconUsers,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { signOutAdmin } from "@/app/lib/auth/sign-out-admin";
import type { AdminUser } from "@/app/lib/auth/admin-types";
import type { EmailFetchState, EmailInboxMessage } from "@/app/lib/utility/types";

const ADMIN_TABS = [
  { id: "submissions", label: "Rādījumi", icon: <IconChart /> },
  { id: "email", label: "E-pasts", icon: <IconMail /> },
  { id: "clients", label: "Klienti", icon: <IconUsers /> },
  { id: "meters", label: "Skaitītāji", icon: <IconGauge /> },
  { id: "settings", label: "Iestatījumi", icon: <IconSettings /> },
] as const;

type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

type AdminPanelProps = {
  admin: AdminUser;
  initialEmailInbox: {
    messages: EmailInboxMessage[];
    fetchState: EmailFetchState;
  } | null;
};

export function AdminPanel({ admin, initialEmailInbox }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTabId>("submissions");
  const [signingOut, setSigningOut] = useState(false);

  const content = useMemo(() => {
    switch (activeTab) {
      case "email":
        return <AdminEmailTab initialInbox={initialEmailInbox} />;
      case "clients":
        return <AdminClientsTab />;
      case "meters":
        return <AdminMetersTab />;
      case "settings":
        return <AdminSettingsTab />;
      case "submissions":
      default:
        return <AdminSubmissionsTab />;
    }
  }, [activeTab, initialEmailInbox]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutAdmin();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={tabButtonClassName(activeTab === tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="min-w-0 px-2 py-1 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Administrācija
            </p>
            <p className="truncate text-sm text-zinc-700">{admin.email}</p>
          </div>
          <TooltipIconButton
            tooltip="Iziet"
            icon={<IconLogOut className="size-4" />}
            variant="none"
            onClick={handleSignOut}
            disabled={signingOut}
          />
        </div>
      </div>

      {content}
    </div>
  );
}
