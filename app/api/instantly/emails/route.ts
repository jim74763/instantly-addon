import {
  copyInstantlySearchParams,
  instantlyFetch,
  type InstantlyEmail,
  type InstantlyPaginated,
  routeErrorResponse,
} from "@/lib/instantly";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_QUERY_KEYS = [
  "limit",
  "starting_after",
  "search",
  "campaign_id",
  "list_id",
  "i_status",
  "eaccount",
  "is_unread",
  "has_reminder",
  "mode",
  "preview_only",
  "sort_order",
  "scheduled_only",
  "assigned_to",
  "lead",
  "company_domain",
  "marked_as_done",
  "email_type",
  "min_timestamp_created",
  "max_timestamp_created",
  "latest_of_thread",
];

export async function GET(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const { searchParams } = new URL(request.url);
    const instantlyParams = copyInstantlySearchParams(
      searchParams,
      EMAIL_QUERY_KEYS,
    );

    if (!instantlyParams.has("limit")) {
      instantlyParams.set("limit", "25");
    }

    if (!instantlyParams.has("sort_order")) {
      instantlyParams.set("sort_order", "desc");
    }

    const data = await instantlyFetch<InstantlyPaginated<InstantlyEmail>>(
      "/emails",
      {
        searchParams: instantlyParams,
      },
    );

    return Response.json(data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
