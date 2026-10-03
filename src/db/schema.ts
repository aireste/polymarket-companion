import { pgTable, serial, text, doublePrecision, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * HedgePredict's track record: every Wager and Lean, logged once per market + call + side the
 * first time it's seen, then graded when Polymarket resolves the market.
 */
export const calls = pgTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    marketId: text("market_id").notNull(),
    question: text("question").notNull(),
    /** "Wager" or "Lean". */
    call: text("call").notNull(),
    side: text("side").notNull(),
    /** Which outcome the call backs: 0 = the long side (Yes / first team), 1 = the short side. */
    sideIndex: integer("side_index"),
    /** Price of the called side when the call was logged, 0–1. */
    sidePrice: doublePrecision("side_price").notNull(),
    howSure: doublePrecision("how_sure").notNull(),
    confidence: doublePrecision("confidence"),
    resolvesAt: timestamp("resolves_at", { withTimezone: true }),
    /** "pre-game" / "live" for sports; null otherwise. */
    phase: text("phase"),
    /** "open", "won", "lost" or "void". */
    result: text("result").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** Profit per $1 staked on the called side at the logged price. */
    profit: doublePrecision("profit"),
    model: text("model").notNull().default(""),
  },
  (t) => [uniqueIndex("calls_market_call_side").on(t.marketId, t.call, t.side)]
);

export type Call = typeof calls.$inferSelect;

/**
 * HedgePredict Daily: one built issue per day (ET date). Building an issue costs board reads, news
 * lookups and a writing pass, so it's done once and every reader of that day (the email send, the
 * Daily page, the tour) gets the same edition.
 */
export const issues = pgTable("issues", {
  /** YYYY-MM-DD in ET. */
  date: text("date").primaryKey(),
  issue: jsonb("issue").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
