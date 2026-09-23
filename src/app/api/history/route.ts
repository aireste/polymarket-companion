import type { HistoryPoint } from "@/lib/dto";

export const dynamic = "force-dynamic";

const CLOB = "https://clob.polymarket.com/prices-history";

// range -> Polymarket interval + point fidelity (minutes).
const RANGES: Record<string, { interval: string; fidelity: number }> = {
  "1d": { interval: "1d", fidelity: 15 },
  "1w": { interval: "1w", fidelity: 180 },
  "1m": { interval: "1m", fidelity: 720 },
};

/** GET /api/history?token=<clobTokenId>&range=1d|1w|1m */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const range = searchParams.get("range") ?? "1w";

  if (!token || !/^\d+$/.test(token)) {
    return Response.json({ error: "Missing or invalid token" }, { status: 400 });
  }
  const cfg = RANGES[range] ?? RANGES["1w"];

  const params = new URLSearchParams({
    market: token,
    interval: cfg.interval,
    fidelity: String(cfg.fidelity),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${CLOB}?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json(
        { error: `CLOB returned HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const data: unknown = await res.json();
    const raw = (data as { history?: unknown }).history;
    const history: HistoryPoint[] = Array.isArray(raw)
      ? raw
          .map((d) => {
            const pt = d as { t?: unknown; p?: unknown };
            return { t: Number(pt.t), p: Number(pt.p) };
          })
          .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.p))
      : [];
    return Response.json({ history });
  } catch (err) {
    const message = err instanceof Error ? err.message : "History failed";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
