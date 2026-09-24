"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayDTO } from "@/lib/dto";
import { PlayEntry } from "./PlayEntry";
import { Rail } from "./Rail";
import { HowItWorks } from "./HowItWorks";
import { FeaturedMarket } from "./FeaturedMarket";
import { ConnectAI } from "./ConnectAI";
import { AskPanel } from "./AskPanel";

const GUIDE_KEY = "hp_guide_seen";

interface PlaysResponse {
  plays?: PlayDTO[];
  asOf?: string;
  error?: string;
}

export type FilterId = "all" | "hot" | "coinflip" | "soon";

const TABS: Record<FilterId, { label: string; caption: string }> = {
  all: { label: "Today", caption: "Ranked by signal" },
  hot: { label: "Hot", caption: "Most active in the last 24h" },
  coinflip: { label: "Coinflip", caption: "Near 50/50, where a read matters most" },
  soon: { label: "Soon", caption: "Resolving soonest" },
};

function isSoon(p: PlayDTO): boolean {
  if (!p.endDate) return false;
  const days = (new Date(p.endDate).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 7;
}

/** A genuine coin-flip: no outcome is a strong favorite (top price <= 60%). */
function isCoinflip(p: PlayDTO): boolean {
  if (p.outcomes.length === 0) return false;
  const top = Math.max(...p.outcomes.map((o) => o.price));
  return top <= 0.6;
}

function applyFilter(plays: PlayDTO[], f: FilterId): PlayDTO[] {
  switch (f) {
    case "hot":
      return [...plays].sort((a, b) => b.volume24hr - a.volume24hr);
    case "coinflip":
      return plays.filter(isCoinflip).sort((a, b) => b.volume24hr - a.volume24hr);
    case "soon":
      return plays
        .filter(isSoon)
        .sort(
          (a, b) =>
            new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime()
        );
    default:
      return plays;
  }
}

function agoLabel(iso: string | null, now: number): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function Dashboard() {
  const [plays, setPlays] = useState<PlayDTO[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [now, setNow] = useState(() => Date.now());
  const [showGuide, setShowGuide] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Show the guide on a visitor's first arrival only.
  useEffect(() => {
    try {
      if (!localStorage.getItem(GUIDE_KEY)) setShowGuide(true);
    } catch {
      setShowGuide(true);
    }
  }, []);

  const dismissGuide = useCallback(() => {
    setShowGuide(false);
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {}
  }, []);

  const openGuide = useCallback(() => {
    setShowGuide(true);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plays", { cache: "no-store" });
      const data = (await res.json()) as PlaysResponse;
      if (data.error) throw new Error(data.error);
      setPlays(data.plays ?? []);
      setAsOf(data.asOf ?? new Date().toISOString());
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const src = plays ?? [];
  const kpi = useMemo(() => {
    const coinflips = src.filter(isCoinflip).length;
    const soon = src.filter(isSoon).length;
    const avgMomentum =
      src.length > 0
        ? src.reduce((a, p) => a + p.signals.momentum, 0) / src.length
        : 0;
    return { markets: src.length, coinflips, soon, avgMomentum };
  }, [src]);

  // Feature a market people can actually read: liquid, not a longshot, with a
  // token we can chart. Falls back to the top-ranked market.
  const featured = useMemo(() => {
    if (!plays || plays.length === 0) return null;
    const hasToken = (p: PlayDTO) => Boolean(p.outcomes[0]?.tokenId);
    // Prefer genuine coin-flips (smoother charts, more meaningful to hedge),
    // then any non-longshot, then anything charteable.
    const coinflip = plays.filter(
      (p) => hasToken(p) && p.outcomes[0].price >= 0.3 && p.outcomes[0].price <= 0.7
    );
    const readable = plays.filter(
      (p) => hasToken(p) && p.outcomes[0].price >= 0.12 && p.outcomes[0].price <= 0.88
    );
    const pool =
      coinflip.length > 0 ? coinflip : readable.length > 0 ? readable : plays;
    return pool.reduce((a, b) => (b.volume24hr > a.volume24hr ? b : a));
  }, [plays]);

  const view = useMemo(() => {
    const list = plays ? applyFilter(plays, filter) : [];
    return featured ? list.filter((p) => p.id !== featured.id) : list;
  }, [plays, filter, featured]);
  const tab = TABS[filter];
  const panelRef = useRef<HTMLElement>(null);
  // Change the filter in place; don't yank the page down to the panel.
  const goToFilter = useCallback((f: FilterId) => {
    setFilter(f);
  }, []);

  return (
    <div className="shell">
      <Rail filter={filter} setFilter={setFilter} onHelp={openGuide} />

      <main className="main">
        {showGuide && <HowItWorks onClose={dismissGuide} />}

        <div className="page-head">
          <div>
            <h1>Best plays today.</h1>
            <p className="sub">
              {tab.caption}
              {asOf && ` · updated ${agoLabel(asOf, now)}`}
            </p>
          </div>
          <button className="pill pill-dark" onClick={load} disabled={loading}>
            <span aria-hidden>↻</span>
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {featured && <FeaturedMarket key={featured.id} play={featured} />}

        <AskPanel />

        <section className="kpis" aria-label="Today at a glance">
          <button
            className={`kpi grad-a${filter === "all" ? " active" : ""}`}
            onClick={() => goToFilter("all")}
            aria-pressed={filter === "all"}
          >
            <div className="kpi-k">Markets tracked</div>
            <div className="kpi-v">{plays ? kpi.markets : "—"}</div>
            <div className="kpi-sub">live from Polymarket</div>
            <span className="kpi-go">See all markets →</span>
          </button>
          <button
            className={`kpi grad-b${filter === "coinflip" ? " active" : ""}`}
            onClick={() => goToFilter("coinflip")}
            aria-pressed={filter === "coinflip"}
          >
            <div className="kpi-k">Coin-flips</div>
            <div className="kpi-v">{plays ? kpi.coinflips : "—"}</div>
            <div className="kpi-sub">near 50/50</div>
            <span className="kpi-go">See coin-flips →</span>
          </button>
          <button
            className={`kpi grad-c${filter === "soon" ? " active" : ""}`}
            onClick={() => goToFilter("soon")}
            aria-pressed={filter === "soon"}
          >
            <div className="kpi-k">Resolving soon</div>
            <div className="kpi-v">{plays ? kpi.soon : "—"}</div>
            <div className="kpi-sub">within 7 days</div>
            <span className="kpi-go">See resolving soon →</span>
          </button>
        </section>

        <section className="panel" ref={panelRef}>
          <div className="panel-head">
            <h2>
              {tab.label}
              {(filter === "coinflip" || filter === "soon") && (
                <span className="panel-filter-tag">filtered</span>
              )}
            </h2>
            <div className="panel-head-right">
              <span className="meta">
                {plays ? `${view.length} markets` : " "}
              </span>
              {filter !== "all" && (
                <button className="clear-filter" onClick={() => goToFilter("all")}>
                  Show all →
                </button>
              )}
            </div>
          </div>

          {loading && !plays && (
            <div aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="play-skl" key={i}>
                  <div className="bar" style={{ width: "1.2rem" }} />
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    <div className="bar" style={{ width: `${72 - i * 5}%` }} />
                    <div className="bar" style={{ width: "38%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="state err">
              Couldn&apos;t load markets: {error}. Tap Refresh to retry.
            </p>
          )}

          {plays && !error && view.length === 0 && (
            <p className="state">Nothing in this filter right now.</p>
          )}

          {plays && !error && view.length > 0 && (
            <ol className="plays">
              {view.map((play, i) => (
                <PlayEntry
                  key={play.id}
                  play={play}
                  rank={i + 1}
                  isOpen={openId === play.id}
                  onToggle={() =>
                    setOpenId((cur) => (cur === play.id ? null : play.id))
                  }
                />
              ))}
            </ol>
          )}
        </section>

        <ConnectAI />

        <footer className="foot">
          <p className="disc">
            Decision support, not financial advice. HedgePredict never places
            trades. Suggested stakes are fractional-Kelly and capped. Only risk
            what you can afford to lose.
          </p>
          <p style={{ marginTop: "0.55rem" }}>
            Live data via Polymarket Gamma. Reads by Claude when a key is set.{" "}
            <button className="linklike" onClick={openGuide}>
              How it works
            </button>
          </p>
        </footer>
      </main>
    </div>
  );
}
