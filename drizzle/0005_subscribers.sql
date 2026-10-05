CREATE TABLE "subscribers" (
	"email" text PRIMARY KEY NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"source" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
