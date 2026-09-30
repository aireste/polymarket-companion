/**
 * Claude models + request settings shared by every HedgePredict route, so a
 * model upgrade is a one-line change.
 */

import type Anthropic from "@anthropic-ai/sdk";

/** Heavy lifting: the web-grounded deep read and the structured probability read. */
export const CLAUDE_DEEP = "claude-opus-5-5";
/** Light, fast work: the Jev explainer and the Ask chat. */
export const CLAUDE_FAST = "claude-sonnet-5-5";

/**
 * Server-side refusal fallback. If the model declines a request (a safety
 * classifier false positive), the API retries it on a fallback model inside the
 * same call instead of returning nothing. Spread into client.beta.messages.* params.
 */
export const REFUSAL_FALLBACK: {
  betas: Anthropic.Beta.AnthropicBeta[];
  fallbacks: Anthropic.Beta.Messages.BetaFallbacksParam;
} = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

/** Thrown when every model in the fallback chain declined. */
export class ClaudeRefusalError extends Error {
  constructor() {
    super("Claude declined to analyze this one. Try a different market.");
    this.name = "ClaudeRefusalError";
  }
}

/** Check stop_reason before reading content: a refusal is an HTTP 200. */
export function assertNotRefused(response: { stop_reason: string | null }) {
  if (response.stop_reason === "refusal") throw new ClaudeRefusalError();
}
