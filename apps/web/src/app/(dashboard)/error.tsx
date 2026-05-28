"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("dashboard error boundary:", error);
    }
  }, [error]);

  const requestId = isApiError(error) ? error.requestId : null;

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="text-sm font-semibold text-foreground">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || "We couldn’t load this view."}
      </p>
      {requestId ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
          request id: {requestId}
        </p>
      ) : null}
      <div className="mt-4">
        <Button size="sm" variant="outline" onClick={reset}>
          Retry
        </Button>
      </div>
    </div>
  );
}
