"use client";

import * as React from "react";
import { Loader2Icon, PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import {
  useConsultationDetail,
  type ConsultationDetail,
  type MedicationPayload,
  type SoapSectionPayload,
  type SymptomPayload,
  type TimelineEventPayload,
  type TranscriptLinePayload,
} from "@/lib/api/consultations";

interface PageProps {
  params: { id: string };
}

/**
 * Printable consultation report.
 *
 * Doctor clicks "Export PDF" on the review page → this opens in a new
 * tab → the print toolbar at the top (hidden when printing) triggers
 * the browser's print dialog → save as PDF.
 *
 * All layout decisions are driven by the print stylesheet at the
 * bottom of this file: A4 page size, generous margins, page-break
 * hints between major sections, monochrome-tolerant colors.
 */
export default function ReportPage({ params }: PageProps) {
  const { id } = React.use(
    params as unknown as Promise<{ id: string }>,
  );
  const { data, error, isLoading } = useConsultationDetail(id);

  React.useEffect(() => {
    // Set the title so the saved PDF gets a sensible default filename.
    if (data) {
      const name = data.patient.name || "Untitled";
      const date = data.startedAt.slice(0, 10);
      document.title = `Claria report · ${name} · ${date}`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Could not load report: {error.message}
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      {/* Floating toolbar — hidden when printing via the @media print rule below. */}
      <div className="report-toolbar sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/85 px-6 py-3 backdrop-blur">
        <Brand href={`/consultations/${id}/review`} />
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <PrinterIcon className="h-3.5 w-3.5" />
          Print or save as PDF
        </Button>
      </div>

      <article className="report-page mx-auto max-w-[820px] px-12 pb-16 pt-10 text-foreground">
        <ReportHeader data={data} />
        <ReportSummary summary={data.summary} chiefComplaint={data.patient.chiefComplaint} />
        <ReportSoap soap={data.soap} />
        <ReportSection title="Symptoms">
          {data.symptoms.length === 0 ? (
            <EmptyHint>No symptoms extracted.</EmptyHint>
          ) : (
            <SymptomList items={data.symptoms} />
          )}
        </ReportSection>
        <ReportSection title="Medications">
          {data.medications.length === 0 ? (
            <EmptyHint>No medications mentioned.</EmptyHint>
          ) : (
            <MedicationList items={data.medications} />
          )}
        </ReportSection>
        <ReportSection title="Timeline">
          {data.timeline.length === 0 ? (
            <EmptyHint>No timeline events recorded.</EmptyHint>
          ) : (
            <TimelineList items={data.timeline} />
          )}
        </ReportSection>
        <ReportSection title="Verbatim transcript" pageBreakBefore>
          {data.transcript.length === 0 ? (
            <EmptyHint>No transcript captured.</EmptyHint>
          ) : (
            <TranscriptList items={data.transcript} />
          )}
        </ReportSection>
        <ReportFooter data={data} />
      </article>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 16mm 14mm;
        }
        @media print {
          .report-toolbar {
            display: none !important;
          }
          .report-page {
            padding: 0 !important;
            max-width: none !important;
          }
          .report-section {
            break-inside: avoid;
          }
          .report-page-break-before {
            break-before: page;
          }
          html,
          body {
            background: white !important;
          }
        }
      `}</style>
    </>
  );
}

/* ─────────────── building blocks ─────────────── */

function ReportHeader({ data }: { data: ConsultationDetail }) {
  return (
    <header className="mb-10 flex items-start justify-between border-b border-border pb-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Clinical consultation report
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">
          {data.patient.name || "Untitled consultation"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[
            data.patient.age ? `${data.patient.age} years` : null,
            data.patient.pronouns,
            data.patient.mrn,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-right text-[11px] text-muted-foreground">
        <dt className="font-medium">Visit date</dt>
        <dd className="font-mono tabular-nums text-foreground">
          {data.patient.visitDate || data.startedAt.slice(0, 10)}
        </dd>
        <dt className="font-medium">Started</dt>
        <dd className="font-mono tabular-nums text-foreground">
          {formatDateTime(data.startedAt)}
        </dd>
        {data.endedAt ? (
          <>
            <dt className="font-medium">Duration</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {formatDuration(data.durationSec)}
            </dd>
          </>
        ) : null}
      </dl>
    </header>
  );
}

function ReportSummary({
  summary,
  chiefComplaint,
}: {
  summary: string;
  chiefComplaint: string | null;
}) {
  if (!summary && !chiefComplaint) return null;
  return (
    <section className="report-section mb-10">
      <SectionLabel>Summary</SectionLabel>
      {summary ? (
        <p className="text-[15px] leading-[1.7] text-foreground/90">{summary}</p>
      ) : null}
      {chiefComplaint && !summary ? (
        <p className="text-[15px] leading-[1.7] text-foreground/85">
          <span className="font-semibold">Chief complaint:</span> {chiefComplaint}
        </p>
      ) : null}
    </section>
  );
}

const SOAP_TITLES: Record<"S" | "O" | "A" | "P", string> = {
  S: "Subjective",
  O: "Objective",
  A: "Assessment",
  P: "Plan",
};

function ReportSoap({ soap }: { soap: SoapSectionPayload[] }) {
  const byLabel = new Map(soap.map((s) => [s.label, s]));
  return (
    <section className="report-section mb-10">
      <SectionLabel>SOAP note</SectionLabel>
      <div className="flex flex-col gap-5">
        {(["S", "O", "A", "P"] as const).map((label) => {
          const row = byLabel.get(label);
          const body = row?.body?.trim();
          return (
            <div key={label} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 font-mono text-[12px] font-semibold text-foreground/80">
                {label}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {SOAP_TITLES[label]}
                </span>
                <p
                  className={
                    body
                      ? "text-[14px] leading-[1.7] text-foreground/90"
                      : "text-[13px] italic text-muted-foreground/60"
                  }
                >
                  {body || "No content recorded for this section."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SymptomList({ items }: { items: SymptomPayload[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0"
        >
          <span className="text-[14px] text-foreground/90">{s.label}</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {s.severity}
            {s.duration ? ` · ${s.duration}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MedicationList({ items }: { items: MedicationPayload[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0"
        >
          <span className="text-[14px] text-foreground/90">
            <span className="font-semibold">{m.name}</span>
            {m.dose ? ` · ${m.dose}` : ""}
            {m.frequency ? ` · ${m.frequency}` : ""}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {m.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineList({ items }: { items: TimelineEventPayload[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 border-b border-border/50 py-2 last:border-b-0"
        >
          <span className="w-14 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatClock(t.timestampSec)}
          </span>
          <span className="flex-1 text-[14px] text-foreground/90">{t.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {t.kind}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TranscriptList({ items }: { items: TranscriptLinePayload[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((t) => (
        <li key={t.id} className="flex gap-3">
          <span className="flex w-20 shrink-0 flex-col gap-0.5">
            <span
              className={
                t.speaker === "doctor"
                  ? "font-mono text-[10px] uppercase tracking-[0.12em] text-foreground"
                  : "font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
              }
            >
              {t.speaker === "doctor" ? "Dr." : "Patient"}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {formatClock(t.timestampSec)}
            </span>
          </span>
          <p className="flex-1 text-[13px] leading-[1.65] text-foreground/85">
            {t.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ReportFooter({ data }: { data: ConsultationDetail }) {
  return (
    <footer className="report-section mt-10 border-t border-border pt-5 text-[10px] text-muted-foreground">
      <p>
        Generated by Claria · Language: {data.language || "—"} · Status:{" "}
        {data.status}
      </p>
      <p className="mt-1">
        AI-generated draft — for clinical review only. Verify all clinical
        information against the source recording before acting on it.
      </p>
    </footer>
  );
}

function ReportSection({
  title,
  children,
  pageBreakBefore = false,
}: {
  title: string;
  children: React.ReactNode;
  pageBreakBefore?: boolean;
}) {
  return (
    <section
      className={`report-section mb-10 ${
        pageBreakBefore ? "report-page-break-before" : ""
      }`}
    >
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </h2>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] italic text-muted-foreground/60">{children}</p>
  );
}

/* ─────────────── format helpers ─────────────── */

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
