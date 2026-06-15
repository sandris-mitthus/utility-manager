export function getSafeRedirectPath(rawPath: string | null | undefined, fallback = "/") {
  if (!rawPath) return fallback;

  const path = rawPath.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("\\")) return fallback;
  if (path.includes("\0")) return fallback;

  try {
    const parsed = new URL(path, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
