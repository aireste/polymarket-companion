"use client";

import { useSyncExternalStore } from "react";
import type { OddsFormat } from "./format";

/**
 * The viewer's odds format, shared by every component and remembered in this
 * browser. One tiny store instead of prop-drilling, so flipping the toggle
 * updates the board, inspector and chart in the same frame.
 */
const KEY = "hp_odds";
const listeners = new Set<() => void>();

function read(): OddsFormat {
  try {
    return localStorage.getItem(KEY) === "us" ? "us" : "poly";
  } catch {
    return "poly";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function setOddsFormat(f: OddsFormat) {
  try {
    localStorage.setItem(KEY, f);
  } catch {
    /* private mode: applies until the tab closes */
  }
  listeners.forEach((fn) => fn());
}

/** Server render and first paint use Polymarket format, then the saved choice. */
export function useOddsFormat(): OddsFormat {
  return useSyncExternalStore(subscribe, read, () => "poly");
}
