import {
  instantlyFetch,
  type InstantlyEmail,
  routeErrorResponse,
} from "@/lib/instantly";
import { parseOrThrow, readJson, replySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = parseOrThrow(replySchema, await readJson(request));

    const email = await instantlyFetch<InstantlyEmail>("/emails/reply", {
      method: "POST",
      body: payload,
    });

    return Response.json(email);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
