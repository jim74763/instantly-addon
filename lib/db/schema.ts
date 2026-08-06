import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const oldLeads = pgTable(
  "old_leads",
  {
    id: text("id").primaryKey(),
    timestamp_created: timestamp("timestamp_created", { mode: "string" }),
    timestamp_updated: timestamp("timestamp_updated", { mode: "string" }),
    organization: text("organization"),
    campaign: text("campaign"),
    status: integer("status"),
    email: text("email"),
    personalization: text("personalization"),
    website: text("website"),
    last_name: text("last_name"),
    first_name: text("first_name"),
    company_name: text("company_name"),
    job_title: text("job_title"),
    phone: text("phone"),
    linkedin_url: text("linkedin_url"),
    location: text("location"),
    company_domain: text("company_domain"),
    list_id: text("list_id"),
    assigned_to: text("assigned_to"),
    lt_interest_status: integer("lt_interest_status"),
    pl_value_lead: text("pl_value_lead"),
    verification_status: integer("verification_status"),
    email_open_count: integer("email_open_count"),
    email_reply_count: integer("email_reply_count"),
    email_click_count: integer("email_click_count"),
    status_summary: jsonb("status_summary"),
    status_summary_subseq: jsonb("status_summary_subseq"),
    last_step_from: text("last_step_from"),
    last_step_id: text("last_step_id"),
    last_step_timestamp_executed: text("last_step_timestamp_executed"),
    email_opened_step: integer("email_opened_step"),
    email_opened_variant: integer("email_opened_variant"),
    email_replied_step: integer("email_replied_step"),
    email_replied_variant: integer("email_replied_variant"),
    email_clicked_step: integer("email_clicked_step"),
    email_clicked_variant: integer("email_clicked_variant"),
    subsequence_id: text("subsequence_id"),
    payload: jsonb("payload"),
    data: jsonb("data"),
  },
  (table) => [
    index("old_leads_email_idx").on(table.email),
    index("old_leads_company_idx").on(table.company_name),
    index("old_leads_location_idx").on(table.location),
    index("old_leads_updated_idx").on(table.timestamp_updated),
  ],
);

export const inboxPlacementCopies = pgTable(
  "inbox_placement_copies",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sort_order: integer("sort_order").notNull(),
    active: boolean("active").notNull().default(true),
    timestamp_created: timestamp("timestamp_created", { mode: "string" })
      .notNull()
      .defaultNow(),
    timestamp_updated: timestamp("timestamp_updated", { mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inbox_placement_copies_order_idx").on(table.sort_order),
    index("inbox_placement_copies_active_idx").on(table.active),
  ],
);
