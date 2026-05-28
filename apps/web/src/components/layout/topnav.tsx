"use client";

import * as React from "react";
import { UserButton } from "@clerk/nextjs";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Brand } from "@/components/layout/brand";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";

interface TopNavProps {
  title?: string;
}

export function TopNav({ title }: TopNavProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <div className="md:hidden">
        <Brand href="/dashboard" />
      </div>
      {title ? (
        <h1 className="hidden text-sm font-medium text-foreground/90 md:block">
          {title}
        </h1>
      ) : null}
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="accent"
              size="sm"
              className="gap-1.5"
              onClick={() => setDialogOpen(true)}
            >
              <PlusIcon className="h-4 w-4" />
              New consultation
            </Button>
          </TooltipTrigger>
          <TooltipContent>Start a new patient consultation</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <ThemeToggle />
            </span>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
        <UserButton
          appearance={{ elements: { avatarBox: "h-8 w-8" } }}
          afterSignOutUrl="/"
        />
      </div>

      <NewConsultationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </header>
  );
}
