/**
 * HedgePredict Daily: a conversational 2-minute read, not a copy of the board. One issue =
 * an opener, the pick and the case for it, a couple of plays per beat (sports, politics, economy &
 * crypto, culture) with a note on each, one popular market we're passing on, and the week ahead.
 *
 * The calls come from the same boards, Jev reads and pick rule as the site, so the email never
 * disagrees with the app. The words come from one writing pass over those numbers plus a news
 * lookup for the pick and each beat's lead play (see dailyWriter.ts); if that's unavailable the issue still goes out with plain
 * notes built from the numbers.
 */
import { getBoardReads } from "./jevBoard";
import { toPlayDTO } from "./board";
import { todaysPick } from "./pick";
import { fetchHistory } from "./history";
import { fetchUpcoming } from "./polymarket";
import { MARKET_TZ, cents, isLive, whenMs } from "./format";
import type { CategoryId } from "./filters";
import type { JevReadDTO, PlayDTO } from "./dto";
import { buildBackground, type Background } from "./background";
import { writeDaily, type PlayFacts } from "./dailyWriter";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hedgepredict.co";
/** Bump when the stored issue's shape changes, so older saved issues are rebuilt, not rendered. */
export const ISSUE_VERSION = 2;

export interface IssueMarket {
  id: string;
  question: string;
  /** Deep link into HedgePredict with this market open. */
  href: string;
  /** Polymarket's own page. */
  url: string;
  /** Leading outcome and its price, for context lines. */
  outcome: string;
  price: number;
  /** Our call on it, if any (none = the prices look fair). */
  call?: { action: JevReadDTO["action"]; side: string; sidePrice: number; strength: number; confidence: number | null };
  /** How sure we are both prices are fair, when there's no call. */
  fair?: number;
  /** "8:30 PM ET" or "Oct 3" */
  when: string;
  /** A game (it starts at `when`) rather than a market that resolves by then. */
  game: boolean;
  /** Change in the leading outcome's price over the last 24h, in [-1,1]. */
  move24h?: number;
  /** What's going on, from a news search: the pick gets 2-3 sentences, plays one line. */
  background?: Background;
  /** The conversational note on this play. */
  note?: string;
}

export interface IssueBeat {
  id: string;
  label: string;
  plays: IssueMarket[];
}

export interface WeekItem {
  id: string;
  /** "Sun, Oct 4" */
  day: string;
  question: string;
  href: string;
  /** "Colts 65%" */
  price: string;
}

export interface DailyIssue {
  v: number;
  /** YYYY-MM-DD in ET: one issue per day, and the archive key. */
  date: string;
  /** "WEDNESDAY, SEP30" (OP_DAILY-style). */
  title: string;
  subject: string;
  /** Two or three conversational sentences on what today is about. */
  opener: string | null;
  pick: IssueMarket | null;
  /** The case for the pick (or for sitting out). */
  pickWhy: string | null;
  beats: IssueBeat[];
  /** A popular market we think is priced fair, and say so. */
  pass: IssueMarket | null;
  weekIntro: string | null;
  week: WeekItem[];
  /** One line on how recent calls did, once there are enough graded to mean something. */
  scorecard: string | null;
  signoff: string | null;
  counts: { wager: number; lean: number; skip: number; decided: number };
  generatedAt: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const verb = (a: string) => (a === "wager" ? "Wager" : "Lean");

/** Today's ET date: the issue key ("2026-10-03") and its masthead title ("SATURDAY, OCT03"). */
export function etDay(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "short", day: "2-digit", year: "numeric" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: MARKET_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const long = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "long", day: "numeric" }).format(d);
  return { iso, title: `${p.weekday.toUpperCase()}, ${p.month.toUpperCase()}${p.day}`, long };
}

/**
 * When a play happens, for a reader who may open the email hours later: a game today is a time
 * ("4:15 PM ET"), a game later this week names the day ("Sun 9:30 AM ET"), anything else is a date
 * ("Nov 3").
 */
function whenLabel(p: PlayDTO, now = Date.now()): string {
  const t = whenMs(p);
  if (!Number.isFinite(t)) return "an open date";
  const d = new Date(t);
  const day = (x: Date | number) => new Intl.DateTimeFormat("en-CA", { timeZone: MARKET_TZ }).format(x);
  const time = d.toLocaleTimeString("en-US", { timeZone: MARKET_TZ, hour: "numeric", minute: "2-digit" });
  if (p.gameStartTime && day(d) === day(now)) return `${time} ET`;
  if (p.gameStartTime && t - now < 7 * 86_400_000) return `${d.toLocaleDateString("en-US", { timeZone: MARKET_TZ, weekday: "short" })} ${time} ET`;
  return d.toLocaleDateString("en-US", { timeZone: MARKET_TZ, month: "short", day: "numeric" });
}

function toItem(p: PlayDTO, read?: JevReadDTO): IssueMarket {
  const side = read && read.lean != null ? read.sides[read.lean] : null;
  const live = read && !read.settled;
  return {
    id: p.id,
    question: p.question,
    href: `${SITE_URL}/?m=${p.id}`,
    url: p.url,
    outcome: p.outcomes[0]?.label ?? "",
    price: p.outcomes[0]?.price ?? 0,
    call:
      live && side && read.action !== "skip"
        ? { action: read.action, side: side.label, sidePrice: side.price, strength: read.strength, confidence: read.confidence }
        : undefined,
    fair: live && read.action === "skip" ? read.strength : undefined,
    when: whenLabel(p),
    game: p.gameStartTime != null,
  };
}

/** 24h change of the leading outcome, from the 1-day price series (best effort). */
async function move24h(p: PlayDTO): Promise<number | undefined> {
  const token = p.outcomes[0]?.tokenId;
  if (!token) return undefined;
  try {
    const h = await fetchHistory(token, "1d");
    return h.length > 1 ? h[h.length - 1].p - h[0].p : undefined;
  } catch {
    return undefined;
  }
}

/** The Daily's beats, each drawn from one or more category boards. */
const BEATS: { id: string; label: string; boards: CategoryId[]; categories: string[] }[] = [
  { id: "sports", label: "Sports", boards: ["sports"], categories: ["sports"] },
  { id: "politics", label: "Politics", boards: ["politics"], categories: ["politics"] },
  { id: "money", label: "Economy & crypto", boards: ["finance", "crypto"], categories: ["finance", "macro", "crypto"] },
  { id: "culture", label: "Culture", boards: ["culture"], categories: ["culture"] },
];
/** Calls are read on each beat's top markets only, to keep TypeSafe use down. */
const BEAT_READS = 8;
const PER_BEAT = 2;
const TIER = { wager: 2, hold: 1, skip: 0 } as const;

/** What the writer may say about a play. */
function facts(m: IssueMarket): PlayFacts {
  const call = m.call
    ? `${verb(m.call.action)} ${m.call.side} at ${cents(m.call.sidePrice)}: ${m.call.action === "wager" ? "our strongest kind of call" : "a mild tilt, not a strong play"}. We're ${pct(m.call.strength)} sure ${m.call.side} is underpriced; the market gives ${m.call.side} about a ${pct(m.call.sidePrice)} chance.`
    : `No call: both prices look fair to us${m.fair != null ? ` (${pct(m.fair)} sure of that)` : ""}. The market gives ${m.outcome} about a ${pct(m.price)} chance.`;
  return {
    id: m.id,
    question: m.question,
    call,
    when: m.game ? `starts ${m.when}` : `resolves ${m.when}`,
    move: m.move24h != null && Math.abs(m.move24h) >= 0.01 ? `${m.outcome} moved ${m.move24h >= 0 ? "+" : ""}${(m.move24h * 100).toFixed(1)} pts over the last day` : undefined,
    news: m.background?.story,
  };
}

/** A plain note from the numbers, for when the writing pass isn't available. */
function plainNote(m: IssueMarket): string {
  if (m.background?.story) return m.background.story;
  return m.call
    ? `We ${m.call.action === "wager" ? "like" : "lean"} ${m.call.side} at ${cents(m.call.sidePrice)}: ${pct(m.call.strength)} sure it's underpriced.`
    : "Both prices look fair to us, so we're leaving it alone.";
}

/** One line on recent results, only once enough Polymarket US calls have been graded to mean something. */
async function scorecardLine(): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    const { calls } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");
    const [r] = await db
      .select({
        graded: sql<number>`count(*) filter (where ${calls.result} in ('won','lost'))::int`,
        won: sql<number>`count(*) filter (where ${calls.result} = 'won')::int`,
      })
      .from(calls)
      .where(sql`${calls.marketId} like '%~%'`);
    if (!r || r.graded < 20) return null;
    return `Scorecard: ${r.won} of our last ${r.graded} graded calls landed.`;
  } catch {
    return null;
  }
}

export async function buildDailyIssue(now = new Date()): Promise<DailyIssue> {
  const { iso, title, long } = etDay(now);
  const t = now.getTime();

  // The main board: the pick and the day's counts, same as the site.
  const main = await getBoardReads();
  const plays = main.markets.map(toPlayDTO);
  const reads = { ...main.reads };
  const pickRes = todaysPick(plays, reads);
  const pick = pickRes ? toItem(pickRes.play, pickRes.read) : null;

  const counts = { wager: 0, lean: 0, skip: 0, decided: 0 };
  for (const p of plays) {
    const r = reads[p.id];
    if (!r) continue;
    if (r.settled) counts.decided++;
    else if (r.action === "wager") counts.wager++;
    else if (r.action === "hold") counts.lean++;
    else counts.skip++;
  }

  // Each beat: up to two plays from its boards. Calls first (Wager, then the strongest Leans);
  // a beat with no call shows its top market as one we looked at and left alone.
  const used = new Set<string>(pick ? [pick.id] : []);
  const byId = new Map<string, PlayDTO>(plays.map((p) => [p.id, p]));
  const beats: IssueBeat[] = [];
  for (const beat of BEATS) {
    // Start from the main board's markets on this beat (already read), then add the beat's own boards.
    const pool: PlayDTO[] = plays.filter(
      (p) => p.category != null && beat.categories.includes(p.category) && reads[p.id] && !reads[p.id].settled && !isLive(p.gameStartTime, t)
    );
    for (const board of beat.boards) {
      const r = await getBoardReads(board, BEAT_READS).catch(() => null);
      if (!r) continue;
      for (const m of r.markets) {
        const p = toPlayDTO(m);
        if (!r.reads[p.id] || r.reads[p.id].settled || isLive(p.gameStartTime, t)) continue;
        reads[p.id] = r.reads[p.id];
        byId.set(p.id, p);
        if (!pool.some((x) => x.id === p.id)) pool.push(p);
      }
    }
    const fresh = pool.filter((p) => !used.has(p.id));
    const called = fresh
      .filter((p) => reads[p.id].action !== "skip" && reads[p.id].lean != null)
      .sort((a, b) => TIER[reads[b.id].action] - TIER[reads[a.id].action] || reads[b.id].strength - reads[a.id].strength)
      .slice(0, PER_BEAT);
    // No call on this beat: show one market we looked at and left alone, a live question
    // (neither side past 80%) rather than a foregone one.
    const open = fresh.filter((p) => p.outcomes.every((o) => o.price <= 0.8));
    const chosen = called.length ? called : (open.length ? open : fresh).sort((a, b) => b.score - a.score).slice(0, 1);
    if (!chosen.length) continue;
    chosen.forEach((p) => used.add(p.id));
    beats.push({ id: beat.id, label: beat.label, plays: chosen.map((p) => toItem(p, reads[p.id])) });
  }

  // Passing on: the most popular main-board market we think is priced fair.
  const passPlay = [...plays]
    .sort((a, b) => b.score - a.score)
    .find((p) => !used.has(p.id) && reads[p.id] && !reads[p.id].settled && reads[p.id].action === "skip" && !isLive(p.gameStartTime, t));
  const pass = passPlay ? toItem(passPlay, reads[passPlay.id]) : null;

  // The week ahead: the biggest events starting after today, through the next 7 days.
  const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TZ, weekday: "short", month: "short", day: "numeric" });
  const upcoming = await fetchUpcoming({
    from: new Date(t + 12 * 3_600_000).toISOString(),
    to: new Date(t + 7 * 86_400_000).toISOString(),
    limit: 12,
  }).catch(() => []);
  // A game's kickoff, or (elections, deadlines) the day the market resolves if that's this week.
  const at = (m: { gameStartTime: Date | null; endDate: Date | null }) => m.gameStartTime ?? m.endDate;
  const week: WeekItem[] = upcoming
    .filter((m) => {
      const d = at(m);
      return d != null && d.getTime() < t + 7 * 86_400_000 && dayFmt.format(d) !== dayFmt.format(now);
    })
    .slice(0, 5)
    .sort((a, b) => at(a)!.getTime() - at(b)!.getTime())
    .map((m) => {
      const fav = [...m.outcomes].sort((a, b) => b.price - a.price)[0];
      return { id: m.id, day: dayFmt.format(at(m)!), question: m.question, href: `${SITE_URL}/?m=${m.id}`, price: `${fav.label} ${pct(fav.price)}` };
    });

  // Facts for the writer: yesterday's move and a news lookup for every play we'll talk about.
  const featured = [...(pick ? [pick] : []), ...beats.flatMap((b) => b.plays), ...(pass ? [pass] : [])];
  await Promise.all(
    featured.map(async (m) => {
      const p = byId.get(m.id);
      if (p) m.move24h = await move24h(p);
    })
  );
  const callText = (m: IssueMarket) => (m.call ? `${verb(m.call.action)} ${m.call.side} at ${cents(m.call.sidePrice)}` : "no call, priced fair");
  // News lookups are what an issue costs, so only the plays that lead get one: the pick in full,
  // and the first play of each beat in a line. The rest are written from their numbers.
  const researched = [...(pick ? [pick] : []), ...beats.map((b) => b.plays[0])];
  const bg = await buildBackground(
    iso,
    researched.map((m) => ({ id: m.id, question: m.question, call: callText(m), depth: m === pick ? ("pick" as const) : ("line" as const) }))
  );
  for (const m of featured) if (bg[m.id]) m.background = bg[m.id];

  // Weekdays only: Friday, Saturday and Sunday issues say "Monday", not "tomorrow".
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TZ, weekday: "long" }).format(now);
  const copy = await writeDaily({
    day: long,
    nextIssue: ["Friday", "Saturday", "Sunday"].includes(weekday) ? "Monday" : "tomorrow",
    pick: pick ? facts(pick) : null,
    beats: beats.map((b) => ({ label: b.label, plays: b.plays.map(facts) })),
    pass: pass ? facts(pass) : null,
    week: week.map((w) => `${w.day}: ${w.question} (${w.price})`),
    board: `${plays.length} markets on today's board: ${counts.wager} to wager, ${counts.lean} to lean on, ${counts.skip} priced fair`,
  });
  for (const m of [...beats.flatMap((b) => b.plays), ...(pass ? [pass] : [])]) m.note = copy?.notes[m.id] ?? plainNote(m);

  const headline = pick?.call ? `${verb(pick.call.action)} ${pick.call.side} at ${cents(pick.call.sidePrice)}` : "Board looks fairly priced";
  return {
    v: ISSUE_VERSION,
    date: iso,
    title,
    subject: `${title} · ${copy?.hook || headline}`,
    opener: copy?.opener ?? null,
    pick,
    pickWhy: copy?.pickWhy ?? null,
    beats,
    pass,
    weekIntro: copy?.weekIntro ?? null,
    week,
    scorecard: await scorecardLine(),
    signoff: copy?.signoff ?? null,
    counts,
    generatedAt: now.toISOString(),
  };
}
