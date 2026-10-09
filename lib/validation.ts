import { z } from "zod";
import { OLD_LEAD_COLUMNS } from "@/lib/leads-schema";

const MAX_RECIPIENTS = 25;
const MAX_BODY_LENGTH = 200_000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");

    throw new ValidationError(
      path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid input"),
    );
  }

  return result.data;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

const email = z.string().trim().email().max(320);
const idString = z.string().trim().min(1).max(200);
const messageBody = z
  .object({
    text: z.string().max(MAX_BODY_LENGTH).optional(),
    html: z.string().max(MAX_BODY_LENGTH).optional(),
  })
  .refine((body) => body.text?.trim() || body.html?.trim(), {
    message: "body.text or body.html is required",
  });

const commaSeparatedEmails = z
  .string()
  .trim()
  .min(1)
  .max(5000)
  .refine(
    (value) => {
      const parts = value.split(",").map((part) => part.trim());
      return (
        parts.length <= MAX_RECIPIENTS &&
        parts.every((part) => z.string().email().safeParse(part).success)
      );
    },
    { message: `Provide up to ${MAX_RECIPIENTS} valid email addresses` },
  );

export const replySchema = z.object({
  eaccount: email,
  reply_to_uuid: idString,
  subject: z.string().max(998),
  body: messageBody,
  cc_address_email_list: z.string().max(5000).optional(),
  bcc_address_email_list: z.string().max(5000).optional(),
  reminder_ts: z.string().max(100).optional(),
  assigned_to: idString.optional(),
});

export const testEmailSchema = z.object({
  eaccount: email,
  to_address_email_list: commaSeparatedEmails,
  subject: z.string().trim().min(1).max(998),
  body: messageBody,
});

export const patchEmailSchema = z.object({
  is_unread: z.number().int().min(0).max(1).nullable().optional(),
  reminder_ts: z.string().max(100).nullable().optional(),
});

export const leadListSchema = z.object({
  campaign: idString,
  filter: z.string().trim().max(200).optional(),
  search: z.string().trim().max(200).optional(),
  starting_after: z.string().max(500).optional(),
});

export const moveLeadsSchema = z.object({
  campaign: idString,
  leadIds: z.array(idString).min(1).max(100),
});

export const verifyEmailsSchema = z.object({
  emails: z.array(z.string().trim().toLowerCase().email().max(320)).min(1).max(100),
});

export const inboxPlacementSchema = z.object({
  from: email,
  recipients: z.array(email).min(1).max(MAX_RECIPIENTS),
  footerId: z.string().trim().max(200).optional(),
  messageId: z.string().trim().max(200).optional(),
});

export const spamCheckSchema = z.object({
  email: z.string().trim().max(320),
});

const NUMERIC_COLUMNS = new Set<string>([
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

const JSON_COLUMNS = new Set<string>([
  "status_summary",
  "status_summary_subseq",
  "payload",
  "data",
]);

const jsonValue = z.union([
  z.string().max(1_000_000),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

function columnSchema(column: string) {
  if (JSON_COLUMNS.has(column)) {
    return jsonValue.nullish();
  }

  if (NUMERIC_COLUMNS.has(column)) {
    return z.union([z.number(), z.string().max(30)]).nullish();
  }

  return z.union([z.string().max(10_000), z.number()]).nullish();
}

export const oldLeadInputSchema = z.object(
  Object.fromEntries(
    OLD_LEAD_COLUMNS.map((column) => [column, columnSchema(column).optional()]),
  ),
);
