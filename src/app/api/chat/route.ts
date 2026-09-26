/**
 * HedgePredict chat — an agentic "Ask" endpoint for the web dashboard.
 *
 * A visitor types anything ("what are some under-the-radar picks?") and Claude
 * decides which of HedgePredict's tools to call — rank live markets, check
 * current news via web search, size a play with fractional-Kelly, or pull an
 * outcome's price history — and answers conversationally. This is the on-site
 * mirror of the MCP experience, so people can try it without a paid AI plan.
 *
 * Uses the SDK Tool Runner (client.beta.messages.toolRunner). The runner drives
 * the request -> execute -> loop cycle; we handle `pause_turn` ourselves (the
 * runner does not auto-resume it) since the server-side web_search tool can
 * pause. Rate-limited per IP; the Anthropic spend cap is the real cost guard.
 */

import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fetchMarkets, fetchMarketById, searchMarkets } from "@/lib/polymarket";
import { rankMarkets, analyzePlay, type ScoredMarket } from "@/lib/scoring";
import { jevRead, MissingGatewayKeyError } from "@/lib/jev";
import { rateLimit, clientKey } from "@/lib/rateLimit";

// The agentic loop plus a web search or two can run tens of seconds.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Sonnet for the on-site chat: fast and cheap. Jev (the calibrated engine) makes
// the actual verdicts via get_jev_verdict; Claude is just the conversational wrapper.
const MODEL = "claude-sonnet-5";
const CLOB_HISTORY = "https://clob.polymarket.com/prices-history";
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const SYSTEM = `You are HedgePredict, a prediction-market analyst assistant for Polymarket, talking to a visitor trying the tool on the web.

Jev is the engine. Jev is HedgePredict's calibrated decision model. Whenever the user asks whether to play a specific market, or "what does Jev say", or wants a probability / confidence / call on a market, call get_jev_verdict and lead your answer with Jev's verdict. Do NOT substitute your own guess for Jev's number. You are the voice; Jev is the brain.

How you work:
- Use your tools. get_best_plays surfaces the curated dashboard set — HedgePredict's top-ranked live markets. search_markets(query) searches the FULL Polymarket universe by keyword (e.g. "bitcoin", "ethereum", a candidate, a team, an event) — use it whenever the user asks about a specific market, asset, or topic that is not in get_best_plays. The dashboard is intentionally kept tight to the best plays; search_markets is how you reach everything else. get_jev_verdict(marketId) returns Jev's calibrated call (wager/hold/skip), probability, edge vs the market, and confidence — call it on any market id from either tool. web_search checks current news for extra color when the user asks why. analyze_edge sizes a fractional-Kelly stake and hedge. get_market_history shows how an outcome's price moved.
- Finding a specific play: if the user names something not in the dashboard ("any good bitcoin plays?", "what about the X election?", "is there a market on Y?"), call search_markets first, then get_jev_verdict on the most relevant result(s). If search finds nothing tradable, say so plainly.
- Honest over hype. A market's price already reflects the crowd's probability. If Jev says skip or the edge is tiny, say so plainly. "No edge, don't bet" is a good answer, not a gap.
- Decision support, not financial advice. You never place trades. Stakes are fractional-Kelly and capped. Remind users to only risk what they can afford to lose.
- Be tight and fast. Default to 1-2 sentences. Lead with Jev's call and the two numbers (Jev % vs market %), then at most one short clause of why. This is a quick-answer surface, not an essay.
- Do NOT tack on unsolicited offers ("If you want, I can size a stake...", "Let me know if...", "I can also check..."). End when the answer is delivered. Only go longer, or offer next steps, if the user explicitly asks you to explain, go deeper, or size a play. No preamble, no tables, no recap.`;

/** Rank a generous pool then re-sort by the requested signal, like the app UI. */
function pickPlays(ranked: ScoredMarket[], filter: string, limit: number) {
  let list = ranked;
  if (filter === "hot") list = [...ranked].sort((a, b) => b.signals.momentum - a.signals.momentum);
  else if (filter === "coinflip") list = [...ranked].sort((a, b) => b.signals.uncertainty - a.signals.uncertainty);
  else if (filter === "soon") list = [...ranked].sort((a, b) => b.signals.timeliness - a.signals.timeliness);
  return list.slice(0, limit).map((m) => ({
    marketId: m.id,
    question: m.question,
    url: m.url,
    outcomes: m.outcomes.map((o) => ({ label: o.label, price: o.price })),
    volume24hr: Math.round(m.volume24hr),
    liquidity: Math.round(m.liquidity),
    resolvesAt: m.endDate ? m.endDate.toISOString().slice(0, 10) : null,
    gameStartTime: m.gameStartTime ? m.gameStartTime.toISOString() : null,
    score: Number(m.score.toFixed(2)),
  }));
}

const getBestPlays = betaZodTool({
  name: "get_best_plays",
  description:
    "Rank live Polymarket markets worth a look right now using HedgePredict's signal engine (momentum, liquidity, uncertainty, timeliness). Call this first when the user asks what's good, what's hot, coinflips, or what's resolving soon.",
  inputSchema: z.object({
    filter: z.enum(["all", "hot", "coinflip", "soon"]).default("all"),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  run: async ({ filter, limit }) => {
    const markets = await fetchMarkets({ limit: 150, orderBy: "volume24hr" });
    const ranked = rankMarkets(markets, { limit: 60, minLiquidity: 1000 });
    const plays = pickPlays(ranked, filter, limit);
    if (plays.length === 0) return "No markets cleared the liquidity threshold right now.";
    return JSON.stringify({ asOf: new Date().toISOString(), filter, plays });
  },
});

const analyzeEdge = betaZodTool({
  name: "analyze_edge",
  description:
    "Pure math, no news. Given the market price for an outcome, the user's own probability, and their bankroll, compute the edge, a fractional-Kelly stake, expected value, and a hedge leg that caps downside. Use when the user gives you their own read and asks how to size or hedge it.",
  inputSchema: z.object({
    marketPrice: z.number().gt(0).lt(1).describe("Market price for the outcome, in (0,1)."),
    yourProbability: z.number().gt(0).lt(1).describe("The user's probability the outcome resolves YES, in (0,1)."),
    bankroll: z.number().min(0).describe("Total bankroll to risk, USD."),
    kellyFraction: z.number().gt(0).max(1).default(0.25),
  }),
  run: async ({ marketPrice, yourProbability, bankroll, kellyFraction }) => {
    try {
      return JSON.stringify(analyzePlay({ marketPrice, yourProbability, bankroll, kellyFraction }));
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : "invalid inputs"}`;
    }
  },
});

const getMarketHistory = betaZodTool({
  name: "get_market_history",
  description:
    "Fetch the price (implied-probability) history for one outcome of a market from Polymarket's order book. Use a marketId from get_best_plays. outcomeIndex 0 is the first/leading outcome.",
  inputSchema: z.object({
    marketId: z.string().min(1),
    outcomeIndex: z.number().int().min(0).default(0),
    range: z.enum(["1d", "1w", "1m"]).default("1w"),
  }),
  run: async ({ marketId, outcomeIndex, range }) => {
    const market = await fetchMarketById(marketId);
    if (!market) return `Market ${marketId} not found.`;
    const outcome = market.outcomes[outcomeIndex];
    if (!outcome?.tokenId) return `No price history available for that outcome.`;
    const fidelity = range === "1d" ? 15 : range === "1w" ? 180 : 720;
    const params = new URLSearchParams({ market: outcome.tokenId, interval: range, fidelity: String(fidelity) });
    try {
      const res = await fetch(`${CLOB_HISTORY}?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!res.ok) return `Price history request failed (HTTP ${res.status}).`;
      const data = (await res.json()) as { history?: { t: number; p: number }[] };
      const points = Array.isArray(data.history) ? data.history : [];
      if (points.length === 0) return "No price history returned for that outcome/range.";
      const first = points[0].p;
      const last = points[points.length - 1].p;
      return JSON.stringify({
        outcome: outcome.label,
        range,
        first: pct(first),
        last: pct(last),
        changePoints: Number(((last - first) * 100).toFixed(1)),
        points: points.length,
      });
    } catch {
      return "Price history request failed.";
    }
  },
});

const searchMarketsTool = betaZodTool({
  name: "search_markets",
  description:
    "Search the FULL Polymarket universe by keyword — everything, not just the curated dashboard. Use this whenever the user asks about a specific market, asset, person, team, or topic that get_best_plays did not return (e.g. 'bitcoin plays', 'the X election', 'is there a market on Y?'). Returns tradable markets sorted by 24h volume, each with a marketId you can pass to get_jev_verdict.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Keyword(s), e.g. 'bitcoin', 'ethereum $3000', a candidate or team name."),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  run: async ({ query, limit }) => {
    try {
      const markets = await searchMarkets(query, limit);
      if (markets.length === 0) {
        return `No tradable Polymarket markets matched "${query}". They may all be resolved or not currently accepting orders.`;
      }
      return JSON.stringify({
        query,
        results: markets.map((m) => ({
          marketId: m.id,
          question: m.question,
          url: m.url,
          outcomes: m.outcomes.map((o) => ({ label: o.label, price: o.price })),
          volume24hr: Math.round(m.volume24hr),
          resolvesAt: m.endDate ? m.endDate.toISOString().slice(0, 10) : null,
        })),
      });
    } catch (err) {
      return `Search failed: ${err instanceof Error ? err.message : "unknown error"}.`;
    }
  },
});

const getJevVerdict = betaZodTool({
  name: "get_jev_verdict",
  description:
    "Ask Jev, HedgePredict's calibrated decision model, for the verdict on a market's leading outcome. Returns action (wager/hold/skip), Jev's probability, the market-implied probability, the edge in points, and Jev's confidence. Call this whenever the user asks whether to play a specific market, what the odds/percentage are, or what Jev thinks. Use a marketId from get_best_plays. This is fast and is the authoritative call — do not guess a probability yourself.",
  inputSchema: z.object({
    marketId: z.string().min(1),
  }),
  run: async ({ marketId }) => {
    const market = await fetchMarketById(marketId);
    if (!market) return `Market ${marketId} not found.`;
    try {
      const jev = await jevRead(market);
      return JSON.stringify({
        question: market.question,
        outcome: jev.outcome,
        action: jev.action,
        jevProbability: pct(jev.probability),
        marketProbability: pct(jev.marketPrice),
        edgePoints: Number((jev.edge * 100).toFixed(1)),
        valuation: jev.valuation,
        confidence: jev.confidence == null ? "n/a" : jev.confidence.toFixed(2),
      });
    } catch (err) {
      if (err instanceof MissingGatewayKeyError) {
        return "Jev is not configured on this server (no AI Gateway key).";
      }
      const msg = err instanceof Error ? err.message : "unknown error";
      if (/rate.?limit|high demand|429|overloaded/i.test(msg)) {
        return "Jev is briefly in high demand (rate-limited upstream). Tell the user to try again in a few seconds; do not invent a verdict yourself.";
      }
      return `Jev couldn't evaluate that market: ${msg}.`;
    }
  },
});

type ChatMessage = { role: "user" | "assistant"; content: string };

function coerceMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw)) return null;
  const msgs: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      msgs.push({ role, content: content.slice(0, 4000) });
    }
  }
  // Keep the last 12 turns and require a trailing user message.
  const trimmed = msgs.slice(-12);
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== "user") return null;
  return trimmed;
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const limit = rateLimit(key);
  if (!limit.ok) {
    return Response.json(
      {
        error: `You've hit the demo limit (a few messages an hour). Try again in ${Math.ceil(limit.retryAfterSec / 60)} min, or connect HedgePredict to your own AI via the MCP endpoint below.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "AI chat is unavailable: no ANTHROPIC_API_KEY configured on the server." },
      { status: 200 }
    );
  }

  let messages: ChatMessage[] | null;
  try {
    messages = coerceMessages(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!messages) {
    return Response.json({ error: "Send a non-empty messages array ending in a user message." }, { status: 400 });
  }

  const client = new Anthropic();
  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: SYSTEM,
    tools: [
      getBestPlays,
      searchMarketsTool,
      getJevVerdict,
      analyzeEdge,
      getMarketHistory,
      { type: "web_search_20260209", name: "web_search", max_uses: 2 },
    ],
    messages,
    max_iterations: 8,
  });

  try {
    let final: Anthropic.Beta.BetaMessage | undefined;
    for await (const message of runner) {
      final = message;
      // The runner does not auto-resume paused server-tool turns.
      if (message.stop_reason === "pause_turn") {
        runner.pushMessages({ role: "assistant", content: message.content });
      }
    }

    const text =
      final?.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim() ?? "";

    if (!text) {
      return Response.json({ error: "No answer was produced. Try rephrasing." }, { status: 502 });
    }
    return Response.json({ reply: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
