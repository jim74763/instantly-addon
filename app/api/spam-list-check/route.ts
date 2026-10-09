import { spamLists, type SpamListDefinition } from "@/lib/spam-lists";
import { spamCheckSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DnsAnswer = {
  data?: string;
};

type DnsResponse = {
  Status?: number;
  Answer?: DnsAnswer[];
};

type SpamListStatus = "clear" | "listed" | "error" | "not_configured";

type SpamListMatch = {
  target: string;
  query: string;
  addresses: string[];
  text: string[];
};

type SpamListResult = {
  name: string;
  zone: string | null;
  status: SpamListStatus;
  targetType: SpamListDefinition["targetType"];
  checkedTargets: string[];
  matches: SpamListMatch[];
  error?: string;
};

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DNS_TIMEOUT_MS = 8000;
const MAX_IP_TARGETS = 24;
const MAX_CONCURRENT_LISTS = 8;

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/\.+$/, "");
}

function domainFromEmail(value: string) {
  const email = value.trim().toLowerCase();
  const atIndex = email.lastIndexOf("@");

  if (atIndex === -1 || atIndex === email.length - 1) {
    return null;
  }

  return normalizeDomain(email.slice(atIndex + 1));
}

function isValidDomain(value: string) {
  return (
    value.length > 0 &&
    value.length <= 253 &&
    /^[a-z0-9.-]+$/.test(value) &&
    value.includes(".") &&
    !value.split(".").some((label) => label.length === 0 || label.length > 63)
  );
}

function isIpv4(value: string) {
  const parts = value.split(".");

  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) return false;
      const number = Number(part);
      return number >= 0 && number <= 255;
    })
  );
}

function reverseIpv4(value: string) {
  return value.split(".").reverse().join(".");
}

async function resolveDns(name: string, type: "A" | "MX" | "TXT") {
  const url = new URL(DOH_ENDPOINT);
  url.searchParams.set("name", name);
  url.searchParams.set("type", type);

  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    cache: "no-store",
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`DNS query failed with ${response.status}`);
  }

  return (await response.json()) as DnsResponse;
}

function answersFor(response: DnsResponse) {
  if (response.Status === 3) {
    return [];
  }

  if (response.Status !== 0) {
    throw new Error(
      `DNS resolver returned status ${response.Status ?? "unknown"}`,
    );
  }

  return response.Answer?.map((answer) => answer.data).filter(isString) ?? [];
}

async function resolveA(name: string) {
  return answersFor(await resolveDns(name, "A")).filter(isIpv4);
}

async function resolveTxt(name: string) {
  return answersFor(await resolveDns(name, "TXT")).map((text) =>
    text.replace(/^"|"$/g, "").replace(/"\s+"/g, ""),
  );
}

async function resolveMxHosts(domain: string) {
  return answersFor(await resolveDns(domain, "MX"))
    .map((answer) => answer.replace(/\.$/, ""))
    .map((answer) => {
      const match = answer.match(/^\d+\s+(.+)$/);
      return normalizeDomain(match?.[1] ?? answer);
    })
    .filter(isValidDomain);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

async function getTargets(domain: string) {
  const mxHosts = await resolveMxHosts(domain).catch(() => []);
  const domainIps = await resolveA(domain).catch(() => []);
  const mxIps = (
    await Promise.all(mxHosts.map((host) => resolveA(host).catch(() => [])))
  ).flat();

  return {
    domainTargets: unique([domain, ...mxHosts]),
    ipTargets: unique([...domainIps, ...mxIps]).slice(0, MAX_IP_TARGETS),
    mxHosts,
  };
}

function queriesForList(
  list: SpamListDefinition,
  domainTargets: string[],
  ipTargets: string[],
) {
  if (!list.zone) {
    return [];
  }

  const queries: { target: string; query: string }[] = [];

  if (list.targetType === "domain" || list.targetType === "mixed") {
    for (const target of domainTargets) {
      queries.push({ target, query: `${target}.${list.zone}` });
    }
  }

  if (list.targetType === "ip" || list.targetType === "mixed") {
    for (const target of ipTargets) {
      queries.push({ target, query: `${reverseIpv4(target)}.${list.zone}` });
    }
  }

  return queries;
}

function isProviderErrorResponse(addresses: string[], text: string[]) {
  const message = text.join(" ").toLowerCase();

  return (
    addresses.every((address) => address.startsWith("127.255.255.")) &&
    (message.includes("error") ||
      message.includes("open resolver") ||
      message.includes("excessive"))
  );
}

async function checkList(
  list: SpamListDefinition,
  domainTargets: string[],
  ipTargets: string[],
): Promise<SpamListResult> {
  if (!list.zone) {
    return {
      name: list.name,
      zone: null,
      status: "not_configured",
      targetType: list.targetType,
      checkedTargets: [],
      matches: [],
      error: list.requiresConfiguration
        ? "Set the provider DNSBL zone/key environment variable to enable this list."
        : "No DNS zone configured.",
    };
  }

  const queries = queriesForList(list, domainTargets, ipTargets);
  const matches: SpamListMatch[] = [];
  const errors: string[] = [];

  for (const query of queries) {
    try {
      const addresses = answersFor(await resolveDns(query.query, "A")).filter(
        isIpv4,
      );

      if (addresses.length) {
        const text = await resolveTxt(query.query).catch(() => []);
        if (isProviderErrorResponse(addresses, text)) {
          errors.push(
            `${query.query}: ${text.join(" ") || addresses.join(", ")}`,
          );
          continue;
        }

        matches.push({ ...query, addresses, text });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "DNS query failed";
      errors.push(`${query.query}: ${message}`);
    }
  }

  return {
    name: list.name,
    zone: list.zone,
    status: matches.length ? "listed" : errors.length ? "error" : "clear",
    targetType: list.targetType,
    checkedTargets: queries.map((query) => query.target),
    matches,
    error: matches.length ? undefined : errors[0],
  };
}

async function mapWithConcurrency<T, Result>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<Result>,
) {
  const results: Result[] = [];
  let index = 0;

  async function worker() {
    while (index < values.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );

  return results;
}

export async function POST(request: Request) {
  try {
    const payload = spamCheckSchema.safeParse(
      await request.json().catch(() => null),
    );
    const email = payload.success ? payload.data.email : "";
    const domain = domainFromEmail(email);

    if (!domain || !isValidDomain(domain)) {
      return Response.json(
        { error: "Provide a valid mailbox email address." },
        { status: 400 },
      );
    }

    const targets = await getTargets(domain);
    const results = await mapWithConcurrency(
      spamLists,
      MAX_CONCURRENT_LISTS,
      (list) => checkList(list, targets.domainTargets, targets.ipTargets),
    );
    const listedCount = results.filter(
      (result) => result.status === "listed",
    ).length;
    const errorCount = results.filter(
      (result) => result.status === "error",
    ).length;
    const notConfiguredCount = results.filter(
      (result) => result.status === "not_configured",
    ).length;

    return Response.json({
      email,
      domain,
      checkedAt: new Date().toISOString(),
      targets,
      summary: {
        total: results.length,
        listed: listedCount,
        clear: results.length - listedCount - errorCount - notConfiguredCount,
        errors: errorCount,
        notConfigured: notConfiguredCount,
      },
      results,
    });
  } catch (error) {
    console.error("Spam list check failed", error);

    return Response.json(
      { error: "Unable to check spam lists" },
      { status: 500 },
    );
  }
}
