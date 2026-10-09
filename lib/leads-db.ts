import { randomUUID } from "node:crypto";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { oldLeads } from "@/lib/db/schema";
import { ValidationError } from "@/lib/validation";
import {
  OLD_LEAD_COLUMNS,
  type OldLead,
  type OldLeadColumn,
  type OldLeadInput,
} from "@/lib/leads-schema";

const NUMERIC_COLUMNS = new Set<OldLeadColumn>([
  "status",
  "lt_interest_status",
  "verification_status",
  "email_open_count",
  "email_reply_count",
  "email_click_count",
  "email_opened_step",
  "email_opened_variant",
  "email_replied_step",
  "email_replied_variant",
  "email_clicked_step",
  "email_clicked_variant",
]);

const JSON_COLUMNS = new Set<OldLeadColumn>([
  "status_summary",
  "status_summary_subseq",
  "payload",
  "data",
]);

type OldLeadInsert = typeof oldLeads.$inferInsert;
type OldLeadSelect = typeof oldLeads.$inferSelect;

function normalizeJsonColumn(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new ValidationError("Invalid JSON in a JSON column");
    }
  }

  return value;
}

function normalizeValue(column: OldLeadColumn, value: unknown) {
  if (JSON_COLUMNS.has(column)) {
    return normalizeJsonColumn(value);
  }

  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (NUMERIC_COLUMNS.has(column)) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      throw new ValidationError(`${column} must be a number`);
    }

    return numberValue;
  }

  return String(value);
}

function rowToOldLead(row: OldLeadSelect): OldLead {
  return Object.fromEntries(
    OLD_LEAD_COLUMNS.map((column) => {
      const value = row[column];

      if (JSON_COLUMNS.has(column) && value !== null && value !== undefined) {
        return [column, JSON.stringify(value)];
      }

      return [column, value ?? null];
    }),
  ) as OldLead;
}

function toInsert(input: OldLeadInput): OldLeadInsert {
  const now = new Date().toISOString();
  const id =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : randomUUID();

  return Object.fromEntries(
    OLD_LEAD_COLUMNS.map((column) => {
      if (column === "id") {
        return [column, id];
      }

      if (column === "timestamp_created") {
        return [column, normalizeValue(column, input[column] ?? now)];
      }

      if (column === "timestamp_updated") {
        return [column, normalizeValue(column, now)];
      }

      return [column, normalizeValue(column, input[column])];
    }),
  ) as OldLeadInsert;
}

function getSortableColumn(column: OldLeadColumn) {
  return oldLeads[column];
}

export async function listOldLeads({
  search = "",
  sort = "timestamp_updated",
  direction = "desc",
  limit = 50,
  offset = 0,
}: {
  search?: string;
  sort?: string;
  direction?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const safeSort = OLD_LEAD_COLUMNS.includes(sort as OldLeadColumn)
    ? (sort as OldLeadColumn)
    : "timestamp_updated";
  const orderExpression =
    direction.toLowerCase() === "asc"
      ? asc(getSortableColumn(safeSort))
      : desc(getSortableColumn(safeSort));
  const searchValue = search.trim().replace(/[\\%_]/g, "\\$&");
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safeOffset = Math.max(0, offset);

  const rows = searchValue
    ? await getDb()
        .select()
        .from(oldLeads)
        .where(
          or(
            ilike(oldLeads.email, `%${searchValue}%`),
            ilike(oldLeads.first_name, `%${searchValue}%`),
            ilike(oldLeads.last_name, `%${searchValue}%`),
            ilike(oldLeads.company_name, `%${searchValue}%`),
            ilike(oldLeads.website, `%${searchValue}%`),
            ilike(oldLeads.linkedin_url, `%${searchValue}%`),
            ilike(oldLeads.phone, `%${searchValue}%`),
            ilike(oldLeads.location, `%${searchValue}%`),
            sql`${oldLeads.data}::text ilike ${`%${searchValue}%`}`,
          ),
        )
        .orderBy(orderExpression)
        .limit(safeLimit)
        .offset(safeOffset)
    : await getDb()
        .select()
        .from(oldLeads)
        .orderBy(orderExpression)
        .limit(safeLimit)
        .offset(safeOffset);

  return rows.map(rowToOldLead);
}

export async function upsertOldLead(input: OldLeadInput) {
  const values = toInsert(input);
  const updateValues = Object.fromEntries(
    OLD_LEAD_COLUMNS.filter(
      (column) => column !== "id" && column !== "timestamp_created",
    ).map((column) => [column, values[column]]),
  );

  const [lead] = await getDb()
    .insert(oldLeads)
    .values(values)
    .onConflictDoUpdate({
      target: oldLeads.id,
      set: updateValues,
    })
    .returning();

  return lead ? rowToOldLead(lead) : undefined;
}

export async function getOldLead(id: string) {
  const [lead] = await getDb()
    .select()
    .from(oldLeads)
    .where(eq(oldLeads.id, id))
    .limit(1);

  return lead ? rowToOldLead(lead) : undefined;
}
