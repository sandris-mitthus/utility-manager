export const ADMIN_MUTATION_HEADER = "X-Utility-Manager-CSRF";

export function adminMutationHeaders(csrfToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    [ADMIN_MUTATION_HEADER]: csrfToken,
  };
}
