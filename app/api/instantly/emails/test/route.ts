import { instantlyFetch, routeErrorResponse } from "@/lib/instantly";
import { parseOrThrow, readJson, testEmailSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestEmailResponse =
  | {
      status: "success";
    }
  | {
      error: "ACC_AUTH_ERROR" | "ACC_NOT_FOUND" | "ACC_UNKNOWN_ERROR";
    };

export async function POST(request: Request) {
  try {
    const body = parseOrThrow(testEmailSchema, await readJson(request));
    const text = body.body.text?.trim();

    const result = await instantlyFetch<TestEmailResponse>("/emails/test", {
      method: "POST",
      body: {
        eaccount: body.eaccount,
        to_address_email_list: body.to_address_email_list,
        subject: body.subject,
        body: {
          ...(text ? { text } : {}),
          html: (body.body.html ?? body.body.text ?? "").trim(),
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
