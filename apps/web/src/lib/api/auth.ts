/**
 * Token-getter registry for the API client. Client-safe.
 *
 * The fetch wrapper in `client.ts` is framework-agnostic — it doesn't
 * import Clerk hooks directly. Instead it asks this registry for a token
 * on every request.
 *
 *  - On the browser, `<Providers>` registers Clerk's `useAuth().getToken`
 *    via `setClientTokenGetter()` once the provider mounts.
 *  - On the server (RSC, route handlers), callers pass a token explicitly
 *    via `RequestOptions.token` — obtain it from `getServerAuthToken()`
 *    in `auth-server.ts`. Kept in a separate module so this file never
 *    drags `@clerk/nextjs/server` into the client bundle.
 */

export type TokenGetter = () => Promise<string | null>;

let clientTokenGetter: TokenGetter | null = null;

export function setClientTokenGetter(getter: TokenGetter | null): void {
  clientTokenGetter = getter;
}

export async function getClientToken(): Promise<string | null> {
  if (!clientTokenGetter) return null;
  return clientTokenGetter();
}
