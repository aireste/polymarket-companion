CREATE TABLE "call_pending" (
	"market_id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"side" text,
	"since" timestamp with time zone DEFAULT now() NOT NULL
);
