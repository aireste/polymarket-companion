/**
 * HedgePredict Daily: one issue = today's pick + Jev's board + what resolves in
 * the next 24h + the biggest 24h movers. Built from the same board, Jev reads
 * and pick rule as the site, so the email never disagrees with the app.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getBoardReads } from "./jevBoard";
import { toPlayDTO } from "./board";
import { todaysPick } from "./pick";
import { fetchHistory } from "./history";
import { MARKET_TZ, clockLabel, isLive, whenMs } from "./format";
import { CLAUDE_FAST, REFUSAL_FALLBACK } from "./claude";
import type { JevReadDTO, PlayDTO } from "./dto";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://polymarket-companion-nu.vercel.app";

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
  /** Jev's call on it, if any. */
  call?: { action: JevReadDTO["action"]; side: string; sidePrice: number; strength: number; confidence: number | null };
  /** "8:30 PM ET" or "Oct 3" */
  when: string;
  /** Change in the leading outcome's price over the last 24h, in [-1,1]. */
  move24h?: number;
}

export interface DailyIssue {
  /** YYYY-MM-DD in ET: one issue per day, and the archive key. */
  date: string;
  /** "WEDNESDAY, SEP30" (OP_DAILY-style). */
  title: string;
  subject: string;
  /** Two plain sentences about today's board, or null if Claude isn't available. */
  intro: string | null;
  pick: IssueMarket | null;
  leans: IssueMarket[];
  counts: { wager: number; lean: number; skip: number; decided: number };
  onTheClock: IssueMarket[];
  movers: IssueMarket[];
  generatedAt: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function etParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: MARKET_TZ, weekday: "long", month: "short", day: "2-digit", year: "numeric" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: MARKET_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { iso, title: `${p.weekday.toUpperCase()}, ${p.month.toUpperCase()}${p.day}` };
}

function toItem(p: PlayDTO, read?: JevReadDTO, move24h?: number): IssueMarket {
  const side = read && read.lean != null ? read.sides[read.lean] : null;
  return {
    id: p.id,
    question: p.question,
    href: `${SITE_URL}/?m=${p.id}`,
    url: p.url,
    outcome: p.outcomes[0]?.label ?? "",
    price: p.outcomes[0]?.price ?? 0,
    call:
      read && side && !read.settled
        ? { action: read.action, side: side.label, sidePrice: side.price, strength: read.strength, confidence: read.confidence }
        : undefined,
    when: /\d:\d\d/.test(clockLabel(p)) ? `${clockLabel(p)} ET` : clockLabel(p),
    move24h,
  };
}

/** 24h change of the leading outcome, from the CLOB 1-day series (best effort). */
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

/** Two sentences on the board, from the numbers only (no web, no invented news). */
async function writeIntro(issue: Omit<DailyIssue, "intro" | "subject">): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const lines = [
    issue.pick?.call ? `Today's pick: ${issue.pick.call.action === "wager" ? "Back" : "Lean"} ${issue.pick.call.side} at ${pct(issue.pick.call.sidePrice)} in "${issue.pick.question}"` : "No standout pick today.",
    `Resolving in the next 24h: ${issue.onTheClock.map((m) => m.question).join("; ") || "nothing major"}.`,
    `Biggest 24h moves: ${issue.movers.map((m) => `${m.question} (${m.move24h! >= 0 ? "+" : ""}${Math.round(m.move24h! * 100)} pts)`).join("; ") || "quiet"}.`,
  ].join("\n");
  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      ...REFUSAL_FALLBACK,
      model: CLAUDE_FAST,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: `Write the opener for today's HedgePredict Daily, a 2-minute prediction-market briefing. Exactly two short sentences, 40 words max in total, like a sharp editor, not a report: lead with the one thing worth knowing today, then one line of texture. Do not list counts or recite every market. Use ONLY these facts; add no news, reasons or predictions of your own. Calm, no hype, no exclamation marks, no em dashes, plain text.\n\n${lines}`,
        },
      ],
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function buildDailyIssue(now = new Date()): Promise<DailyIssue> {
  const { markets, reads } = await getBoardReads();
  const plays = markets.map(toPlayDTO);
  const { iso, title } = etParts(now);
  const t = now.getTime();

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

  const leans = plays
    .filter((p) => p.id !== pick?.id && reads[p.id] && !reads[p.id].settled && reads[p.id].action !== "skip")
    .sort((a, b) => reads[b.id].strength - reads[a.id].strength)
    .slice(0, 5)
    .map((p) => toItem(p, reads[p.id]));

  const onTheClock = plays
    .filter((p) => !isLive(p.gameStartTime, t) && whenMs(p) > t && whenMs(p) - t < 24 * 3_600_000)
    .sort((a, b) => whenMs(a) - whenMs(b))
    .slice(0, 6)
    .map((p) => toItem(p, reads[p.id]));

  const withMoves = await Promise.all(plays.map(async (p) => ({ p, m: await move24h(p) })));
  const movers = withMoves
    .filter((x): x is { p: PlayDTO; m: number } => x.m != null && Math.abs(x.m) >= 0.02 && !reads[x.p.id]?.settled)
    .sort((a, b) => Math.abs(b.m) - Math.abs(a.m))
    .slice(0, 4)
    .map(({ p, m }) => toItem(p, reads[p.id], m));

  const base = { date: iso, title, pick, leans, counts, onTheClock, movers, generatedAt: now.toISOString() };
  const intro = await writeIntro(base);
  const headline = pick?.call
    ? `${pick.call.action === "wager" ? "Back" : "Lean"} ${pick.call.side} at ${pct(pick.call.sidePrice)}`
    : "Board looks fairly priced";
  return { ...base, intro, subject: `${title} · ${headline}` };
}
