export const inputClassName =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export const iconInputClassName =
  "block w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export const selectClassName =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export const iconSelectClassName =
  "block w-full appearance-none rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export const labelClassName = "block text-sm font-medium text-zinc-700";

export const cardClassName =
  "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm";

export const tableClassName = "min-w-full divide-y divide-zinc-200 text-sm";

export const modalFooterClassName =
  "flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-100 px-6 py-4";

export const confirmDialogFooterClassName = "mt-6 flex flex-wrap justify-end gap-2";

export const primaryButtonClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50";

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
