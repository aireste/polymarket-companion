/**
 * Polymarket US public API client (gateway.polymarket.us, no key needed).
 *
 * Polymarket US is a separate, CFTC-regulated exchange: its own markets, prices and URLs. Its
 * shape differs from international Polymarket in ways that are easy to get wrong:
 *   - Each market is ONE instrument. `marketSides` name the long side (Yes, or a team) and the
 *     short side, but their `price` fields are both quotes on the long instrument. The long
 *     side's price is the mid of `bestBidQuote`/`bestAskQuote`; the short side is 1 minus that.
 *     (`outcomePrices` is that same bid/ask pair, NOT one price per outcome.)
 *   - Markets don't carry volume or liquidity; the order book (/v1/markets/{slug}/book) has
 *     lifetime $ traded and depth, but book/BBO requests are limited to ~5 a minute per IP, so
 *     they're only read for one market at a time (its detail view). There is no 24h volume.
 *     The board ranks on what the events list gives for free: Polymarket US's own volume
 *     ordering (`heat`) and the bid/ask `spread`.
 *   - A market doesn't link back to its event, and the event has the readable title
 *     ("KC Chiefs vs. LV Raiders") and the page URL. So our market id is `eventSlug~marketSlug`.
 *   - A game event holds hundreds of markets (spreads, quarters, props); the board only wants
 *     the full-game winner.
 *
 * We NEVER hand the raw shape to the rest of the app: everything returns normalized `Market`s.
 */

const GATEWAY = "https://gateway.polymarket.us";
export const US_SITE = "https://polymarket.us";

/** One tradable outcome of a market, e.g. { label: "Yes", price: 0.63 }. */
export interface Outcome {
  label: string;
  /** Implied probability in [0,1]. */
  price: number;
  /** Price-history key for this outcome: `<marketSlug>:0` (long side) or `:1` (short side). */
  tokenId?: string;
}

/** A normalized, app-safe prediction market. */
export interface Market {
  /** `eventSlug~marketSlug`. */
  id: string;
  question: string;
  /** The market's own slug (order book, history, settlement are keyed by it). */
  slug: string;
  /** The event's page on polymarket.us, for the human to click through. */
  url: string;
  imageUrl: string | null;
  outcomes: Outcome[];
  /** Lifetime traded volume, USD, from the order book; null when not looked up. */
  volume: number | null;
  /** Trailing 24h volume, USD. Polymarket US doesn't publish it, so always null. */
  volume24hr: number | null;
  /** Order-book depth within 10¢ of the price, USD; null when not looked up. */
  liquidity: number | null;
  /** Popularity 0..1 from Polymarket US's volume ordering (1 = most traded); null off the board. */
  heat: number | null;
  /** Best ask minus best bid on the long side, 0..1; null if either is missing. */
  spread: number | null;
  /** Settlement deadline. */
  endDate: Date | null;
  /** Kickoff for games; null otherwise. Use this, not endDate, for "starts / live / soon" logic. */
  gameStartTime: Date | null;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
}

interface Amount {
  value?: string;
}
interface RawSide {
  description?: string;
  long?: boolean;
  team?: { safeName?: string; name?: string } | null;
}
interface RawMarket {
  id?: string;
  slug?: string;
  question?: string;
  title?: string;
  image?: string;
  endDate?: string;
  createdAt?: string;
  active?: boolean;
  closed?: boolean;
  hidden?: boolean;
  status?: string;
  sportsMarketType?: string;
  marketSides?: RawSide[];
  bestBidQuote?: Amount | null;
  bestAskQuote?: Amount | null;
}
interface RawEvent {
  slug?: string;
  title?: string;
  image?: string;
  category?: string;
  startTime?: string;
  active?: boolean;
  closed?: boolean;
  hidden?: boolean;
  markets?: RawMarket[];
}

/** The full-game winner of a game (not halves or quarters). */
const GAME_WINNER = /(^|_)full_game_winner$|moneyline/;
const SEP = "~";
/** When each market was listed, for the daily-volume average (kept off the public type). */
const listedAt = new WeakMap<Market, Date>();

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
};
const date = (v: unknown) => {
  const d = typeof v === "string" && v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

/** What's known about how a market trades, for AI prompts: e.g. "$1,234 traded all-time, 1.0¢ bid/ask spread". */
export function activityText(m: Pick<Market, "volume" | "liquidity" | "spread">): string {
  const parts = [
    m.volume != null ? `${usd(m.volume)} traded all-time` : null,
    m.liquidity != null ? `${usd(m.liquidity)} order-book liquidity near the price` : null,
    m.spread != null ? `${(m.spread * 100).toFixed(1)}¢ bid/ask spread` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "no volume data";
}

export const marketId = (eventSlug: string, marketSlug: string) => `${eventSlug}${SEP}${marketSlug}`;
/** Split our id back into its event and market slugs; null for anything else (e.g. an old numeric id). */
export function parseMarketId(id: string): { event: string; market: string } | null {
  const [event, market, extra] = id.split(SEP);
  return event && market && extra === undefined ? { event, market } : null;
}

/** The long side's price (mid of the best bid and ask, or either alone) and the spread between them. */
function quote(m: RawMarket): { price: number; spread: number | null } | null {
  const bid = num(m.bestBidQuote?.value);
  const ask = num(m.bestAskQuote?.value);
  const hasBid = bid > 0;
  const hasAsk = ask > 0 && ask < 1;
  if (hasBid && hasAsk) return { price: (bid + ask) / 2, spread: ask - bid };
  if (hasBid) return { price: bid, spread: null };
  if (hasAsk) return { price: ask, spread: null };
  return null;
}

const sideLabel = (s: RawSide | undefined, fallback: string) => s?.description || s?.team?.name || fallback;

/** The markets of an event worth showing: a game's full-game winner, or every market of anything else. */
function eventMarkets(ev: RawEvent): RawMarket[] {
  const markets = ev.markets ?? [];
  const winners = markets.filter((m) => GAME_WINNER.test(m.sportsMarketType ?? ""));
  if (winners.length) return winners;
  // A game whose winner market isn't listed: its props and spreads aren't board material.
  if (ev.category === "sports" && /\bvs\.?\s/i.test(ev.title ?? "")) return [];
  return markets;
}

function normalize(ev: RawEvent, m: RawMarket): Market | null {
  if (!ev.slug || !m.slug || m.hidden) return null;
  const q = quote(m);
  if (!q) return null;
  const p = q.price;
  const isGame = GAME_WINNER.test(m.sportsMarketType ?? "");
  const long = m.marketSides?.find((s) => s.long);
  const short = m.marketSides?.find((s) => !s.long);
  const title = ev.title ?? "";
  // Games read as the matchup; elsewhere the event names the question and the market names the
  // pick ("U.S. Senate Midterm Winner: Democratic Party").
  const question = isGame
    ? title || m.question || ""
    : m.title && title && m.title !== title
      ? `${title.replace(/\?\s*$/, "")}: ${m.title}`
      : m.question || title;
  if (!question) return null;
  const open = m.active !== false && !m.closed && (m.status == null || m.status === "MARKET_STATUS_OPEN");
  const market: Market = {
    id: marketId(ev.slug, m.slug),
    question,
    slug: m.slug,
    url: `${US_SITE}/event/${ev.slug}`,
    imageUrl: m.image || ev.image || null,
    outcomes: [
      { label: sideLabel(long, "Yes"), price: p, tokenId: `${m.slug}:0` },
      { label: sideLabel(short, "No"), price: 1 - p, tokenId: `${m.slug}:1` },
    ],
    volume: null,
    volume24hr: null,
    liquidity: null,
    heat: null,
    spread: q.spread,
    endDate: date(m.endDate),
    gameStartTime: isGame ? date(ev.startTime) : null,
    active: m.active !== false,
    closed: m.closed === true,
    acceptingOrders: open,
  };
  const listed = date(m.createdAt);
  if (listed) listedAt.set(market, listed);
  return market;
}

async function get<T>(path: string, timeoutMs: number, init: RequestInit = { cache: "no-store" }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`Polymarket US returned HTTP ${res.status} for ${path.split("?")[0]}`);
    return (await res.json()) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Polymarket US request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Market types worth calling: a game's winner (moneyline), futures, elections. Without this filter
 * every game event arrives with its hundreds of spread, total and prop markets (~50 MB per page).
 */
const BOARD_TYPES = ["moneyline", "futures", "election"];
/** Events responses are a few MB, so each query is held for 30 s and shared by concurrent requests. */
const EVENTS_TTL_MS = 30_000;
const eventsCache = new Map<string, { at: number; data: Promise<RawEvent[]> }>();

function fetchEvents(params: Record<string, string>, timeoutMs: number): Promise<RawEvent[]> {
  const q = new URLSearchParams({ active: "true", closed: "false", orderBy: "volume", orderDirection: "desc", ...params });
  for (const t of BOARD_TYPES) q.append("marketTypes", t);
  const key = q.toString();
  const hit = eventsCache.get(key);
  if (hit && Date.now() - hit.at < EVENTS_TTL_MS) return hit.data;
  const data = get<{ events?: RawEvent[] }>(`/v1/events?${key}`, timeoutMs).then((d) => d.events ?? []);
  eventsCache.set(key, { at: Date.now(), data });
  data.catch(() => eventsCache.delete(key));
  return data;
}

/** Already decided in all but name (a finished game, a runaway favorite): nothing left to call. */
const DECIDED = 0.97;
const undecided = (m: Market) => m.outcomes.every((o) => o.price < DECIDED);

/** Flatten events to normalized, tradable markets; at most `perEvent` from any one event (most likely first). */
function flatten(events: RawEvent[], perEvent: number, keep: (m: Market) => boolean = () => true): Market[] {
  const out: Market[] = [];
  for (const ev of events) {
    const ms = eventMarkets(ev)
      .map((m) => normalize(ev, m))
      .filter((m): m is Market => m !== null && m.acceptingOrders && keep(m))
      .sort((a, b) => b.outcomes[0].price - a.outcomes[0].price)
      .slice(0, perEvent);
    out.push(...ms);
  }
  return out;
}

interface BookLevel {
  px?: Amount;
  qty?: string;
}
interface Book {
  marketData?: { bids?: BookLevel[]; offers?: BookLevel[]; stats?: { notionalTraded?: Amount } };
}

/** After a 429 we leave the order books alone until this time (ms). */
let booksPausedUntil = 0;

/**
 * Fill in one market's lifetime volume and liquidity from its order book (cached 10 minutes, shared
 * across server instances). Book requests are limited to ~5 a minute per IP, so this is for a
 * single market's detail view, never the whole board; a 429 pauses lookups for a minute.
 */
async function withBookStats(m: Market, timeoutMs: number): Promise<Market> {
  if (Date.now() < booksPausedUntil) return m;
  try {
    const b = await get<Book>(`/v1/markets/${encodeURIComponent(m.slug)}/book`, timeoutMs, { next: { revalidate: 600 } });
    const md = b.marketData ?? {};
    const p = m.outcomes[0].price;
    const depth = (levels: BookLevel[] = []) =>
      levels.reduce((s, l) => {
        const px = num(l.px?.value);
        const qty = num(l.qty);
        return Number.isFinite(px) && Number.isFinite(qty) && Math.abs(px - p) <= 0.1 ? s + px * qty : s;
      }, 0);
    const vol = num(md.stats?.notionalTraded?.value);
    m.volume = Number.isFinite(vol) ? vol : null;
    m.liquidity = depth(md.bids) + depth(md.offers);
  } catch (err) {
    if (err instanceof Error && err.message.includes("HTTP 429")) booksPausedUntil = Date.now() + 60_000;
  }
  return m;
}

export interface FetchMarketsOptions {
  /** Max markets to return before ranking. Default 24. */
  limit?: number;
  /** Polymarket US categories (e.g. ["sports"]); null/empty = everything. */
  categories?: string[] | null;
  /** Abort each request after this many ms. Default 10s. */
  timeoutMs?: number;
}

/** Wider than this between bid and ask and you can't get a fair fill: not board material. */
const MAX_SPREAD = 0.1;

/**
 * The candidate pool for the board: the highest-volume open events, plus the biggest games
 * starting in the next 36 hours (or in progress), flattened to undecided, tradable markets.
 * Polymarket US sorts events by volume server-side; each market's place in that order is its `heat`.
 */
export async function fetchMarkets(opts: FetchMarketsOptions = {}): Promise<Market[]> {
  const { limit = 40, categories, timeoutMs = 10_000 } = opts;
  const cats: Record<string, string> = categories?.length ? { categories: categories.join(",") } : {};
  const withGames = !categories?.length || categories.includes("sports");
  const now = Date.now();
  const [top, games] = await Promise.all([
    fetchEvents({ limit: "50", ...cats }, timeoutMs),
    withGames
      ? fetchEvents(
          {
            limit: "60",
            categories: "sports",
            startTimeMin: new Date(now - 4 * 3_600_000).toISOString(),
            startTimeMax: new Date(now + 36 * 3_600_000).toISOString(),
          },
          timeoutMs
        ).catch(() => [])
      : Promise.resolve([]),
  ]);
  // Half the pool from the biggest events, the rest from today's games, then top up from either.
  const keep = (m: Market) => undecided(m) && (m.spread == null || m.spread <= MAX_SPREAD);
  // One market per event: its favorite. The other picks in a race ("Republican Party" next to
  // "Democratic Party") are mostly the same question flipped, and they'd crowd out everything else.
  const a = flatten(top, 1, keep);
  const b = flatten(games, 1, keep);
  // Heat: place in its own volume-ordered list (a game counts once, at its better place).
  const heat = (list: Market[]) => list.forEach((m, i) => (m.heat = Math.max(m.heat ?? 0, 1 - i / Math.max(1, list.length))));
  heat(a);
  heat(b);
  const seen = new Set<string>();
  const pool: Market[] = [];
  const take = (list: Market[], n: number) => {
    for (const m of list) {
      if (pool.length >= limit || n <= 0) break;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      pool.push(m);
      n--;
    }
  };
  take(a, Math.ceil(limit / 2));
  take(b, limit);
  take(a, limit);
  return pool;
}

/**
 * Keyword-search everything on Polymarket US: a team, a candidate, "bitcoin". Search returns
 * events; we flatten them like the board does (a game's winner, a future's top picks), rank
 * markets that name the query's words first, and keep the search's own order to break ties.
 */
export async function searchMarkets(query: string, limit = 12, timeoutMs = 10_000): Promise<Market[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({ query: q, limit: "20" });
  const data = await get<{ events?: RawEvent[] }>(`/v1/search?${params}`, timeoutMs);
  const events = (data.events ?? []).filter((e) => e.active !== false && !e.closed);
  const markets = flatten(events, 4);
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const hits = (m: Market) => words.filter((w) => m.question.toLowerCase().includes(w)).length;
  const scored = markets.map((m, i) => ({ m, i, n: hits(m) }));
  const pool = scored.some((x) => x.n > 0) ? scored.filter((x) => x.n > 0) : scored;
  pool.sort((x, y) => y.n - x.n || x.i - y.i);
  return pool.slice(0, limit).map((x) => x.m);
}

/** One market by our id (`eventSlug~marketSlug`), with its order-book stats. Null if not found. */
export async function fetchMarketById(id: string, timeoutMs = 10_000): Promise<Market | null> {
  const ref = parseMarketId(id);
  if (!ref) return null;
  const data = await get<{ events?: RawEvent[] }>(`/v1/events?${new URLSearchParams({ slug: ref.event })}`, timeoutMs);
  const ev = data.events?.[0];
  const raw = ev?.markets?.find((m) => m.slug === ref.market);
  const m = ev && raw ? normalize(ev, raw) : null;
  return m ? withBookStats(m, timeoutMs) : null;
}

/**
 * How a resolved market settled: 1 = the long side (outcome 0) won, 0 = the short side won.
 * Null while it's still open (the API 404s until settlement).
 */
export async function fetchSettlement(marketSlug: string, timeoutMs = 10_000): Promise<number | null> {
  try {
    const d = await get<{ settlement?: number | string }>(`/v1/markets/${encodeURIComponent(marketSlug)}/settlement`, timeoutMs);
    const s = num(d.settlement);
    return Number.isFinite(s) ? s : null;
  } catch {
    return null;
  }
}
