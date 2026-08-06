import {
  copyInstantlySearchParams,
  instantlyFetch,
  type InstantlyAccount,
  type InstantlyPaginated,
  routeErrorResponse,
} from "@/lib/instantly";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedAccountParams = [
  "limit",
  "starting_after",
  "search",
  "status",
  "provider_code",
  "tag_ids",
  "tag_ids_all",
  "include_tags",
  "filter",
];

export async function GET(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const { searchParams } = new URL(request.url);
    const params = copyInstantlySearchParams(
      searchParams,
      allowedAccountParams,
    );

    if (!params.has("limit")) {
      params.set("limit", "100");
    }

    params.set("include_tags", "true");

    const accounts = await instantlyFetch<InstantlyPaginated<InstantlyAccount>>(
      "/accounts",
      { searchParams: params },
    );

    return Response.json(accounts);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
