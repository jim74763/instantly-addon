export type InstantlyEmailBody = {
  text?: string | null;
  html?: string | null;
};

export type InstantlyAttachment = {
  filename?: string | null;
  size?: number | null;
  type?: string | null;
  url?: string | null;
  error?: string | null;
};

export type InstantlyEmail = {
  id: string;
  timestamp_created: string;
  timestamp_email: string;
  message_id: string;
  subject: string;
  to_address_email_list: string;
  body: InstantlyEmailBody;
  organization_id: string;
  eaccount: string;
  from_address_email: string | null;
  cc_address_email_list: string | null;
  bcc_address_email_list: string | null;
  reply_to: string | null;
  campaign_id: string | null;
  subsequence_id: string | null;
  list_id: string | null;
  lead: string | null;
  lead_id: string | null;
  ue_type: 1 | 2 | 3 | 4 | null;
  step: string | null;
  is_unread: number | null;
  is_auto_reply: number | null;
  reminder_ts: string | null;
  ai_interest_value: number | null;
  ai_assisted: number | null;
  is_focused: number | null;
  i_status: number | null;
  thread_id: string | null;
  content_preview: string | null;
  attachment_json?: { files?: InstantlyAttachment[] } | null;
  from_address_json?: unknown[] | null;
  to_address_json?: unknown[] | null;
  cc_address_json?: unknown[] | null;
  ai_agent_id: string | null;
};

export type InstantlyAccount = Record<string, unknown> & {
  email: string;
  first_name: string;
  last_name: string;
  status: number | null;
  warmup_status: number | null;
  provider_code: number | null;
  setup_pending: boolean;
  is_managed_account: boolean;
  daily_limit: number | null;
  timestamp_created: string;
  timestamp_updated: string;
  timestamp_last_used?: string | null;
  stat_warmup_score?: number | null;
  status_message?: {
    code?: string;
    response?: string;
    responseCode?: number;
    e_message?: string;
  } | null;
  tags?: { id: string; label: string; description?: string | null }[];
};

export type InstantlyCampaign = {
  id: string;
  name: string;
  status: number;
  timestamp_created?: string;
  organization?: string;
  owned_by?: string | null;
};

export type InstantlyLead = Record<string, unknown> & {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  campaign?: string | null;
  list_id?: string | null;
  timestamp_created?: string | null;
  timestamp_updated?: string | null;
};

export type InstantlyPaginated<T> = {
  items: T[];
  next_starting_after?: string | null;
};

export type InstantlyUnreadCount = {
  count: number;
};

export type InstantlySuccess = {
  success: boolean;
};

export type InstantlyReplyPayload = {
  eaccount: string;
  reply_to_uuid: string;
  subject: string;
  body: {
    text?: string;
    html?: string;
  };
  cc_address_email_list?: string;
  bcc_address_email_list?: string;
  reminder_ts?: string;
  assigned_to?: string;
};

export type InstantlyPatchEmailPayload = {
  is_unread?: number | null;
  reminder_ts?: string | null;
};

export class InstantlyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstantlyConfigError";
  }
}

export class InstantlyApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.name = "InstantlyApiError";
    this.status = status;
    this.details = details;
  }
}

type InstantlyRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  searchParams?: URLSearchParams;
  body?: unknown;
};

const DEFAULT_BASE_URL = "https://api.instantly.ai/api/v2";
const REQUEST_TIMEOUT_MS = 20000;

function getApiBaseUrl() {
  return (process.env.INSTANTLY_API_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

function getApiKey() {
  const apiKey = process.env.INSTANTLY_API_KEY?.trim();

  if (!apiKey) {
    throw new InstantlyConfigError(
      "Missing INSTANTLY_API_KEY. Add it to .env.local and restart the dev server.",
    );
  }

  return apiKey;
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

export async function instantlyFetch<T>(
  path: string,
  options: InstantlyRequestOptions = {},
): Promise<T> {
  const url = new URL(`${getApiBaseUrl()}${path}`);

  if (options.searchParams) {
    for (const [key, value] of options.searchParams) {
      if (value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${getApiKey()}`,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new InstantlyApiError(
      response.status,
      readErrorMessage(payload, `Instantly API returned ${response.status}`),
      payload,
    );
  }

  return payload as T;
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof InstantlyConfigError) {
    return Response.json(
      {
        error: error.message,
        code: "missing_api_key",
      },
      { status: 500 },
    );
  }

  if (error instanceof InstantlyApiError) {
    return Response.json(
      {
        error: error.message,
        code: "instantly_api_error",
        upstreamStatus: error.status,
        details: error.details,
      },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error ? error.message : "Unexpected local API error";

  return Response.json(
    {
      error: message,
      code: "local_api_error",
    },
    { status: 500 },
  );
}

export function copyInstantlySearchParams(
  source: URLSearchParams,
  allowedKeys: string[],
) {
  const target = new URLSearchParams();

  for (const key of allowedKeys) {
    const value = source.get(key);
    if (value !== null) {
      target.set(key, value);
    }
  }

  return target;
}
