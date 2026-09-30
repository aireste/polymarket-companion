import { fetchBoard, toPlayDTO } from "@/lib/board";

// Live odds move constantly; never cache this handler.
export const dynamic = "force-dynamic";

/** GET /api/plays — today's ranked markets worth a look. */
export async function GET() {
  try {
    const plays = (await fetchBoard()).map(toPlayDTO);
    return Response.json({ plays, asOf: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
