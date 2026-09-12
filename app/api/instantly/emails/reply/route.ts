import {
  instantlyFetch,
  type InstantlyEmail,
  type InstantlyReplyPayload,
  routeErrorResponse,
} from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isReplyPayload(payload: unknown): payload is InstantlyReplyPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as InstantlyReplyPayload;

  return (
    typeof candidate.eaccount === "string" &&
    typeof candidate.reply_to_uuid === "string" &&
    typeof candidate.subject === "string" &&
    !!candidate.body &&
    typeof candidate.body === "object" &&
    (typeof candidate.body.text === "string" ||
      typeof candidate.body.html === "string")
  );
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();

    if (!isReplyPayload(payload)) {
      return Response.json(
        {
          error:
            "Reply requires eaccount, reply_to_uuid, subject, and body.text or body.html.",
          code: "invalid_reply_payload",
        },
        { status: 400 },
      );
    }

    const email = await instantlyFetch<InstantlyEmail>("/emails/reply", {
      method: "POST",
      body: payload,
    });

    return Response.json(email);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
