"use client";

import * as React from "react";
import { notFound, useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import {
  getMockConsultation,
  SAMPLE_CONSULTATION_ID,
} from "@/lib/mocks/consultation";
import { useConsultationDetail } from "@/lib/api/consultations";
import { WorkspaceClient } from "./workspace-client";

interface PageProps {
  params: { id: string };
}

/**
 * Workspace router. Three flows:
 *   - Mock id ("sample-001"): cinematic demo, in-memory.
 *   - Live API consultation (status="live"): mount the live workspace.
 *   - Completed/reviewed: redirect to the read-only review page.
 *
 * This is a client component because it depends on the API status to
 * decide whether to show the workspace or send the user to review.
 */
export default function ConsultationWorkspacePage({ params }: PageProps) {
  const { id } = React.use(
    // Next 15's typed routes return `params` as a synchronous object in
    // client components — but the prop is typed as `Promise<...>` from
    // the server-component contract. React.use() works for both.
    params as unknown as Promise<{ id: string }>,
  );

  // Mock path — short-circuit; never touches the API.
  if (id === SAMPLE_CONSULTATION_ID) {
    const mock = getMockConsultation(id);
    if (!mock) notFound();
    return <WorkspaceClient consultation={mock} mode="mock" />;
  }

  return <ApiBackedWorkspace id={id} />;
}

function ApiBackedWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, isLoading } = useConsultationDetail(id);

  // Once the consultation is no longer live, send the user to review.
  React.useEffect(() => {
    if (data && data.status !== "live") {
      router.replace(`/consultations/${id}/review`);
    }
  }, [data, id, router]);

  if (isLoading) return <CenteredSpinner />;
  if (error) {
    if (/not.found|404/i.test(error.message)) notFound();
    return (
      <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Could not load consultation: {error.message}
      </div>
    );
  }
  if (!data || data.status !== "live") return <CenteredSpinner />;

  // Construct a MockConsultation-shaped object from the API payload so the
  // existing WorkspaceClient signature stays unchanged. The live hook
  // populates the rest at runtime; this just seeds patient meta + ids.
  const seed = {
    id: data.id,
    status: "in-progress" as const,
    startedAtSec: 0,
    patient: {
      name: data.patient.name || "New consultation",
      age: data.patient.age ?? 0,
      pronouns: data.patient.pronouns || "—",
      mrn: data.patient.mrn || data.id,
      chiefComplaint:
        data.patient.chiefComplaint ||
        "Reason for visit will appear as the AI extracts it from the conversation.",
      visitDate: data.patient.visitDate || new Date().toISOString().slice(0, 10),
    },
    transcript: [],
    soap: [
      { label: "S" as const, title: "Subjective", body: "", confidence: 0 },
      { label: "O" as const, title: "Objective", body: "", confidence: 0 },
      { label: "A" as const, title: "Assessment", body: "", confidence: 0 },
      { label: "P" as const, title: "Plan", body: "", confidence: 0 },
    ],
    symptoms: [],
    medications: [],
    vitals: [],
    timeline: [],
  };

  return <WorkspaceClient consultation={seed} mode="live" />;
}

function CenteredSpinner() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
