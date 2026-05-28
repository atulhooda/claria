import "@/app/globals.css";

import type { Metadata } from "next";

import { Providers } from "@/components/providers";

/**
 * Route-group layout for the printable surface.
 *
 * Deliberately bare — no dashboard sidebar, topnav, or ambient backdrop.
 * The dashboard chrome would print as a wasted page header, and the
 * report is meant to be filed/exported on its own.
 *
 * Auth still applies: the Clerk middleware matches /consultations(.*),
 * so unauthenticated requests get redirected the same as any other
 * dashboard route.
 */
export const metadata: Metadata = {
  title: "Consultation report",
};

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </Providers>
  );
}
