import { track as send } from "@vercel/analytics";

/**
 * Private usage counts (Vercel Web Analytics; cookieless, nothing a visitor sees). Page views are
 * automatic; these are the handful of actions that say whether the product is being used:
 * opening a call, asking, a deep read, trying Hedge Lab, playing the tour, joining the Daily,
 * the coffee link. Names only, with at most one short label, never anything about the person.
 */
export type TrackEvent =
  | "open_market"
  | "ask"
  | "why_this_call"
  | "deep_read"
  | "lab_example"
  | "lab_add_bet"
  | "tour_play"
  | "daily_signup"
  | "coffee_click";

export function track(event: TrackEvent, where?: string): void {
  try {
    send(event, where ? { where } : undefined);
  } catch {
    /* analytics must never break the page */
  }
}
