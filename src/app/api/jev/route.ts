import { fetchMarketById } from "@/lib/polymarket";
import { jevRead, MissingGatewayKeyError } from "@/lib/jev";
import type { JevReadDTO } from "@/lib/dto";

// Jev is a fast decision call, but never cache live-market results.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(id: string | null) {
  if (!id) {
    return Response.json({ error: "Missing market id" }, { status: 400 });
  }

  let market;
  try {
    market = await fetchMarketById(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return Response.json({ error: message }, { status: 502 });
  }
  if (!market) {
    return Response.json({ error: `Market ${id} not found` }, { status: 404 });
  }

  try {
    const jev = await jevRead(market);
    const body: JevReadDTO = {
      marketId: market.id,
      marketName: market.question,
      outcome: jev.outcome,
      marketPrice: jev.marketPrice,
      jevProbability: jev.probability,
      edge: jev.edge,
      action: jev.action,
      actionProbabilities: jev.actionProbabilities,
      valuation: jev.valuation,
      confidence: jev.confidence,
      model: jev.model,
    };
    return Response.json(body);
  } catch (err) {
    if (err instanceof MissingGatewayKeyError) {
      return Response.json({ available: false, reason: err.message }, { status: 200 });
    }
    const message = err instanceof Error ? err.message : "Jev evaluation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

/** GET /api/jev?id=<marketId> */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handle(searchParams.get("id"));
}

/** POST /api/jev  { "id": "<marketId>" } */
export async function POST(request: Request) {
  let id: string | null = null;
  try {
    const body = (await request.json()) as { id?: string };
    id = body?.id ?? null;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return handle(id);
}
