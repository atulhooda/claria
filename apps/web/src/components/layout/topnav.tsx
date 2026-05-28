"use client";

import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Loader2Icon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Brand } from "@/components/layout/brand";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCreateConsultation } from "@/lib/api/consultations";

interface TopNavProps {
  title?: string;
}

export function TopNav({ title }: TopNavProps) {
  const router = useRouter();
  const createMut = useCreateConsultation();

  const startLiveConsultation = async () => {
    const created = await createMut.mutateAsync();
    router.push(`/consultations/${created.id}`);
  };

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
              onClick={startLiveConsultation}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
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
    </header>
  );
}
