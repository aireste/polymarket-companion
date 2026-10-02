import { SITE_URL } from "@/lib/daily";

/** GET /openapi.json: the public read-only JSON API, for bots and agents that don't speak MCP. */
export const revalidate = 86400;

const json = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});
const q = (name: string, description: string, required = true, schema: object = { type: "string" }) => ({
  name,
  in: "query",
  required,
  description,
  schema,
});

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "HedgePredict API",
    version: "1.0.0",
    description:
      "Read-only Polymarket data and HedgePredict's call (Wager / Lean / Skip) on each market. No auth. Decision support, not financial advice. For AI clients, the MCP endpoint at /api/mcp is preferred.",
  },
  servers: [{ url: SITE_URL }],
  paths: {
    "/api/plays": {
      get: { operationId: "getBoard", summary: "Today's ranked board of markets", responses: { 200: json("{ plays: Play[], asOf }") } },
    },
    "/api/jev/board": {
      get: {
        operationId: "getCalls",
        summary: "HedgePredict's call on every board market",
        description: 'action is "wager", "hold" (shown to people as Lean), "skip" or "settled". confidence is how sure the call is, not a chance of winning.',
        responses: { 200: json("{ reads: Read[], asOf }") },
      },
    },
    "/api/market": {
      get: { operationId: "getMarket", summary: "One market by id", parameters: [q("id", "Polymarket market id")], responses: { 200: json("{ play }"), 404: json("Not found") } },
    },
    "/api/search": {
      get: { operationId: "searchMarkets", summary: "Search all Polymarket markets", parameters: [q("q", "Search text, 2+ characters")], responses: { 200: json("{ plays: Play[] }") } },
    },
    "/api/history": {
      get: {
        operationId: "getPriceHistory",
        summary: "Price history for one outcome",
        parameters: [q("token", "Outcome token id (from a play's outcomes)"), q("range", "Time range", false, { type: "string", enum: ["1d", "1w", "1m"], default: "1w" })],
        responses: { 200: json("{ history: { t, p }[] }") },
      },
    },
  },
};

export function GET() {
  return Response.json(SPEC);
}
