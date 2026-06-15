"use client";

import { useMemo, useState } from "react";
import { AdminClientsTab } from "@/app/components/admin/admin-clients-tab";
import { AdminMetersTab } from "@/app/components/admin/admin-meters-tab";
import { AdminSettingsTab } from "@/app/components/admin/admin-settings-tab";
import { AdminSubmissionsTab } from "@/app/components/admin/admin-submissions-tab";
import {
  IconChart,
  IconGauge,
  IconSettings,
  IconUsers,
} from "@/app/components/ui/icons";
import { tabButtonClassName } from "@/app/components/ui/form-styles";

const ADMIN_TABS = [
  { id: "submissions", label: "Rādījumi", icon: <IconChart /> },
  { id: "clients", label: "Klienti", icon: <IconUsers /> },
  { id: "meters", label: "Skaitītāji", icon: <IconGauge /> },
  { id: "settings", label: "Iestatījumi", icon: <IconSettings /> },
] as const;

type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("submissions");

  const content = useMemo(() => {
    switch (activeTab) {
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
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
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
      {content}
    </div>
  );
}
