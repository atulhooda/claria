"use client";

import * as React from "react";

interface UseInViewOptions extends IntersectionObserverInit {
  /** Trigger only the first time the element enters the viewport. */
  once?: boolean;
}

/**
 * Tiny IntersectionObserver hook for scroll-triggered reveals. Pure JS,
 * no motion library — combine with a CSS class that animates `opacity`
 * + `transform` for the actual entrance.
 */
export function useInView<T extends Element = HTMLDivElement>(
  options: UseInViewOptions = {},
): [React.RefObject<T | null>, boolean] {
  const { once = true, root, rootMargin = "0px 0px -10% 0px", threshold = 0.15 } =
    options;
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, root, rootMargin, threshold]);

  return [ref, inView];
}
