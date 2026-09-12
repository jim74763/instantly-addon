import {
  instantlyFetch,
  type InstantlyLead,
  routeErrorResponse,
} from "@/lib/instantly";
import { upsertOldLead } from "@/lib/leads-db";
import type { OldLeadInput } from "@/lib/leads-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoveRequest = {
  campaign?: string;
  leads?: InstantlyLead[];
};

function toOldLeadInput(lead: InstantlyLead): OldLeadInput {
  const knownKeys = new Set([
    "id",
    "timestamp_created",
    "timestamp_updated",
    "organization",
    "campaign",
    "status",
    "email",
    "personalization",
    "website",
    "last_name",
    "first_name",
    "company_name",
    "job_title",
    "phone",
    "linkedin_url",
    "location",
    "company_domain",
    "list_id",
    "assigned_to",
    "lt_interest_status",
    "pl_value_lead",
    "verification_status",
    "email_open_count",
    "email_reply_count",
    "email_click_count",
    "status_summary",
    "status_summary_subseq",
    "last_step_from",
    "last_step_id",
    "last_step_timestamp_executed",
    "email_opened_step",
    "email_opened_variant",
    "email_replied_step",
    "email_replied_variant",
    "email_clicked_step",
    "email_clicked_variant",
    "subsequence_id",
    "payload",
    "data",
  ]);
  const extraData = Object.fromEntries(
    Object.entries(lead).filter(([key]) => !knownKeys.has(key)),
  );

  return {
    id: lead.id,
    timestamp_created: lead.timestamp_created,
    timestamp_updated: lead.timestamp_updated,
    organization: lead.organization,
    campaign: lead.campaign,
    status: lead.status,
    email: lead.email,
    personalization: lead.personalization,
    website: lead.website,
    last_name: lead.last_name,
    first_name: lead.first_name,
    company_name: lead.company_name,
    job_title: lead.job_title,
    phone: lead.phone,
    linkedin_url: lead.linkedin_url,
    location: lead.location,
    company_domain: lead.company_domain,
    list_id: lead.list_id,
    assigned_to: lead.assigned_to,
    lt_interest_status: lead.lt_interest_status,
    pl_value_lead: lead.pl_value_lead,
    verification_status: lead.verification_status,
    email_open_count: lead.email_open_count,
    email_reply_count: lead.email_reply_count,
    email_click_count: lead.email_click_count,
    status_summary: lead.status_summary,
    status_summary_subseq: lead.status_summary_subseq,
    last_step_from: lead.last_step_from,
    last_step_id: lead.last_step_id,
    last_step_timestamp_executed: lead.last_step_timestamp_executed,
    email_opened_step: lead.email_opened_step,
    email_opened_variant: lead.email_opened_variant,
    email_replied_step: lead.email_replied_step,
    email_replied_variant: lead.email_replied_variant,
    email_clicked_step: lead.email_clicked_step,
    email_clicked_variant: lead.email_clicked_variant,
    subsequence_id: lead.subsequence_id,
    payload: lead.payload,
    data: {
      ...extraData,
      archived_from_instantly_campaign: lead.campaign,
      archived_from_instantly_at: new Date().toISOString(),
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MoveRequest;
    const leads = body.leads?.filter((lead) => lead.id) ?? [];

    if (!body.campaign) {
      return Response.json(
        { error: "campaign is required", code: "missing_campaign" },
        { status: 400 },
      );
    }

    if (leads.length === 0) {
      return Response.json(
        { error: "Select at least one lead", code: "missing_leads" },
        { status: 400 },
      );
    }

    const saved = [];
    const deleted = [];

    for (const lead of leads) {
      const savedLead = await upsertOldLead(toOldLeadInput(lead));
      saved.push(savedLead);

      await instantlyFetch(`/leads/${lead.id}`, {
        method: "DELETE",
      });
      deleted.push(lead.id);
    }

    return Response.json({
      saved: saved.length,
      deleted: deleted.length,
      deletedIds: deleted,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
