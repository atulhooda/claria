"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav, type NavItem } from "@/config/navigation";
import { Brand } from "@/components/layout/brand";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const base =
    "group relative flex items-center gap-2.5 rounded-md pl-3 pr-2.5 py-2 text-sm transition-colors [transition-duration:var(--duration-fast)] ease-out";

  if (item.disabled) {
    return (
      <span
        className={cn(
          base,
          "cursor-not-allowed text-muted-foreground/60",
          "[&_svg]:opacity-50",
        )}
        aria-disabled
        title="Coming soon"
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
        <Badge variant="muted" className="ml-auto text-[9px]">
          Soon
        </Badge>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        base,
        active
          ? "bg-surface-2 text-foreground"
          : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}
      <Icon
        className={cn(
          "h-4 w-4 transition-colors",
          active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground",
        )}
      />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="relative hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface-1 md:flex">
      <div className="flex h-16 items-center px-6">
        <Brand href="/dashboard" />
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          Workspace
        </p>
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Separator />
          <div className="flex flex-col gap-0.5 pt-1">
            {secondaryNav.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
