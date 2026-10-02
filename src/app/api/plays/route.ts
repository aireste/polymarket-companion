import { fetchBoard, toPlayDTO } from "@/lib/board";
import { toCategory } from "@/lib/filters";

// Live odds move constantly; never cache this handler.
export const dynamic = "force-dynamic";

/** GET /api/plays[?c=sports] — today's ranked markets worth a look, optionally in one category. */
export async function GET(req: Request) {
  try {
    const plays = (await fetchBoard(toCategory(new URL(req.url).searchParams.get("c")))).map(toPlayDTO);
    return Response.json({ plays, asOf: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
