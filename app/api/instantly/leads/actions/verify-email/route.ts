import { routeErrorResponse } from "@/lib/instantly";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ACTOR_ID = "account56~email-verifier";

type VerifyRequest = {
  emails?: string[];
};

function getApifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim();

  if (!token) {
    throw new Error("APIFY_API_TOKEN is not set");
  }

  return token;
}

function getApifyActorId() {
  return (
    process.env.APIFY_EMAIL_VERIFIER_ACTOR?.trim() || DEFAULT_ACTOR_ID
  ).replace("/", "~");
}

export async function POST(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const body = (await request.json().catch(() => ({}))) as VerifyRequest;
    const emails = Array.from(
      new Set(
        (body.emails ?? [])
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    if (emails.length === 0) {
      return Response.json(
        { error: "Select leads with email addresses", code: "missing_emails" },
        { status: 400 },
      );
    }

    const actorId = getApifyActorId();
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApifyToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails }),
        cache: "no-store",
        signal: AbortSignal.timeout(300000),
      },
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        {
          error:
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : `Apify returned ${response.status}`,
          code: "apify_api_error",
          details: payload,
        },
        { status: response.status },
      );
    }

    return Response.json({
      emails,
      items: Array.isArray(payload) ? payload : [],
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
