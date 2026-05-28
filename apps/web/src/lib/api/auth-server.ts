import "server-only";

import { auth } from "@clerk/nextjs/server";

/**
 * Server-side bearer-token retrieval for the typed API client.
 *
 * RSCs, server actions, and route handlers pass the result into
 * `apiFetch(path, { token: await getServerAuthToken() })`. The
 * `server-only` import marker fails the build if this file is ever
 * pulled into a Client Component.
 */
export async function getServerAuthToken(): Promise<string | null> {
  const session = await auth();
  return session.getToken();
}
