CREATE TABLE "calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"market_id" text NOT NULL,
	"question" text NOT NULL,
	"call" text NOT NULL,
	"side" text NOT NULL,
	"side_price" real NOT NULL,
	"how_sure" real NOT NULL,
	"confidence" real,
	"resolves_at" timestamp with time zone,
	"phase" text,
	"result" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"profit" real,
	"model" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "calls_market_call_side" ON "calls" USING btree ("market_id","call","side");