CREATE TABLE "call_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"market_id" text NOT NULL,
	"question" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"side" text,
	"side_price" double precision,
	"how_sure" double precision
);
--> statement-breakpoint
CREATE INDEX "call_changes_market_at" ON "call_changes" USING btree ("market_id","at");--> statement-breakpoint
-- Backfill: the track record already knows when each Wager/Lean first appeared.
INSERT INTO "call_changes" ("at", "market_id", "question", "action", "side", "side_price", "how_sure")
SELECT "logged_at", "market_id", "question", CASE "call" WHEN 'Wager' THEN 'wager' ELSE 'hold' END, "side", "side_price", "how_sure"
FROM "calls";
