import {
  listOldLeads,
  upsertOldLead,
} from "@/lib/leads-db";
import { OLD_LEAD_COLUMNS, type OldLeadInput } from "@/lib/leads-schema";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(Number(searchParams.get("limit") ?? "50") || 50, 500),
  );
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
  const items = await listOldLeads({
    search: searchParams.get("search") ?? "",
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
}

export async function POST(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const body = (await request.json()) as OldLeadInput;
    const lead = await upsertOldLead(body);

    return Response.json({ lead }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save old lead",
      },
      { status: 400 },
    );
  }
}
