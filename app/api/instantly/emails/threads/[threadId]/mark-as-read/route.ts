import {
  instantlyFetch,
  type InstantlySuccess,
  routeErrorResponse,
} from "@/lib/instantly";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const { threadId } = await params;
    const result = await instantlyFetch<InstantlySuccess>(
      `/emails/threads/${encodeURIComponent(threadId)}/mark-as-read`,
      {
        method: "POST",
      },
    );

    return Response.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
