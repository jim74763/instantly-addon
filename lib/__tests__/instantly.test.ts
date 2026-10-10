import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InstantlyApiError,
  InstantlyConfigError,
  copyInstantlySearchParams,
  instantlyFetch,
  routeErrorResponse,
} from "@/lib/instantly";
import { ValidationError } from "@/lib/validation";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INSTANTLY_API_KEY", " secret ");
  vi.stubEnv("INSTANTLY_API_BASE_URL", "https://api.test/v2///");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("instantlyFetch", () => {
  it("sends an authorized GET to the configured base url", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const result = await instantlyFetch("/emails");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.test/v2/emails");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer secret");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(result).toEqual({ ok: true });
  });

  it("appends non-empty search params only", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await instantlyFetch("/emails", {
      searchParams: new URLSearchParams({ limit: "5", search: "" }),
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.has("search")).toBe(false);
  });

  it("serializes JSON bodies", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await instantlyFetch("/x", { method: "POST", body: { a: 1 } });

    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe('{"a":1}');
  });

  it("falls back to the default base url", async () => {
    delete process.env.INSTANTLY_API_BASE_URL;
    fetchMock.mockResolvedValue(jsonResponse({}));

    await instantlyFetch("/accounts");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.instantly.ai/api/v2/accounts",
    );
  });

  it("throws InstantlyConfigError without an api key", async () => {
    vi.stubEnv("INSTANTLY_API_KEY", "  ");

    await expect(instantlyFetch("/x")).rejects.toBeInstanceOf(InstantlyConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws InstantlyApiError using the upstream message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "Nope" }, 422));

    const error = (await instantlyFetch("/x").catch((e) => e)) as InstantlyApiError;

    expect(error).toBeInstanceOf(InstantlyApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("Nope");
    expect(error.details).toEqual({ message: "Nope" });
  });

  it("reads the error field and falls back to a generic message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Bad" }, 400));
    await expect(instantlyFetch("/x")).rejects.toThrow("Bad");

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));
    await expect(instantlyFetch("/x")).rejects.toThrow("Instantly API returned 503");
  });

  it("wraps non-JSON error bodies as a message", async () => {
    fetchMock.mockResolvedValue(
      new Response("gateway down", { status: 502, headers: { "content-type": "text/plain" } }),
    );

    await expect(instantlyFetch("/x")).rejects.toThrow("gateway down");
  });
});

describe("routeErrorResponse", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("maps ValidationError to 400", async () => {
    const response = routeErrorResponse(new ValidationError("bad"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad", code: "invalid_request" });
  });

  it("maps InstantlyConfigError to 500 missing_api_key", async () => {
    const response = routeErrorResponse(new InstantlyConfigError("no key"));
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("missing_api_key");
  });

  it("passes through the upstream status without leaking details", async () => {
    const response = routeErrorResponse(
      new InstantlyApiError(429, "slow down", { secret: "x" }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "slow down",
      code: "instantly_api_error",
      upstreamStatus: 429,
    });
  });

  it("hides unexpected error messages", async () => {
    const response = routeErrorResponse(new Error("db password is hunter2"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unexpected local API error",
      code: "local_api_error",
    });
  });
});

describe("copyInstantlySearchParams", () => {
  it("copies only allowed keys that are present", () => {
    const source = new URLSearchParams("a=1&b=2&c=&evil=x");
    const copied = copyInstantlySearchParams(source, ["a", "c", "missing"]);

    expect(Object.fromEntries(copied)).toEqual({ a: "1", c: "" });
  });
});
