"use client";

/**
 * One client-side store for the whole app shell. It lives in the root layout,
 * so switching pages (Board -> Sports -> Ask -> back) never refetches: each
 * category board, Jev's reads and the sparklines load once and are shared by
 * every view. Only the open category is polled.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { HistoryPoint, JevBoardResponse, JevReadDTO, PlayDTO } from "./dto";
import { isLive } from "./format";
import type { CategoryId } from "./filters";

/** Same line as the server (lib/jev.ts): one side at 97%+ means the market is effectively decided. */
const DECIDED_AT = 0.97;

export type JevStatus = "loading" | "ready" | "offline" | "error";

interface BoardState {
  /** The board for the open category. */
  plays: PlayDTO[] | null;
  category: CategoryId;
  /** Boards call this with their route's category; loads it the first time. */
  setCategory: (c: CategoryId) => void;
  asOf: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Jev's read per market id (board batch + any on-demand reads). */
  reads: Record<string, JevReadDTO>;
  jevStatus: JevStatus;
  setRead: (read: JevReadDTO) => void;
  /** 1W sparkline per outcome token id. */
  sparks: Record<string, HistoryPoint[]>;
  /** Off-board markets opened from search or a shared link. */
  extras: Record<string, PlayDTO>;
  addExtra: (p: PlayDTO) => void;
  findPlay: (id: string | null) => PlayDTO | null;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  /** Ticks every 30s so countdowns stay honest. */
  now: number;
  /** Last price move per market (from the 20s poll), for flashes and deltas. */
  moves: Record<string, PriceMove>;
  /** When Jev's board read last landed; the table replays its scan on change. */
  jevReadAt: number | null;
}

export interface PriceMove {
  /** Change in the leading outcome's price since the board loaded, in [−1,1]. */
  delta: number;
  /** Direction of the most recent tick, and when it happened. */
  dir: 1 | -1;
  at: number;
}

const PRICE_POLL_MS = 20_000;
const JEV_REFRESH_MS = 10 * 60_000;
/** While any game is live, pull fresh calls every 2 minutes (the server caches live games for 2 too). */
const JEV_LIVE_REFRESH_MS = 2 * 60_000;

const Ctx = createContext<BoardState | null>(null);

export function useBoard(): BoardState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const [category, setCategoryState] = useState<CategoryId>("all");
  const [boards, setBoards] = useState<Partial<Record<CategoryId, PlayDTO[]>>>({});
  const plays = boards[category] ?? null;
  const setPlays = useCallback(
    (c: CategoryId, fn: (cur: PlayDTO[] | null) => PlayDTO[] | null) =>
      setBoards((b) => {
        const next = fn(b[c] ?? null);
        return next === (b[c] ?? null) ? b : { ...b, [c]: next ?? undefined };
      }),
    []
  );
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState<Record<string, JevReadDTO>>({});
  const [jevStatus, setJevStatus] = useState<JevStatus>("loading");
  const [sparks, setSparks] = useState<Record<string, HistoryPoint[]>>({});
  const [extras, setExtras] = useState<Record<string, PlayDTO>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [moves, setMoves] = useState<Record<string, PriceMove>>({});
  const [jevReadAt, setJevReadAt] = useState<number | null>(null);

  const lastJev = useRef<Partial<Record<CategoryId, number>>>({});
  const playsRef = useRef<PlayDTO[] | null>(null);
  const catRef = useRef<CategoryId>("all");
  const q = (c: CategoryId) => (c === "all" ? "" : `?c=${c}`);
  const loadJev = useCallback(async (c: CategoryId) => {
    setJevStatus("loading");
    try {
      const data = (await (await fetch(`/api/jev/board${q(c)}`, { cache: "no-store" })).json()) as JevBoardResponse;
      if ("reads" in data) {
        setReads((cur) => ({ ...cur, ...data.reads }));
        setJevStatus("ready");
        setJevReadAt(Date.now());
        lastJev.current[c] = Date.now();
      } else {
        setJevStatus("available" in data ? "offline" : "error");
      }
    } catch {
      setJevStatus("error");
    }
  }, []);

  const loadSparks = useCallback(async (list: PlayDTO[]) => {
    const tokens = list.map((p) => p.outcomes[0]?.tokenId).filter(Boolean).join(",");
    if (!tokens) return;
    try {
      const data = (await (await fetch(`/api/sparks?tokens=${tokens}`)).json()) as {
        sparks?: Record<string, HistoryPoint[]>;
      };
      if (data.sparks) setSparks((cur) => ({ ...cur, ...data.sparks }));
    } catch {
      /* sparklines are decoration; the table works without them */
    }
  }, []);

  const load = useCallback(async (c: CategoryId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plays${q(c)}`, { cache: "no-store" });
      const data = (await res.json()) as { plays?: PlayDTO[]; asOf?: string; error?: string };
      if (data.error) throw new Error(data.error);
      const list = data.plays ?? [];
      setPlays(c, () => list);
      setMoves({});
      setAsOf(data.asOf ?? new Date().toISOString());
      setNow(Date.now());
      loadJev(c);
      loadSparks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets.");
    } finally {
      setLoading(false);
    }
  }, [loadJev, loadSparks, setPlays]);

  /** The Refresh button: re-rank the open category. */
  const refresh = useCallback(() => load(catRef.current), [load]);

  const loaded = useRef(new Set<CategoryId>());
  const setCategory = useCallback(
    (c: CategoryId) => {
      catRef.current = c;
      setCategoryState(c);
      setError(null);
      if (loaded.current.has(c)) {
        // Cached board: show it now, and catch its calls up if they're stale.
        if (Date.now() - (lastJev.current[c] ?? 0) >= JEV_REFRESH_MS) loadJev(c);
        return;
      }
      loaded.current.add(c);
      load(c);
    },
    [load, loadJev]
  );

  // Pages without a board (Ask, Hedge Lab…) still want the main board for search and picks.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!loaded.current.size) setCategory("all");
    }, 0);
    return () => clearTimeout(t);
  }, [setCategory]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /**
   * Live prices: re-read the board every 20s (only while the tab is visible)
   * and update prices in place. Rows keep their order so nothing jumps under
   * the cursor; the Refresh button re-ranks.
   */
  const pollPrices = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const c = catRef.current;
      const data = (await (await fetch(`/api/plays${q(c)}`, { cache: "no-store" })).json()) as {
        plays?: PlayDTO[];
        asOf?: string;
      };
      if (!data.plays) return;
      const fresh = new Map(data.plays.map((p) => [p.id, p]));
      const at = Date.now();
      setPlays(c, (cur) => {
        if (!cur) return cur;
        const moved: Record<string, PriceMove> = {};
        const next = cur.map((p) => {
          const f = fresh.get(p.id);
          if (!f) return p;
          const before = p.outcomes[0]?.price ?? 0;
          const after = f.outcomes[0]?.price ?? before;
          if (Math.abs(after - before) >= 0.0005) {
            moved[p.id] = { delta: after - before, dir: after > before ? 1 : -1, at };
          }
          return { ...p, outcomes: f.outcomes, volume24hr: f.volume24hr, liquidity: f.liquidity };
        });
        if (Object.keys(moved).length) {
          setMoves((m) => {
            const out = { ...m };
            for (const [id, mv] of Object.entries(moved)) {
              out[id] = { ...mv, delta: (m[id]?.delta ?? 0) + mv.delta };
            }
            return out;
          });
          // Extend the sparklines with the new point.
          setSparks((sp) => {
            const out = { ...sp };
            for (const p of next) {
              const tok = p.outcomes[0]?.tokenId;
              if (tok && moved[p.id] && out[tok]) {
                out[tok] = [...out[tok], { t: Math.floor(at / 1000), p: p.outcomes[0].price }];
              }
            }
            return out;
          });
        }
        return next;
      });
      if (data.asOf) setAsOf(data.asOf);
    } catch {
      /* next poll will try again */
    }
  }, [setPlays]);

  useEffect(() => {
    const prices = setInterval(pollPrices, PRICE_POLL_MS);
    // Check every 30s: refresh calls after 10 minutes, or after 2 while a game is live.
    const jev = setInterval(() => {
      const c = catRef.current;
      const age = Date.now() - (lastJev.current[c] ?? 0);
      const live = playsRef.current?.some((p) => isLive(p.gameStartTime)) ?? false;
      if (age >= JEV_REFRESH_MS || (live && age >= JEV_LIVE_REFRESH_MS)) loadJev(c);
    }, 30_000);
    return () => {
      clearInterval(prices);
      clearInterval(jev);
    };
  }, [pollPrices, loadJev]);

  const setRead = useCallback(
    (read: JevReadDTO) => setReads((cur) => ({ ...cur, [read.marketId]: read })),
    []
  );
  const addExtra = useCallback(
    (p: PlayDTO) => setExtras((cur) => (cur[p.id] ? cur : { ...cur, [p.id]: p })),
    []
  );
  // Every market we've loaded, across categories, so a market opened from one board still resolves on another.
  const known = useMemo(() => {
    const m = new Map<string, PlayDTO>();
    for (const list of Object.values(boards)) list?.forEach((p) => m.set(p.id, p));
    return m;
  }, [boards]);
  const findPlay = useCallback(
    (id: string | null) => (id ? plays?.find((p) => p.id === id) ?? known.get(id) ?? extras[id] ?? null : null),
    [plays, known, extras]
  );

  // A cached call can lag a fast live game. The moment the live price (polled
  // every 20s) puts either side at 97%+, show it as Decided everywhere, the same
  // rule the server applies, instead of waiting up to 10 minutes for a fresh read.
  const liveReads = useMemo(() => {
    const out: Record<string, JevReadDTO> = {};
    for (const [id, r] of Object.entries(reads)) {
      const p = known.get(id) ?? extras[id];
      out[id] =
        p && !r.settled && p.outcomes.some((o) => o.price >= DECIDED_AT)
          ? {
              ...r,
              sides: p.outcomes.map((o) => ({ label: o.label, price: o.price })),
              lean: null,
              strength: 1,
              distribution: { sides: p.outcomes.map(() => 0), neither: 1 },
              action: "skip",
              confidence: null,
              settled: true,
            }
          : r;
    }
    return out;
  }, [reads, known, extras]);

  useEffect(() => {
    playsRef.current = plays;
  }, [plays]);

  const value = useMemo<BoardState>(
    () => ({
      plays, category, setCategory, asOf, loading, error, refresh,
      reads: liveReads, jevStatus, setRead,
      sparks, extras, addExtra, findPlay,
      paletteOpen, setPaletteOpen, now, moves, jevReadAt,
    }),
    [plays, category, setCategory, asOf, loading, error, refresh, liveReads, jevStatus, setRead, sparks, extras, addExtra, findPlay, paletteOpen, now, moves, jevReadAt]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** A clock for components that need to tick every second (countdowns, the ET clock). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
