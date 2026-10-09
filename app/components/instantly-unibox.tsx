"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell, SiteHeader } from "@/components/dashboard-shell";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react";
import type {
  InstantlyAccount,
  InstantlyCampaign,
  InstantlyEmail,
  InstantlyPaginated,
} from "@/lib/instantly";

type LocalMeta = {
  unreadCount: number | null;
  accounts: InstantlyAccount[];
  campaigns: InstantlyCampaign[];
  warnings: { resource: string; message: string }[];
};

type InboxMode = "emode_focused" | "emode_others" | "emode_all";
type EmailType = "all" | "received" | "sent" | "manual";
type ReadFilter = "all" | "unread";

type Filters = {
  mode: InboxMode;
  read: ReadFilter;
  type: EmailType;
  search: string;
  eaccount: string;
  campaignId: string;
};

type LoadMode = "replace" | "append";

const initialFilters: Filters = {
  mode: "emode_focused",
  read: "all",
  type: "all",
  search: "",
  eaccount: "",
  campaignId: "",
};

const UNIBOX_FILTERS_STORAGE_KEY = "instantly-unibox:filters";

const inboxModes = ["emode_focused", "emode_others", "emode_all"] as const;
const readFilters = ["all", "unread"] as const;
const emailTypes = ["all", "received", "sent", "manual"] as const;

const modeLabels: Record<InboxMode, string> = {
  emode_focused: "Focused",
  emode_others: "Other",
  emode_all: "All",
};

const typeLabels: Record<EmailType, string> = {
  all: "All mail",
  received: "Received",
  sent: "Sent",
  manual: "Manual",
};

const interestLabels: Record<number, string> = {
  0: "Neutral",
  1: "Interested",
  2: "Maybe later",
  3: "Not interested",
  4: "Do not contact",
};

function isInboxMode(value: unknown): value is InboxMode {
  return typeof value === "string" && inboxModes.includes(value as InboxMode);
}

function isReadFilter(value: unknown): value is ReadFilter {
  return typeof value === "string" && readFilters.includes(value as ReadFilter);
}

function isEmailType(value: unknown): value is EmailType {
  return typeof value === "string" && emailTypes.includes(value as EmailType);
}

function readStoredFilters(): Filters {
  if (typeof window === "undefined") {
    return initialFilters;
  }

  const rawFilters = window.localStorage.getItem(UNIBOX_FILTERS_STORAGE_KEY);

  if (!rawFilters) {
    return initialFilters;
  }

  try {
    const parsed = JSON.parse(rawFilters) as Partial<Filters>;

    return {
      mode: isInboxMode(parsed.mode) ? parsed.mode : initialFilters.mode,
      read: isReadFilter(parsed.read) ? parsed.read : initialFilters.read,
      type: isEmailType(parsed.type) ? parsed.type : initialFilters.type,
      search:
        typeof parsed.search === "string"
          ? parsed.search
          : initialFilters.search,
      eaccount:
        typeof parsed.eaccount === "string"
          ? parsed.eaccount
          : initialFilters.eaccount,
      campaignId:
        typeof parsed.campaignId === "string"
          ? parsed.campaignId
          : initialFilters.campaignId,
    };
  } catch {
    return initialFilters;
  }
}

async function localFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSender(email: InstantlyEmail) {
  return email.from_address_email || email.lead || email.eaccount || "Unknown";
}

function getRecipient(email: InstantlyEmail) {
  return email.to_address_email_list || email.lead || "No recipient";
}

function getPreview(email: InstantlyEmail) {
  return (
    email.content_preview ||
    email.body?.text ||
    stripHtml(email.body?.html || "") ||
    "No preview"
  );
}

function safeHttpsUrl(value?: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBodyText(email: InstantlyEmail) {
  return email.body?.text || stripHtml(email.body?.html || "");
}

function normalizeSubject(subject: string) {
  const trimmed = subject.trim() || "No subject";
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

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

function accountLabel(account: InstantlyAccount) {
  const name = [account.first_name, account.last_name].filter(Boolean).join(" ");
  return name ? `${name} · ${account.email}` : account.email;
}

function statusTone(email: InstantlyEmail) {
  if (email.is_unread) {
    return "border-l-primary bg-card";
  }

  if (email.is_auto_reply) {
    return "border-l-muted-foreground bg-muted/50";
  }

  return "border-l-transparent bg-muted/30";
}

function buildEmailParams(filters: Filters, cursor?: string | null) {
  const params = new URLSearchParams({
    limit: "25",
    sort_order: "desc",
    mode: filters.mode,
    latest_of_thread: "true",
  });

  if (cursor) {
    params.set("starting_after", cursor);
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.eaccount) {
    params.set("eaccount", filters.eaccount);
  }

  if (filters.campaignId) {
    params.set("campaign_id", filters.campaignId);
  }

  if (filters.read === "unread") {
    params.set("is_unread", "true");
  }

  if (filters.type !== "all") {
    params.set("email_type", filters.type);
  }

  return params;
}

function fetchEmailPage(filters: Filters, cursor?: string | null) {
  const params = buildEmailParams(filters, cursor);
  return localFetch<InstantlyPaginated<InstantlyEmail>>(
    `/api/instantly/emails?${params.toString()}`,
  );
}

function fetchThreadPage(email: InstantlyEmail) {
  if (!email.thread_id) {
    return Promise.resolve({ items: [email], next_starting_after: null });
  }

  const params = new URLSearchParams({
    limit: "100",
    sort_order: "asc",
    search: `thread:${email.thread_id}`,
    mode: "emode_all",
  });

  return localFetch<InstantlyPaginated<InstantlyEmail>>(
    `/api/instantly/emails?${params.toString()}`,
  );
}

export default function InstantlyUnibox() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [draftSearch, setDraftSearch] = useState("");
  const [hasRestoredFilters, setHasRestoredFilters] = useState(false);
  const [meta, setMeta] = useState<LocalMeta>({
    unreadCount: null,
    accounts: [],
    campaigns: [],
    warnings: [],
  });
  const [emails, setEmails] = useState<InstantlyEmail[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [thread, setThread] = useState<InstantlyEmail[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [replyText, setReplyText] = useState("");
  const [replyAccount, setReplyAccount] = useState("");
  const [replySubject, setReplySubject] = useState("");

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedId) ?? emails[0] ?? null,
    [emails, selectedId],
  );

  const campaignById = useMemo(() => {
    return new Map(meta.campaigns.map((campaign) => [campaign.id, campaign]));
  }, [meta.campaigns]);

  const selectedCampaignLabel =
    filters.campaignId === ""
      ? "All campaigns"
      : (campaignById.get(filters.campaignId)?.name ?? "Loading campaign");

  const unreadVisible = useMemo(() => {
    return emails.reduce((total, email) => total + (email.is_unread ? 1 : 0), 0);
  }, [emails]);

  const loadMeta = useCallback(async () => {
    const data = await localFetch<LocalMeta>("/api/instantly/meta", {
      method: "POST",
    });
    setMeta(data);
  }, []);

  const loadEmails = useCallback(
    async (mode: LoadMode = "replace", cursor?: string | null) => {
      setIsLoading(true);
      setError("");

      try {
        const data = await fetchEmailPage(
          filters,
          mode === "append" ? cursor : null,
        );

        setEmails((current) => {
          const merged = mode === "append" ? [...current, ...data.items] : data.items;
          const unique = new Map(merged.map((email) => [email.id, email]));
          return Array.from(unique.values());
        });
        setNextCursor(data.next_starting_after ?? null);

        if (mode === "replace") {
          setSelectedId(data.items[0]?.id ?? "");
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load emails",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    let cancelled = false;

    localFetch<LocalMeta>("/api/instantly/meta", {
      method: "POST",
    })
      .then((data) => {
        if (!cancelled) {
          setMeta(data);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load Instantly metadata",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const storedFilters = readStoredFilters();

    void Promise.resolve().then(() => {
      setFilters(storedFilters);
      setDraftSearch(storedFilters.search);
      setHasRestoredFilters(true);
    });
  }, []);

  useEffect(() => {
    if (!hasRestoredFilters) {
      return;
    }

    window.localStorage.setItem(
      UNIBOX_FILTERS_STORAGE_KEY,
      JSON.stringify(filters),
    );
  }, [filters, hasRestoredFilters]);

  useEffect(() => {
    let cancelled = false;

    if (!hasRestoredFilters) {
      return () => {
        cancelled = true;
      };
    }

    fetchEmailPage(filters)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setEmails(data.items);
        setNextCursor(data.next_starting_after ?? null);
        setSelectedId(data.items[0]?.id ?? "");
        setIsLoading(false);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load emails",
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, hasRestoredFilters]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedEmail) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setThread([]);
          setReplyAccount("");
          setReplySubject("");
        }
      });

      return () => {
        cancelled = true;
      };
    }

    Promise.resolve().then(() => {
      if (!cancelled) {
        setReplyAccount(selectedEmail.eaccount || meta.accounts[0]?.email || "");
        setReplySubject(normalizeSubject(selectedEmail.subject));
        setIsThreadLoading(true);
      }
    });

    fetchThreadPage(selectedEmail)
      .then((data) => {
        if (!cancelled) {
          setThread(data.items.length ? data.items : [selectedEmail]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThread([selectedEmail]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsThreadLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meta.accounts, selectedEmail]);

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setNotice("");
    setIsLoading(true);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter("search", draftSearch);
  }

  async function refreshAll() {
    setNotice("");
    await Promise.all([loadMeta(), loadEmails("replace")]);
  }

  async function markThreadRead() {
    if (!selectedEmail?.thread_id) {
      return;
    }

    setNotice("");
    setError("");

    try {
      await localFetch<{ success: boolean }>(
        `/api/instantly/emails/threads/${selectedEmail.thread_id}/mark-as-read`,
        {
          method: "POST",
        },
      );
      setEmails((current) =>
        current.map((email) =>
          email.thread_id === selectedEmail.thread_id
            ? { ...email, is_unread: 0 }
            : email,
        ),
      );
      setThread((current) =>
        current.map((email) => ({ ...email, is_unread: 0 })),
      );
      setNotice("Thread marked read.");
      void loadMeta();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to mark thread read",
      );
    }
  }

  async function toggleUnread(email: InstantlyEmail) {
    setNotice("");
    setError("");

    const nextUnread = email.is_unread ? 0 : 1;

    try {
      const updated = await localFetch<InstantlyEmail>(
        `/api/instantly/emails/${email.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_unread: nextUnread }),
        },
      );

      setEmails((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setThread((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(nextUnread ? "Email marked unread." : "Email marked read.");
      void loadMeta();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update email",
      );
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEmail || !replyText.trim()) {
      return;
    }

    setIsSending(true);
    setNotice("");
    setError("");

    try {
      const sent = await localFetch<InstantlyEmail>("/api/instantly/emails/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eaccount: replyAccount || selectedEmail.eaccount,
          reply_to_uuid: selectedEmail.id,
          subject: replySubject || normalizeSubject(selectedEmail.subject),
          body: {
            text: replyText.trim(),
            html: textToHtml(replyText.trim()),
          },
        }),
      });

      setReplyText("");
      setThread((current) => [...current, sent]);
      setEmails((current) =>
        current.map((email) =>
          email.thread_id === selectedEmail.thread_id
            ? { ...email, is_unread: 0, timestamp_email: sent.timestamp_email }
            : email,
        ),
      );
      setNotice("Reply sent.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send reply",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <DashboardShell>
      <SiteHeader
        title="Instantly Unibox"
        description={
          meta.unreadCount === null
            ? `${unreadVisible} unread in view`
            : `${meta.unreadCount} unread in workspace`
        }
        actions={
          <>
            <ToggleGroup
              value={[filters.mode]}
              onValueChange={(value) => {
                const [mode] = (value ?? []) as InboxMode[];
                if (mode) {
                  updateFilter("mode", mode);
                }
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              {(Object.keys(modeLabels) as InboxMode[]).map((mode) => (
                <ToggleGroupItem key={mode} value={mode}>
                  {modeLabels[mode]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              type="button"
              onClick={refreshAll}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="@container/main flex flex-1 flex-col">
        <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)_320px]">
          <aside className="min-h-0 border-b bg-sidebar lg:border-r lg:border-b-0">
            <div className="border-b p-4">
              <form onSubmit={submitSearch} className="flex gap-2">
                <Input
                  value={draftSearch}
                  onChange={(event) => setDraftSearch(event.target.value)}
                  placeholder="Search lead, subject, thread"
                  className="min-w-0 flex-1 bg-background"
                />
                <Button
                  type="submit"
                  size="sm"
                >
                  <SearchIcon data-icon="inline-start" />
                  Search
                </Button>
              </form>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Select
                  value={filters.read}
                  onValueChange={(value) => {
                    if (value) {
                      updateFilter("read", value as ReadFilter);
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Read state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All read states</SelectItem>
                      <SelectItem value="unread">Unread only</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.type}
                  onValueChange={(value) => {
                    if (value) {
                      updateFilter("type", value as EmailType);
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Email type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(Object.keys(typeLabels) as EmailType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {typeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2">
                <Select
                  value={filters.eaccount || "all"}
                  onValueChange={(value) => {
                    if (value) {
                      updateFilter("eaccount", value === "all" ? "" : value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All accounts</SelectItem>
                      {meta.accounts.map((account) => (
                        <SelectItem key={account.email} value={account.email}>
                          {accountLabel(account)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.campaignId || "all"}
                  onValueChange={(value) => {
                    if (value) {
                      updateFilter("campaignId", value === "all" ? "" : value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-background">
                    <span className="truncate">{selectedCampaignLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All campaigns</SelectItem>
                      {meta.campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="h-[46vh] lg:h-[calc(100vh-196px)]">
              {isLoading && emails.length === 0 ? (
                <div className="flex flex-col gap-3 p-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : emails.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No emails match the current filters.
                </div>
              ) : (
                <div className="divide-y">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setSelectedId(email.id)}
                      className={`w-full border-l-4 p-4 text-left transition hover:bg-white ${statusTone(
                        email,
                      )} ${
                        selectedEmail?.id === email.id
                          ? "ring-2 ring-ring ring-inset"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {getSender(email)}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {email.subject || "No subject"}
                          </p>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatTimestamp(email.timestamp_email)}
                        </time>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {getPreview(email)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {email.is_unread ? (
                          <Badge>Unread</Badge>
                        ) : null}
                        {email.is_auto_reply ? (
                          <Badge variant="secondary">Auto</Badge>
                        ) : null}
                        {email.campaign_id && campaignById.get(email.campaign_id) ? (
                          <Badge variant="outline" className="max-w-full truncate">
                            {campaignById.get(email.campaign_id)?.name}
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {nextCursor ? (
                <div className="p-4">
                  <Button
                    type="button"
                    onClick={() => loadEmails("append", nextCursor)}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </ScrollArea>
          </aside>

          <section className="min-h-0 bg-background">
            {selectedEmail ? (
              <div className="flex h-full min-h-[720px] flex-col lg:min-h-0">
                <div className="border-b px-4 py-4 md:px-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {selectedEmail.is_unread ? (
                          <Badge>Unread</Badge>
                        ) : null}
                        {selectedEmail.i_status !== null ? (
                          <Badge variant="secondary">
                            {interestLabels[selectedEmail.i_status] ??
                              `Status ${selectedEmail.i_status}`}
                          </Badge>
                        ) : null}
                        {selectedEmail.attachment_json?.files?.length ? (
                          <Badge variant="outline">
                            {selectedEmail.attachment_json.files.length} files
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="text-balance text-2xl font-semibold tracking-normal">
                        {selectedEmail.subject || "No subject"}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-600">
                        {getSender(selectedEmail)} to {getRecipient(selectedEmail)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => toggleUnread(selectedEmail)}
                        variant="outline"
                      >
                        {selectedEmail.is_unread ? "Mark read" : "Mark unread"}
                      </Button>
                      <Button
                        type="button"
                        onClick={markThreadRead}
                        disabled={!selectedEmail.thread_id}
                      >
                        Read thread
                      </Button>
                    </div>
                  </div>

                  {error ? (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Request failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  {notice ? (
                    <Alert className="mt-4">
                      <AlertTitle>Updated</AlertTitle>
                      <AlertDescription>{notice}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>

                <ScrollArea className="min-h-0 flex-1 bg-muted/30">
                  <div className="px-4 py-5 md:px-6">
                  {isThreadLoading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-36 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {thread.map((email) => {
                        const isOutbound =
                          email.eaccount &&
                          email.from_address_email === email.eaccount;

                        return (
                          <Card
                            key={email.id}
                            className={isOutbound ? "bg-muted/70" : undefined}
                          >
                            <CardContent className="p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {getSender(email)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {getRecipient(email)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {email.is_unread ? (
                                  <span className="size-2 rounded-full bg-primary" />
                                ) : null}
                                <time className="text-xs text-muted-foreground">
                                  {formatTimestamp(email.timestamp_email)}
                                </time>
                              </div>
                            </div>

                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                              {getBodyText(email) || "No plain-text body returned."}
                            </p>

                            {email.attachment_json?.files?.length ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {email.attachment_json.files.map((file, index) => (
                                  <a
                                    key={`${file.filename}-${index}`}
                                    href={safeHttpsUrl(file.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                                  >
                                    {file.filename || "Attachment"}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </ScrollArea>

                <form
                  onSubmit={sendReply}
                  className="border-t bg-background p-4 md:p-6"
                >
                  <FieldGroup>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <Field>
                        <FieldLabel>From</FieldLabel>
                        <Select
                          value={replyAccount || selectedEmail.eaccount || "workspace"}
                          onValueChange={(value) => {
                            if (value) {
                              setReplyAccount(value);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Workspace account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {meta.accounts.length === 0 ? (
                                <SelectItem
                                  value={selectedEmail.eaccount || "workspace"}
                                >
                                  {selectedEmail.eaccount || "Workspace account"}
                                </SelectItem>
                              ) : (
                                meta.accounts.map((account) => (
                                  <SelectItem
                                    key={account.email}
                                    value={account.email}
                                  >
                                    {account.email}
                                  </SelectItem>
                                ))
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>Subject</FieldLabel>
                        <Input
                          value={replySubject}
                          onChange={(event) => setReplySubject(event.target.value)}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Reply</FieldLabel>
                      <Textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        rows={5}
                        placeholder="Write reply"
                        className="min-h-32 resize-y"
                      />
                    </Field>
                  </FieldGroup>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Replies are sent through Instantly as a reply to the
                      selected email ID.
                    </p>
                    <Button
                      type="submit"
                      disabled={!replyText.trim() || isSending}
                    >
                      <SendIcon data-icon="inline-start" />
                      {isSending ? "Sending" : "Send reply"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
                <div>
                  <h2 className="text-xl font-semibold">No email selected</h2>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Choose a message from the list or adjust the filters.
                  </p>
                  {error ? (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Request failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <aside className="hidden border-l bg-sidebar xl:block">
            <div className="border-b p-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Workspace
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Card>
                  <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Accounts</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {meta.accounts.length}
                  </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Campaigns</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {meta.campaigns.length}
                  </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex flex-col gap-5 p-4">
              <section>
                <h3 className="text-sm font-semibold">
                  Sending accounts
                </h3>
                <div className="mt-3 flex flex-col gap-2">
                  {meta.accounts.slice(0, 8).map((account) => (
                    <Card key={account.email}>
                      <CardContent className="p-3">
                      <p className="truncate text-sm font-medium">{account.email}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>Status {account.status ?? "n/a"}</span>
                        <span>
                          Warmup {account.stat_warmup_score ?? account.warmup_status ?? "n/a"}
                        </span>
                      </div>
                      </CardContent>
                    </Card>
                  ))}
                  {meta.accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No accounts returned for this key.
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">Campaigns</h3>
                <div className="mt-3 flex flex-col gap-2">
                  {meta.campaigns.slice(0, 8).map((campaign) => (
                    <Button
                      key={campaign.id}
                      type="button"
                      onClick={() => updateFilter("campaignId", campaign.id)}
                      variant="outline"
                      className="h-auto w-full justify-start p-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {campaign.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Status {campaign.status}
                        </span>
                      </span>
                    </Button>
                  ))}
                  {meta.campaigns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No campaigns returned for this key.
                    </p>
                  ) : null}
                </div>
              </section>

              {meta.warnings.length ? (
                <section>
                  <h3 className="text-sm font-semibold">
                    API warnings
                  </h3>
                  <div className="mt-3 flex flex-col gap-2">
                    {meta.warnings.map((warning) => (
                      <Alert
                        key={`${warning.resource}-${warning.message}`}
                      >
                        <AlertTitle>{warning.resource}</AlertTitle>
                        <AlertDescription>{warning.message}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </DashboardShell>
  );
}
