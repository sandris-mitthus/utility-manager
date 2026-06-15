export const ADMIN_MUTATION_HEADER = "X-Utility-Manager-Request";
export const ADMIN_MUTATION_HEADER_VALUE = "1";

export function requireAdminMutation(request: Request): Response | null {
  if (request.headers.get(ADMIN_MUTATION_HEADER) !== ADMIN_MUTATION_HEADER_VALUE) {
    return Response.json(
      { success: false, message: "Nederīgs pieprasījums." },
      { status: 403 },
    );
  }

  return null;
}

export function adminMutationHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    [ADMIN_MUTATION_HEADER]: ADMIN_MUTATION_HEADER_VALUE,
  };
}
