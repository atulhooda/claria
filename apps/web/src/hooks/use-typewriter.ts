"use client";

import * as React from "react";

interface UseTypewriterOptions {
  /** Characters per second. Default 32 cps reads like a fast court reporter. */
  cps?: number;
  /** Delay before typing starts, in ms. */
  startDelay?: number;
  /** When true, holds the final text without re-typing on prop changes. */
  freeze?: boolean;
}

/**
 * Reveal a string character-by-character. Cheaper than a real WebSocket
 * stream — used to fake "live AI transcript" in the landing-page mock.
 */
export function useTypewriter(
  fullText: string,
  options: UseTypewriterOptions = {},
): { text: string; done: boolean } {
  const { cps = 32, startDelay = 0, freeze = false } = options;
  const [text, setText] = React.useState(freeze ? fullText : "");

  React.useEffect(() => {
    if (freeze) {
      setText(fullText);
      return;
    }
    if (typeof window === "undefined") return;

    const intervalMs = Math.max(8, Math.round(1000 / cps));
    let i = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = window.setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setText(fullText.slice(0, i));
        if (i >= fullText.length && timer) {
          clearInterval(timer);
          timer = null;
        }
      }, intervalMs);
    }, startDelay);

    return () => {
      window.clearTimeout(startTimer);
      if (timer) clearInterval(timer);
    };
  }, [fullText, cps, startDelay, freeze]);

  return { text, done: text.length >= fullText.length };
}
