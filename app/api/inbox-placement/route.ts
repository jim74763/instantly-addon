import {
  InstantlyApiError,
  instantlyFetch,
  routeErrorResponse,
} from "@/lib/instantly";
import { listInboxPlacementCopies } from "@/lib/inbox-placement";
import { requireDashboardAuth } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendInboxPlacementBody = {
  from?: string;
  recipients?: string[];
  footerId?: string;
  messageId?: string;
};

type TestEmailResponse =
  | {
      status: "success";
    }
  | {
      error: "ACC_AUTH_ERROR" | "ACC_NOT_FOUND" | "ACC_UNKNOWN_ERROR";
    };

type InboxPlacementCopy = Awaited<
  ReturnType<typeof listInboxPlacementCopies>
>[number];

const TEST_EMAIL_INTERVAL_MS = 6500;
const RATE_LIMIT_RETRY_MS = 65000;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function appendFooterId(body: string, footerId?: string) {
  const trimmedFooterId = footerId?.trim();

  if (!trimmedFooterId) {
    return body;
  }

  return `${body}\n\n${trimmedFooterId}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Unable to send email";
}

async function sendTestEmail({
  from,
  recipient,
  copy,
  text,
}: {
  from: string;
  recipient: string;
  copy: InboxPlacementCopy;
  text: string;
}) {
  return instantlyFetch<TestEmailResponse>("/emails/test", {
    method: "POST",
    body: {
      eaccount: from,
      to_address_email_list: recipient,
      subject: copy.subject,
      body: {
        text,
        html: textToHtml(text),
      },
    },
  });
}

async function sendWithRateLimitRetry({
  from,
  recipient,
  copy,
  text,
}: {
  from: string;
  recipient: string;
  copy: InboxPlacementCopy;
  text: string;
}) {
  try {
    return await sendTestEmail({ from, recipient, copy, text });
  } catch (error) {
    if (error instanceof InstantlyApiError && error.status === 429) {
      await wait(RATE_LIMIT_RETRY_MS);
      return sendTestEmail({ from, recipient, copy, text });
    }

    throw error;
  }
}

export async function GET() {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const copies = await listInboxPlacementCopies();
    return Response.json({ copies });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const authResponse = await requireDashboardAuth();
  if (authResponse) return authResponse;

  try {
    const body = (await request.json()) as SendInboxPlacementBody;
    const from = body.from?.trim();
    const recipients = Array.from(
      new Set(
        (body.recipients ?? [])
          .map(normalizeEmail)
          .filter((email) => email.includes("@")),
      ),
    );

    if (!from) {
      return Response.json({ error: "A sending account is required." }, { status: 400 });
    }

    if (!recipients.length) {
      return Response.json(
        { error: "At least one recipient email is required." },
        { status: 400 },
      );
    }

    const copies = await listInboxPlacementCopies();

    if (!copies.length) {
      return Response.json(
        { error: "No inbox placement copies are available." },
        { status: 400 },
      );
    }

    const results = [];

    for (const [index, recipient] of recipients.entries()) {
      if (index > 0) {
        await wait(TEST_EMAIL_INTERVAL_MS);
      }

      const copy = copies[index % copies.length];
      const text = appendFooterId(copy.body, body.footerId ?? body.messageId);

      try {
        const result = await sendWithRateLimitRetry({
          from,
          recipient,
          copy,
          text,
        });

        results.push({
          recipient,
          copyId: copy.id,
          subject: copy.subject,
          status: "status" in result ? result.status : "error",
          error: "error" in result ? result.error : null,
        });
      } catch (error) {
        results.push({
          recipient,
          copyId: copy.id,
          subject: copy.subject,
          status: "error",
          error: errorMessageFrom(error),
        });
      }
    }

    return Response.json({
      sent: results.filter((result) => result.status === "success").length,
      results,
      rateLimit: {
        intervalMs: TEST_EMAIL_INTERVAL_MS,
        retryMs: RATE_LIMIT_RETRY_MS,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
