/**
 * News background for the Daily: what's actually going on behind today's pick
 * and Jev's leans. Jev's call is numbers-only; this is the human story, from a
 * live web search. One Sonnet call per day (cached 6h), structured output, and
 * strictly factual: no predictions, no advice, no restated prices.
 */
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_FAST, REFUSAL_FALLBACK } from "./claude";

export interface Background {
  story: string;
  sources: { title: string; url: string }[];
}

interface Subject {
  id: string;
  question: string;
  /** "Back X at 33%" etc., so the story can be about the side in play. */
  call: string;
  /** The pick gets 2-3 sentences; leans get one line. */
  depth: "pick" | "line";
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    story: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, url: { type: "string" } },
        required: ["title", "url"],
      },
    },
  },
  required: ["story", "sources"],
} as const;

/** Keep one-liners to their first sentence (models sometimes run long). */
function firstSentence(text: string, max = 220): string {
  const m = text.match(/^.+?[.!?](\s|$)/);
  const one = (m ? m[0] : text).trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

async function one(client: Anthropic, s: Subject): Promise<Background | null> {
  const long = s.depth === "pick";
  const prompt = `You write background notes for HedgePredict Daily, a prediction-market briefing. Search the web and explain what is actually going on right now with this market: what's at stake and the latest relevant development (form, injuries, lineups, polls, data, schedule, statements). Write for a smart reader who knows the market exists but not the story.

Market: "${s.question}"
(HedgePredict's model says: ${s.call}. Do not comment on this.)

Rules: facts only, from what you find. Do not predict the outcome, recommend a bet, or restate prices or percentages. Never describe your research or yourself ("I found", "I can't confirm", "when I searched"); write like a news brief. Give any times in US Eastern (ET). If there's little news, say plainly what the event is and when it happens, then stop. ${long ? "Two or three sentences." : "Exactly one sentence, under 30 words."} Plain text, no markdown, no em dashes, no hype. ${long ? "Give 1-2 sources (title + URL) you actually used." : "Give at most 1 source."} If you find nothing current and relevant, return an empty story.`;
  try {
    const res = await client.beta.messages.create({
      ...REFUSAL_FALLBACK,
      model: CLAUDE_FAST,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: long ? 3 : 2 }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") return null;
    const text = [...res.content].reverse().find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as Background;
    const story = long ? parsed.story.trim() : firstSentence(parsed.story);
    if (!story) return null;
    return { story, sources: parsed.sources.filter((x) => /^https?:\/\//.test(x.url)).slice(0, long ? 2 : 1) };
  } catch {
    return null;
  }
}

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: Record<string, Background> }>();

/** Background keyed by market id. Empty object if Claude isn't configured or fails. */
export async function buildBackground(date: string, subjects: Subject[]): Promise<Record<string, Background>> {
  if (!process.env.ANTHROPIC_API_KEY || subjects.length === 0) return {};
  const key = `${date}:${subjects.map((s) => s.id).join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  // One small web-searched call per market, in parallel: reliable coverage,
  // and a failure on one market never blanks the others.
  const client = new Anthropic();
  const results = await Promise.all(subjects.map((s) => one(client, s)));
  const value: Record<string, Background> = {};
  subjects.forEach((s, i) => {
    const r = results[i];
    if (r) value[s.id] = r;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}
