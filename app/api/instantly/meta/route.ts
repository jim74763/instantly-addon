import {
  instantlyFetch,
  type InstantlyAccount,
  type InstantlyCampaign,
  type InstantlyPaginated,
  type InstantlyUnreadCount,
  routeErrorResponse,
} from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaWarning = {
  resource: string;
  message: string;
};

function warningFrom(resource: string, error: unknown): MetaWarning {
  return {
    resource,
    message: error instanceof Error ? error.message : "Unable to load resource",
  };
}

export async function GET() {
  try {
    const accountParams = new URLSearchParams({
      limit: "100",
      include_tags: "true",
    });
    const campaignParams = new URLSearchParams({ limit: "100" });

    const [unreadResult, accountsResult, campaignsResult] = await Promise.all([
      instantlyFetch<InstantlyUnreadCount>("/emails/unread/count"),
      instantlyFetch<InstantlyPaginated<InstantlyAccount>>("/accounts", {
        searchParams: accountParams,
      }),
      instantlyFetch<InstantlyPaginated<InstantlyCampaign>>("/campaigns", {
        searchParams: campaignParams,
      }),
    ]);

    return Response.json({
      unreadCount: unreadResult.count,
      accounts: accountsResult.items,
      campaigns: campaignsResult.items,
      warnings: [],
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST() {
  try {
    const accountParams = new URLSearchParams({
      limit: "100",
      include_tags: "true",
    });
    const campaignParams = new URLSearchParams({ limit: "100" });

    const [unreadResult, accountsResult, campaignsResult] =
      await Promise.allSettled([
        instantlyFetch<InstantlyUnreadCount>("/emails/unread/count"),
        instantlyFetch<InstantlyPaginated<InstantlyAccount>>("/accounts", {
          searchParams: accountParams,
        }),
        instantlyFetch<InstantlyPaginated<InstantlyCampaign>>("/campaigns", {
          searchParams: campaignParams,
        }),
      ]);

    const warnings: MetaWarning[] = [];

    if (unreadResult.status === "rejected") {
      warnings.push(warningFrom("unread", unreadResult.reason));
    }

    if (accountsResult.status === "rejected") {
      warnings.push(warningFrom("accounts", accountsResult.reason));
    }

    if (campaignsResult.status === "rejected") {
      warnings.push(warningFrom("campaigns", campaignsResult.reason));
    }

    return Response.json({
      unreadCount:
        unreadResult.status === "fulfilled" ? unreadResult.value.count : null,
      accounts:
        accountsResult.status === "fulfilled"
          ? accountsResult.value.items
          : [],
      campaigns:
        campaignsResult.status === "fulfilled"
          ? campaignsResult.value.items
          : [],
      warnings,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
