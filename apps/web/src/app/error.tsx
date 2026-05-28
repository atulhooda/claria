"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("root error boundary:", error);
    }
  }, [error]);

  const requestId = isApiError(error) ? error.requestId : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Unexpected error</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        {requestId ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
            request id: {requestId}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
