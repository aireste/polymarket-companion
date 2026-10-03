import { defineConfig } from "drizzle-kit";

// Migrations are generated from src/db/schema.ts and checked in; `npm run db:migrate` applies them.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
});
