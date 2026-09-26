/**
 * Polymarket Gamma API client.
 *
 * Gamma returns several fields as JSON-ENCODED STRINGS, not native types:
 *   outcomes        -> '["Yes", "No"]'
 *   outcomePrices   -> '["0.003", "0.997"]'
 *   clobTokenIds    -> '["27146...", "33216..."]'
 * and numeric fields (volume, liquidity) arrive as strings too.
 *
 * We NEVER hand the raw shape to the rest of the app. `fetchMarkets` returns
 * normalized `Market` objects with real arrays and numbers, so a schema quirk
 * upstream can't silently corrupt the UI or the scoring engine.
 */

const GAMMA_BASE = "https://gamma-api.polymarket.com";

/** One tradable outcome of a market, e.g. { label: "Yes", price: 0.003 }. */
export interface Outcome {
  label: string;
  /** Implied probability in [0,1]. Polymarket prices ARE the implied prob. */
  price: number;
  /** CLOB token id for this outcome — used to fetch price history. */
  tokenId?: string;
}

/** A normalized, app-safe prediction market. */
export interface Market {
  id: string;
  question: string;
  slug: string;
  /** Canonical Polymarket URL for the human to click through. */
  url: string;
  imageUrl: string | null;
  outcomes: Outcome[];
  /** Lifetime traded volume, USD. */
  volume: number;
  /** Trailing 24h volume, USD — our best "is this hot today?" signal. */
  volume24hr: number;
  /** Order-book liquidity, USD. */
  liquidity: number;
  /** Oracle settlement deadline. For sports this is a far-future cushion, NOT
      when the game happens, so don't use it to sort/display live matches. */
  endDate: Date | null;
  /** Real event/kickoff time for scheduled markets (sports); null otherwise.
      Use this, not endDate, for "starts / live / soon" logic. */
  gameStartTime: Date | null;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
}

/** Raw shape as returned by Gamma (only the fields we consume). */
interface RawMarket {
  id?: string;
  question?: string;
  slug?: string;
  image?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  volume?: string;
  volumeNum?: number;
  volume24hr?: number;
  liquidity?: string;
  liquidityNum?: number;
  endDate?: string;
  gameStartTime?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
}

/** Parse a JSON-encoded string field into a string[]; [] on any failure. */
function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Coerce a string|number|undefined into a finite number, else fallback. */
function toNumber(raw: unknown, fallback = 0): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse Gamma's game-start timestamp, which arrives NON-standard, e.g.
 * "2026-09-24 02:10:00+00" (space instead of T, short "+00" offset). Node is
 * lenient but Safari returns Invalid Date, so normalize before `new Date`.
 */
function parseGameStart(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const iso = raw
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00"); // "+00" -> "+00:00"; leaves Z / +00:00 alone
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Turn a RawMarket into a normalized Market, or null if it's unusable. */
function normalize(raw: RawMarket): Market | null {
  if (!raw?.id || !raw.question) return null;

  const labels = parseStringArray(raw.outcomes);
  const prices = parseStringArray(raw.outcomePrices);
  const tokenIds = parseStringArray(raw.clobTokenIds);
  if (labels.length === 0) return null;

  const outcomes: Outcome[] = labels.map((label, i) => ({
    label,
    price: toNumber(prices[i], NaN),
    tokenId: tokenIds[i],
  }));

  const slug = raw.slug ?? "";
  const endDate = raw.endDate ? new Date(raw.endDate) : null;

  return {
    id: raw.id,
    question: raw.question,
    slug,
    url: slug ? `https://polymarket.com/market/${slug}` : "https://polymarket.com",
    imageUrl: raw.image || null,
    outcomes,
    volume: toNumber(raw.volumeNum ?? raw.volume),
    volume24hr: toNumber(raw.volume24hr),
    liquidity: toNumber(raw.liquidityNum ?? raw.liquidity),
    endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
    gameStartTime: parseGameStart(raw.gameStartTime),
    active: raw.active === true,
    closed: raw.closed === true,
    acceptingOrders: raw.acceptingOrders !== false,
  };
}

export interface FetchMarketsOptions {
  /** Max markets to pull (Gamma caps around 500/req). Default 100. */
  limit?: number;
  /** Field to sort by, e.g. "volume24hr" | "volumeNum" | "liquidityNum". */
  orderBy?: string;
  /** Abort the request after this many ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Fetch active, open, order-book-enabled markets from Gamma, normalized.
 * Throws a descriptive Error on network/HTTP failure so callers can surface it.
 */
export async function fetchMarkets(
  opts: FetchMarketsOptions = {}
): Promise<Market[]> {
  const { limit = 100, orderBy = "volume24hr", timeoutMs = 10_000 } = opts;

  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(limit),
    order: orderBy,
    ascending: "false",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${GAMMA_BASE}/markets?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      // Live odds move constantly; never serve a stale cache.
      cache: "no-store",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Gamma API request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`Gamma API returned HTTP ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Gamma API returned an unexpected (non-array) payload");
  }

  return (data as RawMarket[])
    .map(normalize)
    .filter((m): m is Market => m !== null && m.acceptingOrders && !m.closed);
}

/**
 * Keyword-search the FULL Polymarket universe (not just the curated dashboard
 * set), e.g. "bitcoin", "ethereum", a candidate, a team. Hits Gamma's
 * public-search, which returns events; we flatten their markets, normalize, keep
 * only tradable ones (active, open, accepting orders), dedupe, and sort by 24h
 * volume so the meaningful markets come first. Returns [] on no matches.
 */
export async function searchMarkets(
  query: string,
  limit = 12,
  timeoutMs = 10_000
): Promise<Market[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({ q, limit_per_type: "20" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${GAMMA_BASE}/public-search?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Gamma search request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`Gamma search returned HTTP ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  const events = (data as { events?: { markets?: RawMarket[] }[] })?.events;
  if (!Array.isArray(events)) return [];

  const seen = new Set<string>();
  const markets: Market[] = [];
  for (const ev of events) {
    for (const raw of ev.markets ?? []) {
      const m = normalize(raw);
      if (!m) continue;
      // Only tradable markets — search surfaces resolved/closed ones too.
      if (!m.active || m.closed || !m.acceptingOrders) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      markets.push(m);
    }
  }

  markets.sort((a, b) => b.volume24hr - a.volume24hr);
  return markets.slice(0, limit);
}

/** Fetch and normalize a single market by its Gamma id. Null if not found. */
export async function fetchMarketById(
  id: string,
  timeoutMs = 10_000
): Promise<Market | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GAMMA_BASE}/markets/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Gamma API returned HTTP ${res.status} ${res.statusText}`);
    }
    const data: unknown = await res.json();
    // Gamma may return a single object or a one-element array.
    const raw = Array.isArray(data) ? data[0] : data;
    return raw ? normalize(raw as RawMarket) : null;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Gamma market lookup failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}
