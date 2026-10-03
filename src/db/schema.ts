import { pgTable, serial, text, doublePrecision, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
