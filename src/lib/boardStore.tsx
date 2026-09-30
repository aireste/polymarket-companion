"use client";

/**
 * One client-side store for the whole app shell. It lives in the root layout,
 * so switching pages (Board -> Live -> Ask -> back) never refetches: the board,
 * Jev's reads and the sparklines load once and are shared by every view.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HistoryPoint, JevBoardResponse, JevReadDTO, PlayDTO } from "./dto";

export type JevStatus = "loading" | "ready" | "offline" | "error";

interface BoardState {
  plays: PlayDTO[] | null;
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
}

const Ctx = createContext<BoardState | null>(null);

export function useBoard(): BoardState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoard must be used inside <BoardProvider>");
  return ctx;
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const [plays, setPlays] = useState<PlayDTO[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reads, setReads] = useState<Record<string, JevReadDTO>>({});
  const [jevStatus, setJevStatus] = useState<JevStatus>("loading");
  const [sparks, setSparks] = useState<Record<string, HistoryPoint[]>>({});
  const [extras, setExtras] = useState<Record<string, PlayDTO>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadJev = useCallback(async () => {
    setJevStatus("loading");
    try {
      const data = (await (await fetch("/api/jev/board", { cache: "no-store" })).json()) as JevBoardResponse;
      if ("reads" in data) {
        setReads((cur) => ({ ...cur, ...data.reads }));
        setJevStatus("ready");
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plays", { cache: "no-store" });
      const data = (await res.json()) as { plays?: PlayDTO[]; asOf?: string; error?: string };
      if (data.error) throw new Error(data.error);
      const list = data.plays ?? [];
      setPlays(list);
      setAsOf(data.asOf ?? new Date().toISOString());
      setNow(Date.now());
      loadJev();
      loadSparks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets.");
    } finally {
      setLoading(false);
    }
  }, [loadJev, loadSparks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const setRead = useCallback(
    (read: JevReadDTO) => setReads((cur) => ({ ...cur, [read.marketId]: read })),
    []
  );
  const addExtra = useCallback(
    (p: PlayDTO) => setExtras((cur) => (cur[p.id] ? cur : { ...cur, [p.id]: p })),
    []
  );
  const findPlay = useCallback(
    (id: string | null) => (id ? plays?.find((p) => p.id === id) ?? extras[id] ?? null : null),
    [plays, extras]
  );

  const value = useMemo<BoardState>(
    () => ({
      plays, asOf, loading, error, refresh,
      reads, jevStatus, setRead,
      sparks, extras, addExtra, findPlay,
      paletteOpen, setPaletteOpen, now,
    }),
    [plays, asOf, loading, error, refresh, reads, jevStatus, setRead, sparks, extras, addExtra, findPlay, paletteOpen, now]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
