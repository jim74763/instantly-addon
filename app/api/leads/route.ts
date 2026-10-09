import {
  listOldLeads,
  upsertOldLead,
} from "@/lib/leads-db";
import { routeErrorResponse } from "@/lib/instantly";
import { OLD_LEAD_COLUMNS } from "@/lib/leads-schema";
import { oldLeadInputSchema, parseOrThrow, readJson } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(
      1,
      Math.min(Number(searchParams.get("limit") ?? "50") || 50, 500),
    );
    const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
    const items = await listOldLeads({
      search: (searchParams.get("search") ?? "").slice(0, 200),
      sort: searchParams.get("sort") ?? "timestamp_updated",
      direction: searchParams.get("direction") ?? "desc",
      limit: limit + 1,
      offset,
    });
    const hasMore = items.length > limit;

    return Response.json({
      columns: OLD_LEAD_COLUMNS,
      items: items.slice(0, limit),
      nextOffset: hasMore ? offset + limit : null,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = parseOrThrow(oldLeadInputSchema, await readJson(request));
    const lead = await upsertOldLead(body);

    return Response.json({ lead }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
