/**
 * "Why does Jev say that?" — Claude, on demand, explains Jev's calibrated call.
 *
 * Division of labour: Jev (src/lib/jev.ts) makes the fast, numbers-only call and
 * returns a structured verdict. Here Claude INTERPRETS that verdict in plain
 * language. Jev never browsed the web, so the explanation must stay grounded in
 * the metrics Jev actually saw — no invented news, no re-deciding the call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MissingCredentialsError } from "./read";
import type { JevReadDTO } from "./dto";
import { JEV_ACTION_COPY, confidenceLabel, valuationLabel, edgeLabel } from "./jevDisplay";

const MODEL = "claude-opus-4-8";

export interface JevExplanation {
  explanation: string;
  model: string;
}

/**
 * Ask Claude to explain, in 2-3 plain sentences, why Jev's calibrated model
 * landed on this action. Throws MissingCredentialsError when no key is set.
 */
export async function explainJev(read: JevReadDTO): Promise<JevExplanation> {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingCredentialsError();

  const client = new Anthropic();
  const conf = confidenceLabel(read.confidence);

  const prompt = `You are explaining a verdict from Jev, a calibrated prediction-model. Jev is NOT a language model and did NOT read any news: it made a fast, numbers-only call from the market's own metrics. Your job is to explain, in plain language, why Jev likely landed where it did. Do not re-decide, do not add outside news, do not invent facts. Interpret only what Jev saw.

Market: "${read.marketName}"
Outcome under review: "${read.outcome}"
Market-implied probability: ${(read.marketPrice * 100).toFixed(1)}%
Jev's calibrated probability: ${(read.jevProbability * 100).toFixed(1)}%
Edge (Jev minus market): ${edgeLabel(read.edge)} — Jev reads it as ${valuationLabel(read.valuation)}
Jev's call: ${JEV_ACTION_COPY[read.action].label.toUpperCase()}${conf ? ` (${conf} confidence)` : ""}

Write 2-3 short sentences a smart bettor can skim: what the edge and confidence imply, and why that maps to a ${JEV_ACTION_COPY[read.action].label} call. If the edge is small or within noise, say plainly that the market looks efficient. Plain text, no preamble, no markdown, no em dashes.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error(
      `Jev's explanation came back empty (stop_reason: ${response.stop_reason}).`
    );
  }

  return { explanation: text, model: response.model };
}
