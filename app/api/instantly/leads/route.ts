import {
  instantlyFetch,
  type InstantlyLead,
  type InstantlyPaginated,
  routeErrorResponse,
} from "@/lib/instantly";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadListRequest = {
  campaign?: string;
  filter?: string;
  search?: string;
  starting_after?: string;
};

export async function POST(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const body = (await request.json().catch(() => ({}))) as LeadListRequest;
    const campaign = body.campaign?.trim();

    if (!campaign) {
      return Response.json(
        { error: "campaign is required", code: "missing_campaign" },
        { status: 400 },
      );
    }

    const data = await instantlyFetch<InstantlyPaginated<InstantlyLead>>(
      "/leads/list",
      {
        method: "POST",
        body: {
          campaign,
          limit: 50,
          ...(body.filter?.trim() ? { filter: body.filter.trim() } : {}),
          ...(body.search?.trim() ? { search: body.search.trim() } : {}),
          ...(body.starting_after
            ? { starting_after: body.starting_after }
            : {}),
        },
      },
    );

    return Response.json(data);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
