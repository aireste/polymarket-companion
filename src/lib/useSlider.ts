"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Position of the active item inside a container, for a highlight that slides
 * between items (sidebar, segmented filter) instead of jumping.
 */
export function useSlider(container: RefObject<HTMLElement | null>, activeSelector: string, deps: unknown[]) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const c = container.current;
      const el = c?.querySelector<HTMLElement>(activeSelector);
      if (!c || !el) return setBox(null);
      setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return box;
}
