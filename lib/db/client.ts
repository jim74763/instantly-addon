import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let pool: Pool | null = null;

function getDatabaseUrl() {
  if (!process.env.DATABASE_URI) {
    throw new Error("DATABASE_URI is not set");
  }

  return process.env.DATABASE_URI;
}

export function getDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return drizzle(pool);
}
