import { describe, expect, it } from "vitest";
import {
  ValidationError,
  inboxPlacementSchema,
  leadListSchema,
  moveLeadsSchema,
  oldLeadInputSchema,
  parseOrThrow,
  patchEmailSchema,
  readJson,
  replySchema,
  testEmailSchema,
  verifyEmailsSchema,
} from "@/lib/validation";

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    expect(parseOrThrow(moveLeadsSchema, { campaign: " c1 ", leadIds: ["a"] })).toEqual({
      campaign: "c1",
      leadIds: ["a"],
    });
  });

  it("throws a ValidationError with the issue path", () => {
    expect(() => parseOrThrow(moveLeadsSchema, { campaign: "c", leadIds: [] })).toThrow(
      ValidationError,
    );
    expect(() => parseOrThrow(moveLeadsSchema, { campaign: "c", leadIds: [] })).toThrow(
      /^leadIds:/,
    );
  });

  it("omits the path prefix for root-level issues", () => {
    expect(() => parseOrThrow(moveLeadsSchema, null)).toThrow(ValidationError);
  });
});

describe("readJson", () => {
  it("parses a JSON body", async () => {
    const request = new Request("http://x", { method: "POST", body: '{"a":1}' });
    expect(await readJson(request)).toEqual({ a: 1 });
  });

  it("throws ValidationError for invalid JSON", async () => {
    const request = new Request("http://x", { method: "POST", body: "{nope" });
    await expect(readJson(request)).rejects.toThrow(
      "Request body must be valid JSON",
    );
  });
});

describe("replySchema", () => {
  const valid = {
    eaccount: "me@example.com",
    reply_to_uuid: "uuid-1",
    subject: "Re: hi",
    body: { text: "hello" },
  };

  it("accepts a minimal valid reply", () => {
    expect(replySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid sender address", () => {
    expect(replySchema.safeParse({ ...valid, eaccount: "nope" }).success).toBe(false);
  });

  it("requires body.text or body.html", () => {
    expect(replySchema.safeParse({ ...valid, body: {} }).success).toBe(false);
    expect(replySchema.safeParse({ ...valid, body: { text: "   " } }).success).toBe(false);
    expect(replySchema.safeParse({ ...valid, body: { html: "<p>x</p>" } }).success).toBe(true);
  });

  it("rejects subjects over 998 characters", () => {
    expect(replySchema.safeParse({ ...valid, subject: "a".repeat(999) }).success).toBe(false);
  });
});

describe("testEmailSchema", () => {
  const valid = {
    eaccount: "me@example.com",
    to_address_email_list: "a@example.com, b@example.com",
    subject: "Test",
    body: { text: "hi" },
  };

  it("accepts comma separated recipients", () => {
    expect(testEmailSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid recipient", () => {
    expect(
      testEmailSchema.safeParse({ ...valid, to_address_email_list: "a@example.com, bad" }).success,
    ).toBe(false);
  });

  it("rejects more than 25 recipients", () => {
    const many = Array.from({ length: 26 }, (_, i) => `u${i}@example.com`).join(",");
    expect(testEmailSchema.safeParse({ ...valid, to_address_email_list: many }).success).toBe(false);
  });

  it("rejects a blank subject", () => {
    expect(testEmailSchema.safeParse({ ...valid, subject: "   " }).success).toBe(false);
  });
});

describe("patchEmailSchema", () => {
  it("accepts 0, 1, and null for is_unread", () => {
    for (const is_unread of [0, 1, null]) {
      expect(patchEmailSchema.safeParse({ is_unread }).success).toBe(true);
    }
  });

  it("rejects out of range or fractional is_unread", () => {
    expect(patchEmailSchema.safeParse({ is_unread: 2 }).success).toBe(false);
    expect(patchEmailSchema.safeParse({ is_unread: 0.5 }).success).toBe(false);
  });
});

describe("leadListSchema", () => {
  it("requires a campaign", () => {
    expect(leadListSchema.safeParse({}).success).toBe(false);
    expect(leadListSchema.safeParse({ campaign: "c1", search: "x" }).success).toBe(true);
  });
});

describe("moveLeadsSchema", () => {
  it("limits lead ids to 100", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `l${i}`);
    expect(moveLeadsSchema.safeParse({ campaign: "c", leadIds: ids }).success).toBe(false);
    expect(moveLeadsSchema.safeParse({ campaign: "c", leadIds: ids.slice(0, 100) }).success).toBe(true);
  });
});

describe("verifyEmailsSchema", () => {
  it("trims and lowercases emails", () => {
    expect(verifyEmailsSchema.parse({ emails: [" A@Example.COM "] })).toEqual({
      emails: ["a@example.com"],
    });
  });

  it("rejects an empty list", () => {
    expect(verifyEmailsSchema.safeParse({ emails: [] }).success).toBe(false);
  });
});

describe("inboxPlacementSchema", () => {
  it("accepts a valid request", () => {
    expect(
      inboxPlacementSchema.safeParse({ from: "a@example.com", recipients: ["b@example.com"] }).success,
    ).toBe(true);
  });

  it("rejects empty recipients and bad addresses", () => {
    expect(inboxPlacementSchema.safeParse({ from: "a@example.com", recipients: [] }).success).toBe(false);
    expect(inboxPlacementSchema.safeParse({ from: "a@example.com", recipients: ["x"] }).success).toBe(false);
  });
});

describe("oldLeadInputSchema", () => {
  it("accepts numeric columns as numbers or strings", () => {
    expect(oldLeadInputSchema.safeParse({ status: 1, email_open_count: "3" }).success).toBe(true);
  });

  it("accepts JSON columns as objects, arrays, or strings", () => {
    expect(
      oldLeadInputSchema.safeParse({ payload: { a: 1 }, data: [1], status_summary: "{}" }).success,
    ).toBe(true);
  });

  it("rejects wrong types for text columns", () => {
    expect(oldLeadInputSchema.safeParse({ email: { a: 1 } }).success).toBe(false);
  });

  it("allows null and omitted values", () => {
    expect(oldLeadInputSchema.safeParse({ email: null }).success).toBe(true);
    expect(oldLeadInputSchema.safeParse({}).success).toBe(true);
  });
});
