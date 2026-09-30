import { fetchMarketById } from "@/lib/polymarket";
import { recommend } from "@/lib/recommend";
import { MissingCredentialsError } from "@/lib/read";
import type { RecommendationDTO } from "@/lib/dto";
import { rateLimit, clientKey, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** The deep read is the one expensive call (Opus + live web search): 3 per visitor per day. */
function deepReadGate(request: Request) {
  const gate = rateLimit(`deep-read:${clientKey(request)}`, LIMITS.deepRead.max, LIMITS.deepRead.windowMs);
  if (gate.ok) return null;
  const hours = Math.max(1, Math.round(gate.retryAfterSec / 3600));
  return Response.json(
    {
      error: `You've used today's ${LIMITS.deepRead.max} deep reads. They reset in about ${hours}h. Jev's call is always free.`,
      limit: true,
    },
    { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
  );
}

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
    const rec = await recommend(market);
    const body: RecommendationDTO = {
      marketId: market.id,
      marketName: market.question,
      currentOdds: market.outcomes.map((o) => ({
        label: o.label,
        price: o.price,
      })),
      endDate: market.endDate ? market.endDate.toISOString() : null,
      gameStartTime: market.gameStartTime ? market.gameStartTime.toISOString() : null,
      aiAction: rec.action,
      confidence: rec.confidence,
      aiProbability: rec.probability,
      crowdSentimentSummary: rec.sentiment,
      actionRationale: rec.rationale,
      model: rec.model,
    };
    return Response.json(body);
  } catch (err) {
    if (err instanceof MissingCredentialsError) {
      return Response.json(
        { available: false, reason: err.message },
        { status: 200 }
      );
    }
    const message = err instanceof Error ? err.message : "Recommendation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}

/** GET /api/v2/recommendations?id=<marketId> */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return handle(id);
  return deepReadGate(request) ?? handle(id);
}

/** POST /api/v2/recommendations  { "id": "<marketId>" } */
export async function POST(request: Request) {
  let id: string | null = null;
  try {
    const body = (await request.json()) as { id?: string };
    id = body?.id ?? null;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!id) return handle(id);
  return deepReadGate(request) ?? handle(id);
}
