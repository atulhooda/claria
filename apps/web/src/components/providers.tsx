"use client";

import * as React from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { QueryClientProvider, isServer } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

import { makeQueryClient } from "@/lib/query-client";
import { clientEnv } from "@/lib/env";
import { setClientTokenGetter } from "@/lib/api/auth";
import { TooltipProvider } from "@/components/ui/tooltip";

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined;

function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

/**
 * Bridges Clerk's `useAuth().getToken` into the framework-agnostic API
 * client. Mounted as a child of <ClerkProvider> so the hook is available;
 * registers a getter once and clears it on unmount.
 */
function ClerkApiTokenBridge() {
  const { getToken } = useAuth();
  React.useEffect(() => {
    setClientTokenGetter(() => getToken());
    return () => setClientTokenGetter(null);
  }, [getToken]);
  return null;
}

/**
 * Matches Clerk's UI to our theme so the hosted sign-in / sign-up forms
 * don't look like a foreign island in dark mode.
 */
function useClerkAppearance() {
  const { resolvedTheme } = useTheme();
  return React.useMemo(
    () => ({
      baseTheme: resolvedTheme === "dark" ? undefined : undefined,
      variables: {
        colorPrimary:
          resolvedTheme === "dark" ? "hsl(36 30% 90%)" : "hsl(28 26% 16%)",
        colorBackground:
          resolvedTheme === "dark" ? "hsl(28 18% 10%)" : "hsl(36 34% 96%)",
        borderRadius: "0.5rem",
      },
      elements: {
        card: "shadow-elevated border border-border",
      },
    }),
    [resolvedTheme],
  );
}

function ThemedClerkProvider({ children }: { children: React.ReactNode }) {
  const appearance = useClerkAppearance();
  return (
    <ClerkProvider
      publishableKey={clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={clientEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={clientEnv.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={
        clientEnv.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
      }
      signUpFallbackRedirectUrl={
        clientEnv.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
      }
      appearance={appearance}
    >
      <ClerkApiTokenBridge />
      {children}
    </ClerkProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const showDevtools = clientEnv.NEXT_PUBLIC_APP_ENV !== "production";

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <ThemedClerkProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={150} skipDelayDuration={400}>
            {children}
          </TooltipProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "border border-border-strong bg-surface-1 text-foreground shadow-elevated",
                description: "text-muted-foreground",
                actionButton: "bg-primary text-primary-foreground",
                cancelButton: "bg-muted text-muted-foreground",
              },
            }}
          />
          {showDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        </QueryClientProvider>
      </ThemedClerkProvider>
    </ThemeProvider>
  );
}
