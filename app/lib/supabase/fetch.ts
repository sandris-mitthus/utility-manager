const SUPABASE_DOWN =
  "Supabase serveris neatbild (Cloudflare 521). Atveriet projektu Supabase panelī un ieslēdziet to, ja tas ir apturēts.";

const SUPABASE_UNREACHABLE =
  "Neizdevās sasniegt Supabase. Pārbaudiet NEXT_PUBLIC_SUPABASE_URL un vai projekts ir aktīvs.";

export function readableSupabaseError(message: string | undefined): string {
  const text = message?.replace(/\s+/g, " ").trim() ?? "";

  if (!text) {
    return "Neizdevās nolasīt datus no Supabase.";
  }

  if (
    text.includes("Error code 521") ||
    text.includes("Web server is down") ||
    text.includes("error-521") ||
    text.includes("Error 521")
  ) {
    return SUPABASE_DOWN;
  }

  if (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("<title>")) {
    return "Supabase atbildēja ar kļūdas lapu, nevis ar datiem.";
  }

  if (text.includes("fetch failed") || text.includes("ENOTFOUND")) {
    return SUPABASE_UNREACHABLE;
  }

  if (text.length > 500) {
    return "Neizdevās nolasīt datus no Supabase.";
  }

  return text;
}

function jsonErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ message, details: "", hint: "", code: String(status) }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

function networkMessage(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code ?? "")
      : "";

  if (code === "ENOTFOUND") {
    return SUPABASE_UNREACHABLE;
  }

  return readableSupabaseError(error instanceof Error ? error.message : undefined);
}

export async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    return jsonErrorResponse(503, networkMessage(error));
  }

  const cloudflareStatus = response.status >= 520 && response.status <= 530;

  if (response.ok || (response.status < 500 && !cloudflareStatus)) {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const mayBeOutagePage =
    cloudflareStatus ||
    contentType.includes("text/html") ||
    contentType.includes("text/plain") ||
    contentType.includes("problem+json");

  if (!mayBeOutagePage) {
    return response;
  }

  const body = await response.text();
  const message = readableSupabaseError(body);
  const isHtml = body.includes("<!DOCTYPE") || body.includes("<html");
  const isCloudflare = body.includes("cloudflare.com") || cloudflareStatus;

  if (!isHtml && !isCloudflare && message === body.replace(/\s+/g, " ").trim()) {
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return jsonErrorResponse(response.status || 503, message);
}
