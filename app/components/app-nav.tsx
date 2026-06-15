"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserAvatar } from "@/app/components/user-avatar";
import { IconLogOut } from "@/app/components/ui/icons";
import { TooltipIconButton } from "@/app/components/ui/tooltip-button";
import type { UserDisplay } from "@/app/lib/auth/map-user-display";
import { signOut } from "@/app/lib/auth/sign-out";

const NAV_ITEMS = [{ href: "/", label: "Sākums" }] as const;

function NavUserSection({ user }: { user: UserDisplay }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
      <div className="hidden items-center gap-2.5 sm:flex">
        <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="xs" />
        <span className="max-w-[140px] truncate text-sm text-zinc-700">
          {user.name}
        </span>
      </div>
      <div className="sm:hidden">
        <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="xs" />
      </div>
      <TooltipIconButton
        tooltip="Iziet no sistēmas"
        icon={<IconLogOut className="size-4" />}
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label="Iziet no sistēmas"
      />
    </>
  );
}

type AppNavProps = {
  currentUser?: UserDisplay | null;
  appName?: string;
};

export function AppNav({ currentUser = null, appName = "Utility Manager" }: AppNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white">
      <div className="mx-auto flex h-[52px] max-w-[960px] items-stretch justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-stretch gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center text-sm font-semibold text-zinc-900"
          >
            {appName}
          </Link>
          <nav className="flex min-w-0 items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center border-b-2 px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {currentUser ? (
          <div className="flex shrink-0 items-center gap-2">
            <NavUserSection user={currentUser} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
