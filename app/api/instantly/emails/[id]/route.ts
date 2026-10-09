import {
  instantlyFetch,
  type InstantlyEmail,
  type InstantlyPatchEmailPayload,
  routeErrorResponse,
} from "@/lib/instantly";
import { parseOrThrow, patchEmailSchema, readJson } from "@/lib/validation";

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
    const payload = parseOrThrow(patchEmailSchema, await readJson(request));
    const update: InstantlyPatchEmailPayload = {};

    if (payload.is_unread !== undefined) {
      update.is_unread = payload.is_unread;
    }

    if (payload.reminder_ts !== undefined) {
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
