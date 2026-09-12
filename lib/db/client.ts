import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let database: ReturnType<typeof drizzle> | null = null;

function getDatabaseUrl() {
  if (!process.env.DATABASE_URI) {
    throw new Error("DATABASE_URI is not set");
  }

  return process.env.DATABASE_URI;
}

export function getDb() {
  if (!database) {
    database = drizzle(neon(getDatabaseUrl()));
  }

  return database;
}
