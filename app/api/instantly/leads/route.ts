import {
  instantlyFetch,
  type InstantlyLead,
  type InstantlyPaginated,
  routeErrorResponse,
} from "@/lib/instantly";
import { leadListSchema, parseOrThrow, readJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = parseOrThrow(leadListSchema, await readJson(request));

    const data = await instantlyFetch<InstantlyPaginated<InstantlyLead>>(
      "/leads/list",
      {
        method: "POST",
        body: {
          campaign: body.campaign,
          limit: 50,
          ...(body.filter ? { filter: body.filter } : {}),
          ...(body.search ? { search: body.search } : {}),
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
