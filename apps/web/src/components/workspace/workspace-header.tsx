"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  MoreHorizontalIcon,
  SignatureIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AiStatusPill } from "@/components/workspace/ai-status-pill";
import type { AiActivity } from "@/hooks/use-mock-stream";
import type { PatientMeta } from "@/lib/mocks/consultation";

interface WorkspaceHeaderProps {
  patient: PatientMeta;
  sessionId: string;
  activity: AiActivity;
  status: "in-progress" | "completed" | "draft";
  className?: string;
}

const STATUS_META: Record<
  WorkspaceHeaderProps["status"],
  { label: string; icon: LucideIcon; tone: string }
> = {
  "in-progress": {
    label: "Live",
    icon: CircleDotIcon,
    tone: "text-destructive",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2Icon,
    tone: "text-primary",
  },
  draft: {
    label: "Draft",
    icon: SignatureIcon,
    tone: "text-muted-foreground",
  },
};

export function WorkspaceHeader({
  patient,
  sessionId,
  activity,
  status,
  className,
}: WorkspaceHeaderProps) {
  const StatusIcon = STATUS_META[status].icon;

  return (
    <header
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border bg-pane-gradient px-4 py-3.5 shadow-pane",
        "ring-inset-highlight backdrop-blur-xl",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/consultations"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Back to consultations"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>Back to consultations</TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
            {patient.name}
          </h1>
          <Badge variant="muted" className="hidden sm:inline-flex">
            {patient.age} · {patient.pronouns}
          </Badge>
          <span className="hidden font-mono text-[10px] text-muted-foreground/80 md:inline">
            {patient.mrn}
          </span>
        </div>
        <p className="truncate text-[12px] leading-tight text-muted-foreground">
          {patient.chiefComplaint}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px] font-medium md:inline-flex">
          <StatusIcon
            className={cn("h-3 w-3", STATUS_META[status].tone)}
            strokeWidth={2.4}
          />
          <span className="text-foreground/80">{STATUS_META[status].label}</span>
        </div>
        <AiStatusPill activity={activity} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Session options</TooltipContent>
        </Tooltip>
      </div>

      <span className="sr-only">Session ID: {sessionId}</span>
    </header>
  );
}
