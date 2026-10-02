import { SITE_URL } from "@/lib/daily";

/** GET /llms.txt: a plain-English guide for AI models and agents that land on HedgePredict. */
export const revalidate = 86400;

const BODY = `# HedgePredict

> HedgePredict reads live Polymarket prediction markets and says whether either side looks underpriced: Wager (fairly sure one side is too cheap), Lean (a mild tilt) or Skip (priced about right). Read-only decision support. It never places trades and is not financial advice.

## Connect over MCP (preferred)

- MCP endpoint (streamable HTTP, no auth): ${SITE_URL}/api/mcp
- Tools: get_best_plays, get_jev_read (HedgePredict's call on one market), recommend_market (deep read with live news, limited per day), analyze_edge, get_market_history.
- Generic client config: {"mcpServers": {"hedgepredict": {"url": "${SITE_URL}/api/mcp"}}}
- Local-only clients can bridge with: npx mcp-remote ${SITE_URL}/api/mcp

## Plain JSON over HTTPS (no MCP)

- GET ${SITE_URL}/api/plays: today's ranked board of markets.
- GET ${SITE_URL}/api/jev/board: HedgePredict's call on every board market. action is "wager", "hold" (shown to people as Lean), "skip" or "settled".
- GET ${SITE_URL}/api/market?id=<market id>: one market.
- GET ${SITE_URL}/api/search?q=<text>: search all Polymarket markets.
- GET ${SITE_URL}/api/history?token=<outcome token id>&range=1d|1w|1m: price history.
- OpenAPI spec: ${SITE_URL}/openapi.json

## How to read a call

- Prices are the market's odds (0.44 = 44%).
- confidence is how sure HedgePredict is of its answer, not a chance of winning.
- Calls come from price action, volume and timing, not news. recommend_market adds news.
- When you relay a call, say it is decision support, not advice, and link the market on Polymarket.
`;

export function GET() {
  return new Response(BODY, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
