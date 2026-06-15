import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/app/lib/supabase/env";
import {
  getSupabaseStorageKey,
  listForeignSupabaseCookieNames,
} from "@/app/lib/supabase/storage-key";

const cookieRemoveOptions = {
  path: "/",
  maxAge: 0,
  sameSite: "lax" as const,
};

function purgeForeignSupabaseCookies(
  request: NextRequest,
  response: NextResponse,
  storageKey: string,
) {
  for (const name of listForeignSupabaseCookieNames(
    request.cookies.getAll(),
    storageKey,
  )) {
    response.cookies.set(name, "", cookieRemoveOptions);
  }
}

export async function updateSession(request: NextRequest) {
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.next({ request });
  }

  const storageKey = getSupabaseStorageKey(env.url);
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        purgeForeignSupabaseCookies(request, supabaseResponse, storageKey);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  purgeForeignSupabaseCookies(request, supabaseResponse, storageKey);

  if (pathname.startsWith("/api/admin") && !user) {
    return NextResponse.json(
      { success: false, message: "Nepieciešama administratora pieslēgšanās." },
      { status: 401 },
    );
  }

  return supabaseResponse;
}
