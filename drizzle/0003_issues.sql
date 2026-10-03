CREATE TABLE "issues" (
	"date" text PRIMARY KEY NOT NULL,
	"issue" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
