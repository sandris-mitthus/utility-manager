export const inputClassName =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export const selectClassName =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export const labelClassName = "block text-sm font-medium text-zinc-700";

export const cardClassName =
  "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm";

export const tableClassName = "min-w-full divide-y divide-zinc-200 text-sm";

export const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100";

export const tabButtonClassName = (active: boolean) =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-zinc-900 text-white"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
  }`;

export const statusBadgeClassName = (ok: boolean) =>
  `inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
    ok
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  }`;
