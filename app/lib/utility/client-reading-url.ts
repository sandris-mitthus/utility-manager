export function buildClientReadingUrl(publicToken: string, origin?: string): string {
  const base = (
    origin ??
    (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? "")
  ).replace(/\/$/, "");

  return `${base}/r/${encodeURIComponent(publicToken)}`;
}
