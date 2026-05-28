/**
 * Dev-mode stand-in for `@clerk/nextjs/server`.
 *
 * Activated via webpack alias in `next.config.mjs` when
 * `NEXT_PUBLIC_AUTH_BYPASS=true`. Returns a fake signed-in session so
 * server components, route handlers, and middleware behave as if a user
 * is authenticated.
 *
 * Remove the alias (or unset the flag) to restore the real Clerk server.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MOCK_USER_ID = "user_dev_bypass";

type AuthObject = {
  userId: string | null;
  sessionId: string | null;
  orgId: string | null;
  getToken: () => Promise<string | null>;
  protect: () => Promise<void>;
};

function mockAuthObject(): AuthObject {
  return {
    userId: MOCK_USER_ID,
    sessionId: "sess_dev_bypass",
    orgId: null,
    getToken: async () => null,
    protect: async () => {},
  };
}

export async function auth(): Promise<AuthObject> {
  return mockAuthObject();
}

export async function currentUser() {
  return {
    id: MOCK_USER_ID,
    firstName: "Dev",
    lastName: "User",
    fullName: "Dev User",
    emailAddresses: [{ emailAddress: "dev@local" }],
    primaryEmailAddress: { emailAddress: "dev@local" },
    imageUrl: "",
  };
}

type MiddlewareHandler = (
  authFn: () => AuthObject,
  request: NextRequest,
) => Promise<Response | void> | Response | void;

export function clerkMiddleware(handler?: MiddlewareHandler) {
  return async (request: NextRequest) => {
    if (handler) {
      const result = await handler(() => mockAuthObject(), request);
      if (result) return result;
    }
    return NextResponse.next();
  };
}

export function createRouteMatcher(_patterns: string[] | RegExp[]) {
  return (_req: NextRequest) => false;
}
