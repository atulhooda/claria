/**
 * Motion vocabulary. Same easing + durations are mirrored as CSS custom
 * properties in `globals.css` (`--ease-out`, `--duration-base`, etc.) so
 * CSS-only transitions speak the same language as any future JS motion
 * library. Phase 1 ships tokens only — no runtime motion lib.
 */

export const easing = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  outCss: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOutCss: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export const duration = {
  fast: 180,
  base: 280,
  slow: 420,
  slower: 640,
} as const;

export type Easing = typeof easing;
export type Duration = typeof duration;
