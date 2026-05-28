"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger delay in ms (useful for sibling reveals). */
  delay?: number;
  /** Distance translated in on entry, in px. */
  distance?: number;
  /** Render as a different element. */
  as?: "div" | "section" | "header" | "footer";
}

/**
 * Wrap a section to have it fade + translate in once the first ~15% of
 * its box scrolls into the viewport. Respects `prefers-reduced-motion`
 * via the global override in globals.css.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 16,
  as: Tag = "div",
  ...props
}: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-[opacity,transform] ease-out [transition-duration:var(--duration-slower)]",
        inView ? "opacity-100 translate-y-0" : "opacity-0",
        className,
      )}
      style={{
        transform: inView ? undefined : `translateY(${distance}px)`,
        transitionDelay: `${delay}ms`,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
