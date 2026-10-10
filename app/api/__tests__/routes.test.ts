import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/leads-db", () => ({ upsertOldLead: vi.fn() }));

import { GET as getEmails } from "@/app/api/instantly/emails/route";
import { POST as postTestEmail } from "@/app/api/instantly/emails/test/route";
import { POST as postMoveLeads } from "@/app/api/instantly/leads/actions/move-to-old-leads/route";
import { upsertOldLead } from "@/lib/leads-db";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function post(url: string, body: unknown) {
  return new Request(url, { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INSTANTLY_API_KEY", "key");
  vi.stubEnv("INSTANTLY_API_BASE_URL", "https://api.test/v2");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.mocked(upsertOldLead).mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/instantly/emails", () => {
  it("applies defaults and forwards only allowed params", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    const response = await getEmails(
      new Request("http://local/api/instantly/emails?search=hi&evil=1"),
    );

    expect(await response.json()).toEqual({ items: [] });
    const upstream = new URL(String(fetchMock.mock.calls[0][0]));
    expect(upstream.pathname).toBe("/v2/emails");
    expect(upstream.searchParams.get("search")).toBe("hi");
    expect(upstream.searchParams.get("limit")).toBe("25");
    expect(upstream.searchParams.get("sort_order")).toBe("desc");
    expect(upstream.searchParams.has("evil")).toBe(false);
  });

  it("keeps caller supplied limit and sort_order", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    await getEmails(new Request("http://local/x?limit=5&sort_order=asc"));

    const upstream = new URL(String(fetchMock.mock.calls[0][0]));
    expect(upstream.searchParams.get("limit")).toBe("5");
    expect(upstream.searchParams.get("sort_order")).toBe("asc");
  });

  it("returns the upstream status on API errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "rate limited" }, 429));

    const response = await getEmails(new Request("http://local/x"));

    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("instantly_api_error");
  });

  it("returns 500 when the API key is missing", async () => {
    vi.stubEnv("INSTANTLY_API_KEY", "");

    const response = await getEmails(new Request("http://local/x"));

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("missing_api_key");
  });
});

describe("POST /api/instantly/emails/test", () => {
  const valid = {
    eaccount: "me@example.com",
    to_address_email_list: "a@example.com",
    subject: "Hi",
    body: { text: "  hello  " },
  };

  it("rejects invalid input with 400 and does not call upstream", async () => {
    const response = await postTestEmail(post("http://local/x", { ...valid, subject: "" }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_request");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await postTestEmail(
      new Request("http://local/x", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
  });

  it("trims text and derives html from text when missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "success" }));

    const response = await postTestEmail(post("http://local/x", valid));

    expect(await response.json()).toEqual({ status: "success" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).body).toEqual({
      text: "hello",
      html: "hello",
    });
  });

  it("prefers provided html", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "success" }));

    await postTestEmail(
      post("http://local/x", { ...valid, body: { text: "t", html: "<p>h</p>" } }),
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).body.html).toBe("<p>h</p>");
  });
});

describe("POST /api/instantly/leads/actions/move-to-old-leads", () => {
  it("rejects an empty lead list", async () => {
    const response = await postMoveLeads(
      post("http://local/x", { campaign: "c1", leadIds: [] }),
    );
    expect(response.status).toBe(400);
  });

  it("archives each unique lead then deletes it upstream", async () => {
    vi.mocked(upsertOldLead).mockResolvedValue({} as never);
    fetchMock.mockImplementation(async (url: URL, init: RequestInit) => {
      if (init.method === "DELETE") return jsonResponse({ success: true });
      return jsonResponse({ id: "l 1", email: "a@example.com", custom: "x" });
    });

    const response = await postMoveLeads(
      post("http://local/x", { campaign: "c1", leadIds: ["l 1", "l 1"] }),
    );

    expect(await response.json()).toEqual({
      saved: 1,
      deleted: 1,
      deletedIds: ["l 1"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/leads/l%201");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");

    const saved = vi.mocked(upsertOldLead).mock.calls[0][0];
    expect(saved.campaign).toBe("c1");
    expect(saved.email).toBe("a@example.com");
    expect(saved.data).toMatchObject({
      custom: "x",
      archived_from_instantly_campaign: "c1",
    });
  });

  it("does not delete the lead if saving it fails", async () => {
    vi.mocked(upsertOldLead).mockRejectedValue(new Error("db down"));
    fetchMock.mockResolvedValue(jsonResponse({ id: "l1" }));

    const response = await postMoveLeads(
      post("http://local/x", { campaign: "c1", leadIds: ["l1"] }),
    );

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([, init]) => init.method === "DELETE"),
    ).toBe(false);
  });
});
