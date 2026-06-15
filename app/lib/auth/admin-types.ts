export type AdminUser = {
  id: string;
  email: string;
  authUserId: string | null;
};

export type AdminAccess =
  | { status: "authenticated"; admin: AdminUser }
  | { status: "unauthenticated" }
  | { status: "forbidden"; email: string };
