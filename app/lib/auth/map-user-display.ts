import type { User } from "@supabase/supabase-js";

export type UserDisplay = {
  name: string;
  avatarUrl: string | null;
};

export function readAvatarUrl(metadata: Record<string, unknown>): string | null {
  const avatar =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url.trim()) ||
    (typeof metadata.picture === "string" && metadata.picture.trim());

  return avatar || null;
}

export function mapUserDisplay(user: User): UserDisplay {
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "—";

  return {
    name,
    avatarUrl: readAvatarUrl(metadata),
  };
}
