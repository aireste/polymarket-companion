/**
 * HedgePredict MCP server — the second "front door" into the engine.
 *
 * The web dashboard (src/app/page.tsx) is one way to use HedgePredict; this is
 * the other. It exposes the SAME engine (polymarket + scoring + recommend) to
 * any MCP client — Claude Desktop, Claude Code, claude.ai connectors — over
 * Streamable HTTP. No source code or local install needed on the caller's end:
 * once deployed, they add this route's URL as a connector and ask their own
 * Claude for the best Polymarket plays.
 *
 * Built on mcp-handler v2 (MCP SDK v2, 2026-07-28 spec). The handler is a plain
 * Web `(Request) => Response`, so it drops straight into a Next.js route.
 *
 * Tools:
 *   get_best_plays      — ranked markets worth a look   (fetchMarkets + rankMarkets)
 *   recommend_market    — Claude's CHASE/HOLD/SKIP read (fetchMarketById + recommend)
 *   get_jev_read        — Jev's calibrated WAGER/HOLD/SKIP (fetchMarketById + jevRead)
 *   analyze_edge        — edge/Kelly/hedge math, no LLM  (analyzePlay)
 *   get_market_history  — price history for one outcome  (Polymarket US)
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { fetchMarkets, fetchMarketById } from "@/lib/polymarket";
import { fetchHistory } from "@/lib/history";
import { rankMarkets, analyzePlay, type ScoredMarket } from "@/lib/scoring";
import { recommend } from "@/lib/recommend";
import { MissingCredentialsError } from "@/lib/read";
import { jevRead, describeRead, MissingJevKeyError } from "@/lib/jev";
import { rateLimit, clientKey, LIMITS } from "@/lib/rateLimit";

// The recommend tool calls Claude + live web search; give it room past the
// default serverless timeout. Honored by Vercel; harmless in local dev.
export const maxDuration = 60;
// Live odds move constantly; never cache.
export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** One market rendered for an LLM: readable line + the raw fields it may want. */
function playSummary(m: ScoredMarket, rank: number) {
  const odds = m.outcomes.map((o) => `${o.label} ${pct(o.price)}`).join(" / ");
  return {
    line: `${rank}. ${m.question} — ${odds} · ${(m.spread ?? 0) * 100 < 0.05 ? "" : `${((m.spread ?? 0) * 100).toFixed(1)}¢ spread · `}score ${m.score.toFixed(2)}`,
    data: {
      marketId: m.id,
      question: m.question,
      url: m.url,
      outcomes: m.outcomes.map((o) => ({ label: o.label, price: o.price, tokenId: o.tokenId })),
      spread: m.spread,
      resolvesAt: m.endDate ? m.endDate.toISOString() : null,
      gameStartTime: m.gameStartTime ? m.gameStartTime.toISOString() : null,
      score: m.score,
      signals: m.signals,
    },
  };
}

/** Package a readable summary + machine-readable JSON as one text result. */
function textResult(summary: string, json: unknown) {
  return {
    content: [
      { type: "text" as const, text: summary },
      { type: "text" as const, text: "```json\n" + JSON.stringify(json, null, 2) + "\n```" },
    ],
  };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const handler = createMcpHandler(
  (server) => {
    /* ---- get_best_plays ------------------------------------------------ */
    server.registerTool(
      "get_best_plays",
      {
        title: "Get best Polymarket plays",
        description:
          "Rank live Polymarket markets worth a look right now, using HedgePredict's signal engine (momentum, liquidity, uncertainty, timeliness). Use 'hot' for the highest-volume markets, 'coinflip' for the most uncertain (near 50/50), 'soon' for the ones resolving soonest, or 'all' for the overall blended ranking. This is decision support, not advice, and it does not place trades.",
        inputSchema: z.object({
          filter: z
            .enum(["all", "hot", "coinflip", "soon"])
            .default("all")
            .describe("Which angle to rank by. Default 'all'."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(15)
            .describe("Max markets to return. Default 15."),
        }),
      },
      async ({ filter, limit }) => {
        let ranked: ScoredMarket[];
        try {
          const markets = await fetchMarkets();
          // Rank a generous pool, then apply the filter as a re-sort over the
          // same honest signals the web app uses, and finally trim to `limit`.
          ranked = rankMarkets(markets, { limit: 60, minLiquidity: 1000 });
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : "Failed to fetch markets");
        }

        if (filter === "hot") {
          ranked = [...ranked].sort((a, b) => b.signals.momentum - a.signals.momentum);
        } else if (filter === "coinflip") {
          ranked = [...ranked].sort((a, b) => b.signals.uncertainty - a.signals.uncertainty);
        } else if (filter === "soon") {
          ranked = [...ranked].sort((a, b) => b.signals.timeliness - a.signals.timeliness);
        }
        ranked = ranked.slice(0, limit);

        if (ranked.length === 0) {
          return errorResult("No markets cleared the liquidity threshold right now.");
        }

        const summaries = ranked.map((m, i) => playSummary(m, i + 1));
        const summary = `Top ${ranked.length} plays (${filter}), as of ${new Date().toISOString()}:\n${summaries
          .map((s) => s.line)
          .join("\n")}`;
        return textResult(summary, { asOf: new Date().toISOString(), filter, plays: summaries.map((s) => s.data) });
      },
    );

    /* ---- recommend_market --------------------------------------------- */
    server.registerTool(
      "recommend_market",
      {
        title: "Recommend a market (AI read)",
        description:
          "Ask Claude for an autonomous read on one market: it checks live news/sentiment via web search, estimates the true probability, compares it to the market price, and returns CHASE / HOLD / SKIP with confidence and rationale. Honest by construction — efficient markets get HOLD or SKIP. Takes ~15-30s. Pass a marketId from get_best_plays.",
        inputSchema: z.object({
          marketId: z.string().min(1).describe("HedgePredict market id (eventSlug~marketSlug), e.g. from get_best_plays."),
        }),
      },
      async ({ marketId }) => {
        let market;
        try {
          market = await fetchMarketById(marketId);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : "Market lookup failed");
        }
        if (!market) return errorResult(`Market ${marketId} not found.`);

        try {
          const rec = await recommend(market);
          const summary = `${rec.action} (${rec.confidence} confidence) on "${market.question}".\nClaude's probability for "${market.outcomes[0]?.label}": ${pct(rec.probability)} vs market ${pct(market.outcomes[0]?.price ?? 0)}.\nSentiment: ${rec.sentiment}\nRationale: ${rec.rationale}`;
          return textResult(summary, {
            marketId: market.id,
            question: market.question,
            currentOdds: market.outcomes.map((o) => ({ label: o.label, price: o.price })),
            resolvesAt: market.endDate ? market.endDate.toISOString() : null,
            aiAction: rec.action,
            confidence: rec.confidence,
            aiProbability: rec.probability,
            sentiment: rec.sentiment,
            rationale: rec.rationale,
            model: rec.model,
          });
        } catch (err) {
          if (err instanceof MissingCredentialsError) {
            return errorResult(
              "AI reads are unavailable: no ANTHROPIC_API_KEY configured on the server. Use analyze_edge with your own probability instead.",
            );
          }
          return errorResult(err instanceof Error ? err.message : "Recommendation failed");
        }
      },
    );

    /* ---- get_jev_read -------------------------------------------------- */
    server.registerTool(
      "get_jev_read",
      {
        title: "Get Jev's calibrated call",
        description:
          "Ask Jev, HedgePredict's calibrated decision model, whether either side of one market is underpriced at current prices. Returns WAGER (picks a side outright), LEAN (leans one side), or SKIP (priced about right), the side it favors, its distribution over the sides and 'neither', and calibrated confidence. Jev reads the market's prices, 7-day and 1-day price move, volume and timing only (no web search), so it is fast. Use recommend_market for a slower, news-grounded read. Pass a marketId from get_best_plays. Decision support, not advice; it does not place trades.",
        inputSchema: z.object({
          marketId: z.string().min(1).describe("HedgePredict market id (eventSlug~marketSlug), e.g. from get_best_plays."),
        }),
      },
      async ({ marketId }) => {
        let market;
        try {
          market = await fetchMarketById(marketId);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : "Market lookup failed");
        }
        if (!market) return errorResult(`Market ${marketId} not found.`);

        try {
          const jev = await jevRead(market);
          const conf = jev.confidence != null ? ` Confidence ${pct(jev.confidence)}.` : "";
          const summary = `Jev on "${market.question}": ${describeRead(jev)}.${conf}`;
          return textResult(summary, { marketId: market.id, question: market.question, url: market.url, ...jev });
        } catch (err) {
          if (err instanceof MissingJevKeyError) {
            return errorResult("Jev isn't configured on this server (no TypeSafe key).");
          }
          return errorResult(err instanceof Error ? err.message : "Jev evaluation failed");
        }
      },
    );

    /* ---- analyze_edge -------------------------------------------------- */
    server.registerTool(
      "analyze_edge",
      {
        title: "Analyze edge, Kelly stake & hedge",
        description:
          "Pure math, no LLM call. Given a market price, YOUR probability estimate, and your bankroll, compute the edge, a fractional-Kelly stake suggestion, expected value, and a hedge leg that caps downside. Suggested stakes are fractional-Kelly and clamped for safety. Decision support, not advice; it does not place trades.",
        inputSchema: z.object({
          marketPrice: z
            .number()
            .gt(0)
            .lt(1)
            .describe("Market's current price for the outcome you're eyeing, in (0,1). This IS the implied probability."),
          yourProbability: z
            .number()
            .gt(0)
            .lt(1)
            .describe("YOUR probability that this outcome resolves YES, in (0,1)."),
          bankroll: z.number().min(0).describe("Total bankroll you'd risk across plays, USD."),
          kellyFraction: z
            .number()
            .gt(0)
            .max(1)
            .default(0.25)
            .describe("Kelly fraction for safety. Default 0.25 (quarter-Kelly)."),
        }),
      },
      async ({ marketPrice, yourProbability, bankroll, kellyFraction }) => {
        try {
          const a = analyzePlay({ marketPrice, yourProbability, bankroll, kellyFraction });
          const summary =
            a.verdict === "buy"
              ? `BUY: edge ${a.edgePoints.toFixed(1)} pts. Suggested stake $${a.suggestedStake.toFixed(2)} (${(kellyFraction * 100).toFixed(0)}% Kelly). EV $${a.evPerDollar.toFixed(3)}/$1. ${a.hedge.note}`
              : `AVOID: edge ${a.edgePoints.toFixed(1)} pts (non-positive at your read). ${a.hedge.note}`;
          return textResult(summary, a);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : "Analysis failed");
        }
      },
    );

    /* ---- get_market_history ------------------------------------------- */
    server.registerTool(
      "get_market_history",
      {
        title: "Get market price history",
        description:
          "Fetch the price (implied-probability) history for one outcome of a market on Polymarket US. Pass a marketId and which outcome (by index; 0 is the first/leading outcome) plus a range.",
        inputSchema: z.object({
          marketId: z.string().min(1).describe("HedgePredict market id (eventSlug~marketSlug)."),
          outcomeIndex: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Which outcome's history, by index. 0 = first/leading outcome (default)."),
          range: z.enum(["1d", "1w", "1m"]).default("1w").describe("Time range. Default 1w."),
        }),
      },
      async ({ marketId, outcomeIndex, range }) => {
        let market;
        try {
          market = await fetchMarketById(marketId);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : "Market lookup failed");
        }
        if (!market) return errorResult(`Market ${marketId} not found.`);

        const outcome = market.outcomes[outcomeIndex];
        if (!outcome) return errorResult(`Market has no outcome at index ${outcomeIndex}.`);
        if (!outcome.tokenId) return errorResult(`Outcome "${outcome.label}" has no price history.`);

        let points: { t: number; p: number }[];
        try {
          points = await fetchHistory(outcome.tokenId, range);
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : "History fetch failed");
        }

        if (points.length === 0) return errorResult("No price history returned for that outcome/range.");
        const first = points[0].p;
        const last = points[points.length - 1].p;
        const summary = `"${market.question}" — ${outcome.label} over ${range}: ${pct(first)} → ${pct(last)} (${points.length} points, change ${((last - first) * 100).toFixed(1)} pts).`;
        return textResult(summary, {
          marketId: market.id,
          outcome: outcome.label,
          range,
          points,
        });
      },
    );
  },
  {
    serverInfo: { name: "hedgepredict", version: "0.1.0" },
  },
);

/**
 * recommend_market is the expensive tool (Opus + live web search). It shares
 * the website's deep-read budget: 3 per caller per day, web and MCP combined.
 * Checked here, before the MCP handler, because tool callbacks can't see the
 * caller's IP. Everything else passes straight through.
 */
async function POST(request: Request) {
  const body: unknown = await request.clone().json().catch(() => null);
  const calls = (Array.isArray(body) ? body : [body]) as {
    id?: string | number;
    method?: string;
    params?: { name?: string };
  }[];
  const deep = calls.find((c) => c?.method === "tools/call" && c.params?.name === "recommend_market");
  if (deep) {
    const gate = rateLimit(`deep-read:${clientKey(request)}`, LIMITS.deepRead.max, LIMITS.deepRead.windowMs);
    if (!gate.ok) {
      const hours = Math.max(1, Math.round(gate.retryAfterSec / 3600));
      return Response.json({
        jsonrpc: "2.0",
        id: deep.id ?? null,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: `Daily limit reached: ${LIMITS.deepRead.max} deep reads per day (resets in about ${hours}h). get_jev_read is still available and free.`,
            },
          ],
        },
      });
    }
  }
  return handler(request);
}

export { handler as GET, POST };
