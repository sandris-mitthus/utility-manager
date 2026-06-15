export function getSupabaseStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

export function isOurSupabaseAuthCookie(
  cookieName: string,
  storageKey: string,
): boolean {
  if (cookieName === storageKey || cookieName.startsWith(`${storageKey}.`)) {
    return true;
  }

  return cookieName === `${storageKey}-code-verifier`;
}

export function listForeignSupabaseCookieNames(
  cookies: { name: string }[],
  storageKey: string,
): string[] {
  return cookies
    .map(({ name }) => name)
    .filter(
      (name) =>
        name.startsWith("sb-") && !isOurSupabaseAuthCookie(name, storageKey),
    );
}
