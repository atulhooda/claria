import Link from "next/link";

import { cn } from "@/lib/utils";
import { site } from "@/config/site";

interface BrandProps {
  href?: string;
  className?: string;
}

export function Brand({ href = "/", className }: BrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 text-foreground transition-colors",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[13px] font-semibold tracking-tight shadow-sm"
      >
        C
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">
        {site.name}
      </span>
    </Link>
  );
}
