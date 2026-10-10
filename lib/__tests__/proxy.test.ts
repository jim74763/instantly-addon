import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy security headers", () => {
  it("sets baseline security headers", () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = proxy().headers;

    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("permissions-policy")).toContain("camera=()");
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("allows unsafe-eval and skips HSTS outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const headers = proxy().headers;

    expect(headers.get("content-security-policy")).toContain("'unsafe-eval'");
    expect(headers.get("strict-transport-security")).toBeNull();
  });

  it("disallows unsafe-eval and enables HSTS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const headers = proxy().headers;

    expect(headers.get("content-security-policy")).not.toContain("'unsafe-eval'");
    expect(headers.get("strict-transport-security")).toContain("max-age=31536000");
  });
});

describe("proxy matcher", () => {
  const regex = new RegExp(`^${config.matcher[0]}$`);

  it("matches pages and api routes", () => {
    expect(regex.test("/")).toBe(true);
    expect(regex.test("/accounts")).toBe(true);
    expect(regex.test("/api/instantly/emails")).toBe(true);
  });

  it("skips static assets", () => {
    expect(regex.test("/_next/static/chunk.js")).toBe(false);
    expect(regex.test("/_next/image")).toBe(false);
    expect(regex.test("/favicon.ico")).toBe(false);
    expect(regex.test("/logo.png")).toBe(false);
  });
});
