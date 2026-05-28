/**
 * Dev-mode stand-in for `@clerk/nextjs` (browser/client surface).
 *
 * Activated via webpack alias in `next.config.mjs` when
 * `NEXT_PUBLIC_AUTH_BYPASS=true`. Renders the app as if a user is signed
 * in so the UI shell, dashboard, and consultation workspace are
 * inspectable without real Clerk keys.
 *
 * Remove the alias (or unset the flag) to restore the real Clerk client.
 */

import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const MOCK_USER_ID = "user_dev_bypass";
const MOCK_TOKEN: string | null = null;

export function ClerkProvider({
  children,
}: {
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return <>{children}</>;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SignedOut(_props: { children: React.ReactNode }) {
  return null;
}

export function UserButton(_props: Record<string, unknown>) {
  return (
    <Avatar
      aria-label="dev-bypass user"
      title="Auth bypassed (dev mode)"
      className="h-8 w-8"
    >
      <AvatarFallback className="bg-primary text-primary-foreground">
        DV
      </AvatarFallback>
    </Avatar>
  );
}

function AuthBypassCard({ kind }: { kind: "Sign in" | "Sign up" }) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
      <div className="mb-3 inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Dev mode
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{kind} mocked</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Clerk is bypassed for local UI development. Continue straight to the
        dashboard.
      </p>
      <a
        href="/dashboard"
        className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Go to dashboard
      </a>
    </div>
  );
}

export function SignIn(_props: Record<string, unknown>) {
  return <AuthBypassCard kind="Sign in" />;
}

export function SignUp(_props: Record<string, unknown>) {
  return <AuthBypassCard kind="Sign up" />;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: MOCK_USER_ID,
    sessionId: "sess_dev_bypass",
    orgId: null,
    orgRole: null,
    orgSlug: null,
    has: () => false,
    signOut: async () => {},
    getToken: async () => MOCK_TOKEN,
  };
}

export function useUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: MOCK_USER_ID,
      firstName: "Dev",
      lastName: "User",
      fullName: "Dev User",
      primaryEmailAddress: { emailAddress: "dev@local" },
      imageUrl: "",
    },
  };
}

export function useClerk() {
  return {
    loaded: true,
    signOut: async () => {},
    openSignIn: () => {},
    openSignUp: () => {},
  };
}
