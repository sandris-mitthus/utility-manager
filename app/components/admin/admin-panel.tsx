"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAdminData } from "@/app/components/admin-data-provider";
import { FittingEmail } from "@/app/components/ui/fitting-email";
import { tabButtonClassName } from "@/app/components/ui/form-styles";
import {
  IconChart,
  IconChat,
  IconGauge,
  IconLink,
  IconLogOut,
  IconMail,
  IconPhone,
  IconSettings,
  IconUsers,
} from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import { signOutAdmin } from "@/app/lib/auth/sign-out-admin";
import { minimumEmailLabel } from "@/app/lib/fit-email";

const ADMIN_TABS = [
  { href: "/admin/submissions", label: "Rādījumi", icon: <IconChart /> },
  { href: "/admin/clients", label: "Klienti", icon: <IconUsers /> },
  { href: "/admin/meters", label: "Skaitītāji", icon: <IconGauge /> },
] as const;

const SETTINGS_TABS = [
  { href: "/admin/settings", label: "Iestatījumi", icon: <IconSettings /> },
  { href: "/admin/email", label: "E-pasts", icon: <IconMail /> },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: <IconChat /> },
  { href: "/admin/integrations", label: "Integrācijas", icon: <IconLink /> },
  { href: "/admin/api", label: "API", icon: <IconPhone /> },
] as const;

function measureText(font: string) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) {
    return (text: string) => text.length * 8;
  }

  context.font = font;
  return (text: string) => context.measureText(text).width;
}

export function AdminPanel({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const settingsActive = SETTINGS_TABS.some((tab) => pathname === tab.href);
  const { admin } = useAdminData();
  const [signingOut, setSigningOut] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const logoutRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [emailWidth, setEmailWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const email = emailRef.current;
    const account = accountRef.current;
    const logout = logoutRef.current;
    const tabs = tabsRef.current;
    if (!bar || !email || !account || !logout || !tabs) {
      return;
    }

    const fit = () => {
      const style = getComputedStyle(email);
      const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const measure = measureText(font);
      const barStyle = getComputedStyle(bar);
      const accountStyle = getComputedStyle(account);
      const barGap = Number.parseFloat(barStyle.columnGap || "0") || 0;
      const accountGap = Number.parseFloat(accountStyle.columnGap || "0") || 0;
      const padding =
        (Number.parseFloat(barStyle.paddingLeft) || 0) +
        (Number.parseFloat(barStyle.paddingRight) || 0);
      const fullWidth = measure(admin.email);
      const minimumWidth = measure(minimumEmailLabel(admin.email));
      const available =
        bar.clientWidth - padding - tabs.scrollWidth - logout.offsetWidth - barGap - accountGap;
      const nextWidth = Math.ceil(Math.min(fullWidth, Math.max(minimumWidth, available)));
      setEmailWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [admin.email]);

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
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div
        ref={barRef}
        className="flex items-center gap-3 p-2"
      >
        <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div ref={tabsRef} className="flex w-max items-center gap-2">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={pathname === tab.href ? "page" : undefined}
              className={tabButtonClassName(pathname === tab.href)}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
          <Link
            href="/admin/settings"
            aria-current={settingsActive ? "page" : undefined}
            className={tabButtonClassName(settingsActive)}
          >
            <IconSettings />
            Iestatījumi
          </Link>
          </div>
        </div>

        <div ref={accountRef} className="flex shrink-0 items-center gap-2">
          <div
            ref={emailRef}
            className="min-w-0 text-right text-sm text-zinc-700"
            style={emailWidth ? { width: emailWidth } : undefined}
          >
            <p className="truncate text-xs font-medium uppercase tracking-wide text-zinc-500">
              Administrācija
            </p>
            <FittingEmail email={admin.email} className="text-right text-sm text-zinc-700" />
          </div>
          <div ref={logoutRef} className="shrink-0">
            <TooltipIconButton
              tooltip="Iziet"
              icon={<IconLogOut className="size-4" />}
              variant="none"
              onClick={handleSignOut}
              disabled={signingOut}
            />
          </div>
        </div>
      </div>
        {settingsActive ? (
          <div className="flex gap-2 overflow-x-auto border-t border-zinc-100 px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SETTINGS_TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={pathname === tab.href ? "page" : undefined}
                className={tabButtonClassName(pathname === tab.href)}
              >
                {tab.icon}
                {tab.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
