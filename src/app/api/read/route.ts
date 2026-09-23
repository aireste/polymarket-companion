import { generateRead, MissingCredentialsError } from "@/lib/read";
import type { Market } from "@/lib/polymarket";
import type { PlayDTO, ReadResponse } from "@/lib/dto";

export const dynamic = "force-dynamic";

/** POST /api/read — Claude's probability read for a market's leading outcome. */
export async function POST(request: Request) {
  let play: PlayDTO;
  try {
    play = (await request.json()) as PlayDTO;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!play?.question || !Array.isArray(play.outcomes) || play.outcomes.length === 0) {
    return Response.json({ error: "Missing market fields" }, { status: 400 });
  }

  // Rebuild the minimal Market shape generateRead consumes.
  const market: Market = {
    id: play.id,
    question: play.question,
    slug: "",
    url: play.url ?? "",
    imageUrl: play.imageUrl ?? null,
    outcomes: play.outcomes.map((o) => ({ label: o.label, price: o.price })),
    volume: play.volume ?? 0,
    volume24hr: play.volume24hr ?? 0,
    liquidity: play.liquidity ?? 0,
    endDate: play.endDate ? new Date(play.endDate) : null,
    active: true,
    closed: false,
    acceptingOrders: true,
  };

  try {
    const read = await generateRead(market);
    const body: ReadResponse = { available: true, ...read };
    return Response.json(body);
  } catch (err) {
    if (err instanceof MissingCredentialsError) {
      const body: ReadResponse = { available: false, reason: err.message };
      return Response.json(body);
    }
    const message = err instanceof Error ? err.message : "Read failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
