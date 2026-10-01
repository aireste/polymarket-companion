/**
 * "Why does Jev say that?" — Claude, on demand, explains Jev's calibrated call.
 *
 * Division of labour: Jev (src/lib/jev.ts) makes the fast, numbers-only call and
 * returns a structured verdict. Here Claude INTERPRETS that verdict in plain
 * language. Jev never browsed the web, so the explanation must stay grounded in
 * the metrics Jev actually saw — no invented news, no re-deciding the call.
 */
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_FAST, REFUSAL_FALLBACK, assertNotRefused } from "./claude";
import { MissingCredentialsError } from "./read";
import type { JevReadDTO } from "./dto";
import { JEV_ACTION_COPY, confidenceLabel } from "./jevDisplay";

// Sonnet keeps this cheap; it's a short interpretation of Jev's numbers, not
// deep reasoning, so it runs at low effort to stay fast.
const MODEL = CLAUDE_FAST;

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

  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const side = read.lean == null ? null : read.sides[read.lean];
  const dist = read.sides
    .map((s, i) => `"${s.label}" too cheap: ${pct(read.distribution.sides[i] ?? 0)}`)
    .concat(`neither: ${pct(read.distribution.neither)}`)
    .join(" | ");

  const prompt = `You are explaining a call from Jev, a calibrated decision model. Jev is NOT a language model and did NOT read any news: it looked only at this market's prices, its 7-day and 1-day price move, trading volume and timing, and answered one question: "at these prices, is either side underpriced?" Explain in plain language why it likely landed where it did. Do not re-decide, add outside news, or invent facts.

Market: "${read.marketName}"
Prices: ${read.sides.map((s) => `${s.label} ${pct(s.price)}`).join(", ")}
Jev's answer (how sure Jev is of each answer; NOT chances of winning): ${dist}
Jev's call: ${JEV_ACTION_COPY[read.action].label.toUpperCase()}${side ? ` ${side.label}` : ""}${conf ? ` (${conf} confidence)` : ""}

The reader knows this model as "HedgePredict", so refer to it as HedgePredict (e.g. "HedgePredict is 74% sure..."), never by the name Jev.

Write 2-3 short sentences a smart bettor can skim. For a Wager or Lean, say which side looks too cheap and how sure Jev is (never call Jev's percentage a chance of winning; write prices in cents like 44¢), and that it's based on price action and market numbers, not news. For a Skip, say plainly that Jev sees the prices as about right. Plain text, no preamble, no markdown, no em dashes.`;

  const response = await client.beta.messages.create({
    ...REFUSAL_FALLBACK,
    model: MODEL,
    max_tokens: 4000,
    // Sonnet 5.5 can't disable thinking; low effort keeps it quick and cheap.
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });
  assertNotRefused(response);

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
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
