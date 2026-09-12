import {
  instantlyFetch,
  type InstantlyEmail,
  type InstantlyPatchEmailPayload,
  routeErrorResponse,
} from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const email = await instantlyFetch<InstantlyEmail>(
      `/emails/${encodeURIComponent(id)}`,
    );

    return Response.json(email);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as InstantlyPatchEmailPayload;
    const update: InstantlyPatchEmailPayload = {};

    if ("is_unread" in payload) {
      update.is_unread = payload.is_unread;
    }

    if ("reminder_ts" in payload) {
      update.reminder_ts = payload.reminder_ts;
    }

    const email = await instantlyFetch<InstantlyEmail>(
      `/emails/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: update,
      },
    );

    return Response.json(email);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
