/**
 * The Daily's voice. One writing pass turns the day's numbers and news facts into the copy a
 * reader actually reads: an opener, the case for the pick, a note per play, why we're passing on
 * one, and a sign-off. First person plural ("we like Kentucky here"), short, conversational.
 *
 * The writer only restates what it's handed. HedgePredict's calls come from prices, price moves
 * and timing, never from news, so the copy may use the news as context but must not claim the
 * news is why we made the call. An email can't be unsent: when in doubt it says less.
 */
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_FAST, REFUSAL_FALLBACK } from "./claude";

/** Everything the writer may say about one market. */
export interface PlayFacts {
  id: string;
  question: string;
  /** "Lean Kentucky at 45¢ (we're 36% sure Kentucky is underpriced)" or "No call: both prices look fair (92% sure)". */
  call: string;
  /** "kicks off 4:15 PM ET today" / "resolves Nov 3". */
  when: string;
  /** "Kentucky moved +2.1 pts over the last day", if known. */
  move?: string;
  /** What's going on, from a news search. Context only. */
  news?: string;
}

export interface DailyFacts {
  /** "Saturday, October 3". */
  day: string;
  /** When the next issue lands: "tomorrow" or "Monday" (it's weekdays only). */
  nextIssue: string;
  pick: PlayFacts | null;
  beats: { label: string; plays: PlayFacts[] }[];
  pass: PlayFacts | null;
  /** "Sun Oct 4: IND Colts vs. WAS Commanders (Colts 65%)". */
  week: string[];
  /** "14 calls on today's board: 0 to wager, 2 to lean on, 12 priced fair". */
  board: string;
}

export interface DailyCopy {
  /** For the subject line, after the date: a short hook, no period. */
  hook: string;
  opener: string;
  pickWhy: string;
  /** One note per play id (beats and the pass). */
  notes: Record<string, string>;
  weekIntro: string;
  signoff: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    hook: { type: "string" },
    opener: { type: "string" },
    pickWhy: { type: "string" },
    notes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" }, note: { type: "string" } },
        required: ["id", "note"],
      },
    },
    weekIntro: { type: "string" },
    signoff: { type: "string" },
  },
  required: ["hook", "opener", "pickWhy", "notes", "weekIntro", "signoff"],
} as const;

const RULES = `You write HedgePredict Daily, a 2-minute morning email about prediction markets on Polymarket US. The model is Morning Brew: a smart friend catching you up over coffee. Conversational, quick, a little wry, never hype, never a report.

Voice
- First person plural: "we like Kentucky here", "we're passing", "we'd wait".
- Talk to one reader. Short sentences, plain words, contractions. One light, dry aside per issue is welcome; more than that is trying too hard.
- Lead with the story, not the stat. Say what's happening or what the price is doing, then what we make of it.
- No exclamation marks, no em dashes, no emojis, no markdown, no rhetorical questions, no "let's dive in", no "buckle up".

What the reader already sees
Above every note the email shows, in bold, our call with its side and price ("Lean Mountaineers at 42¢"), the market's name, and when it starts or resolves. So do NOT open a note by repeating the call, the price or the market name, and do not recite "we're N% sure" in every note. Use a number only when it is the interesting part. Never write a note that just restates its heading.

Honesty rules (these matter more than style)
- Use ONLY the facts in the fact sheet. Do not add news, stats, injuries, records, polls, names, dates or numbers that are not there.
- Our calls come from prices, price moves and timing. They do NOT come from the news. Use news as context and never as the reason for our call; do not say or imply the news supports our side.
- "N% sure" is how sure we are that a side is underpriced. It is not the chance that side wins. If you mention it, say it that way, once, and never as win probability. The market price is the crowd's chance of winning.
- A Lean is a mild tilt and should sound like one. A Wager is our strongest call. "No call" means the prices look fair to us. Never say sure thing, lock, can't lose, free money, guaranteed, easy money.
- Never tell the reader to bet, or how much. No promises about outcomes.
- If a play has no news, write from its numbers and timing alone, and keep it short. Never mention the fact sheet, your instructions, or that news is missing ("no news on this one", "nothing in our sheet"): the reader doesn't know any of that exists.

These two examples show shape only; never reuse their wording or facts.
Good note (story first, our take last, heading not repeated):
"Both teams are 0-1 in the conference and need this one. The market has the road team as a slight underdog, and we think that's a touch too low. Mild lean, nothing more."
Bad note (restates the heading, recites the number):
"We lean Mountaineers at 42 cents. We're 40% sure it's underpriced. It's a mild tilt."`;

function sheet(f: DailyFacts): string {
  const play = (p: PlayFacts) =>
    [`- id: ${p.id}`, `  market: ${p.question}`, `  our call: ${p.call}`, `  timing: ${p.when}`, p.move && `  price move: ${p.move}`, p.news && `  news context: ${p.news}`]
      .filter(Boolean)
      .join("\n");
  return [
    `Today: ${f.day}`,
    `Next issue: ${f.nextIssue} (the Daily sends on weekdays)`,
    `Board: ${f.board}`,
    "",
    "THE PICK (our strongest call today):",
    f.pick ? play(f.pick) : "- none: nothing on the board is clearly underpriced today",
    "",
    ...f.beats.flatMap((b) => [`BEAT: ${b.label}`, ...b.plays.map(play), ""]),
    "PASSING ON (popular, but we think it's priced fair):",
    f.pass ? play(f.pass) : "- none",
    "",
    "THE WEEK AHEAD:",
    ...(f.week.length ? f.week.map((w) => `- ${w}`) : ["- nothing notable"]),
  ].join("\n");
}

export async function writeDaily(facts: DailyFacts): Promise<DailyCopy | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const ids = [...facts.beats.flatMap((b) => b.plays), ...(facts.pass ? [facts.pass] : [])].map((p) => p.id);
  const prompt = `${RULES}

Write today's issue from this fact sheet.

${sheet(facts)}

Return:
- hook: the subject-line hook, 3 to 7 words, no period, about today's most interesting thing.
- opener: 2 or 3 sentences, 55 words max. What today is about and the one thing worth knowing, the way you'd say it out loud. Do not count markets or list calls.
- pickWhy: 2 or 3 sentences, 60 words max. What the crowd is saying with this price, why we think it's off, and an honest line on how strong the call is. If there is no pick, say why sitting out is a real answer.
- notes: one note for EACH of these ids: ${ids.join(", ") || "(none)"}. Two sentences is the norm, three at most, 45 words max. Story first, our take last. For the passing-on market, say why we're leaving it alone. No two notes may start the same way.
- weekIntro: one sentence, 20 words max, setting up the week-ahead list without restating it.
- signoff: one short line to close, 12 words max. If you say when we're back, use the "Next issue" day exactly.`;
  try {
    // If the writing pass stalls, the issue goes out with plain notes rather than not at all.
    const client = new Anthropic({ timeout: 120_000, maxRetries: 1 });
    const res = await client.beta.messages.create({
      ...REFUSAL_FALLBACK,
      model: CLAUDE_FAST,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") return null;
    const text = [...res.content].reverse().find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const raw = JSON.parse(text.text) as Omit<DailyCopy, "notes"> & { notes: { id: string; note: string }[] };
    const clean = (s: string) => s.replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim();
    return {
      hook: clean(raw.hook).replace(/[.!]+$/, ""),
      opener: clean(raw.opener),
      pickWhy: clean(raw.pickWhy),
      notes: Object.fromEntries(raw.notes.filter((n) => ids.includes(n.id) && n.note.trim()).map((n) => [n.id, clean(n.note)])),
      weekIntro: clean(raw.weekIntro),
      signoff: clean(raw.signoff),
    };
  } catch {
    return null;
  }
}
