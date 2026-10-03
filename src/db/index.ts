import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Neon over HTTP: no connection pool to manage, which suits serverless functions. */
export const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
export { schema };
