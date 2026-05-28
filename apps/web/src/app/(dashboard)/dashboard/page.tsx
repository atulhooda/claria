import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyConsultationState } from "@/components/consultation/empty-state";

export const metadata: Metadata = {
  title: "Dashboard",
};

const summary = [
  { label: "Consultations today", value: "0" },
  { label: "Drafted notes", value: "0" },
  { label: "Awaiting review", value: "0" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Your day at a glance. Start a consultation to see live transcription and notes.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">
                {stat.label}
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Live metrics arrive once consultations land in the database.
            </CardContent>
          </Card>
        ))}
      </div>

      <EmptyConsultationState />
    </div>
  );
}
