import { instantlyFetch, routeErrorResponse } from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestEmailBody = {
  eaccount?: string;
  to_address_email_list?: string;
  subject?: string;
  body?: {
    text?: string;
    html?: string;
  };
};

type TestEmailResponse =
  | {
      status: "success";
    }
  | {
      error: "ACC_AUTH_ERROR" | "ACC_NOT_FOUND" | "ACC_UNKNOWN_ERROR";
    };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TestEmailBody;

    if (
      !body.eaccount?.trim() ||
      !body.to_address_email_list?.trim() ||
      !body.subject?.trim() ||
      (!body.body?.text?.trim() && !body.body?.html?.trim())
    ) {
      return Response.json(
        { error: "From account, recipients, subject, and body are required." },
        { status: 400 },
      );
    }

    const result = await instantlyFetch<TestEmailResponse>("/emails/test", {
      method: "POST",
      body: {
        eaccount: body.eaccount.trim(),
        to_address_email_list: body.to_address_email_list.trim(),
        subject: body.subject.trim(),
        body: {
          ...(body.body.text?.trim() ? { text: body.body.text.trim() } : {}),
          html: (body.body.html ?? body.body.text ?? "").trim(),
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
