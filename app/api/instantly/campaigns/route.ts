import {
  copyInstantlySearchParams,
  instantlyFetch,
  type InstantlyCampaign,
  type InstantlyPaginated,
  routeErrorResponse,
} from "@/lib/instantly";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN_QUERY_KEYS = [
  "limit",
  "starting_after",
  "search",
  "tag_ids",
  "ai_sales_agent_id",
  "status",
];

export async function GET(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const { searchParams } = new URL(request.url);
    const instantlyParams = copyInstantlySearchParams(
      searchParams,
      CAMPAIGN_QUERY_KEYS,
    );

    if (!instantlyParams.has("limit")) {
      instantlyParams.set("limit", "50");
    }

    const data = await instantlyFetch<InstantlyPaginated<InstantlyCampaign>>(
      "/campaigns",
      {
        searchParams: instantlyParams,
      },
    );

    return Response.json(data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
