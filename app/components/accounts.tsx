"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardShell, SiteHeader } from "@/components/dashboard-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";
import type { InstantlyAccount, InstantlyPaginated } from "@/lib/instantly";

type SortDirection = "asc" | "desc";
type BooleanFilter = "all" | "true" | "false";

type AccountFilters = {
  search: string;
  tagId: string;
  status: string;
  providerCode: string;
  warmupStatus: string;
  setupPending: BooleanFilter;
  managedAccount: BooleanFilter;
};

type TestEmailResult = {
  status?: "success";
  error?: string;
};

type AccountTag = {
  id: string;
  label: string;
};

const LEGACY_FILTER_STORAGE_KEY = "email-accounts:filters";
const LEGACY_SORT_STORAGE_KEY = "email-accounts:sort";
const FILTER_STORAGE_KEY = "accounts:filters";
const SORT_STORAGE_KEY = "accounts:sort";

const initialFilters: AccountFilters = {
  search: "",
  tagId: "",
  status: "all",
  providerCode: "all",
  warmupStatus: "all",
  setupPending: "all",
  managedAccount: "all",
};

const sortFields = [
  "email",
  "first_name",
  "last_name",
  "status",
  "warmup_status",
  "provider_code",
  "daily_limit",
  "timestamp_created",
  "timestamp_updated",
  "timestamp_last_used",
  "tags",
] as const;

const accountStatusLabels: Record<number, string> = {
  1: "Active",
  2: "Paused",
  3: "Maintenance pause",
  [-1]: "Connection error",
  [-2]: "Soft bounce error",
  [-3]: "Sending error",
};

const warmupStatusLabels: Record<number, string> = {
  0: "Paused",
  1: "Active",
  [-1]: "Banned",
  [-2]: "Spam folder unknown",
  [-3]: "Permanent suspension",
};

const providerLabels: Record<number, string> = {
  1: "Custom IMAP/SMTP",
  2: "Google",
  3: "Microsoft",
  4: "AWS",
  8: "AirMail",
};

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

function isBooleanFilter(value: unknown): value is BooleanFilter {
  return value === "all" || value === "true" || value === "false";
}

function readStoredFilters(): AccountFilters {
  if (typeof window === "undefined") {
    return initialFilters;
  }

  const raw =
    window.localStorage.getItem(FILTER_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_FILTER_STORAGE_KEY);

  if (!raw) {
    return initialFilters;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AccountFilters>;

    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      tagId: typeof parsed.tagId === "string" ? parsed.tagId : "",
      status: typeof parsed.status === "string" ? parsed.status : "all",
      providerCode:
        typeof parsed.providerCode === "string" ? parsed.providerCode : "all",
      warmupStatus:
        typeof parsed.warmupStatus === "string" ? parsed.warmupStatus : "all",
      setupPending: isBooleanFilter(parsed.setupPending)
        ? parsed.setupPending
        : "all",
      managedAccount: isBooleanFilter(parsed.managedAccount)
        ? parsed.managedAccount
        : "all",
    };
  } catch {
    return initialFilters;
  }
}

function readStoredSort(): { sort: string; direction: SortDirection } {
  if (typeof window === "undefined") {
    return { sort: "email", direction: "asc" as SortDirection };
  }

  const raw =
    window.localStorage.getItem(SORT_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SORT_STORAGE_KEY);

  if (!raw) {
    return { sort: "email", direction: "asc" as SortDirection };
  }

  try {
    const parsed = JSON.parse(raw) as {
      sort?: string;
      direction?: SortDirection;
    };

    return {
      sort:
        typeof parsed.sort === "string" &&
        sortFields.includes(parsed.sort as (typeof sortFields)[number])
          ? parsed.sort
          : "email",
      direction: parsed.direction === "desc" ? "desc" : "asc",
    };
  } catch {
    return { sort: "email", direction: "asc" as SortDirection };
  }
}

function labelFromMap(
  value: unknown,
  labels: Record<number, string>,
  fallbackPrefix: string,
) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && labels[numericValue]) {
    return labels[numericValue];
  }

  return `${fallbackPrefix} ${String(value)}`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatAccountStatus(value: unknown) {
  return labelFromMap(value, accountStatusLabels, "Unknown status");
}

function formatWarmupStatus(value: unknown) {
  return labelFromMap(value, warmupStatusLabels, "Unknown warmup status");
}

function formatProvider(value: unknown) {
  return labelFromMap(value, providerLabels, "Unknown provider");
}

function formatFieldLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeExtraValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return keys.length ? keys.slice(0, 3).join(", ") : "object";
  }

  return formatValue(value);
}

function formatDetailValue(key: string, value: unknown) {
  if (key === "status") {
    return formatAccountStatus(value);
  }

  if (key === "warmup_status") {
    return formatWarmupStatus(value);
  }

  if (key === "provider_code") {
    return formatProvider(value);
  }

  if (key === "tags") {
    const tags = Array.isArray(value)
      ? value
          .map((tag, index) => tagFromUnknown(tag, index))
          .filter((tag): tag is AccountTag => tag !== null)
      : [];

    return tags.length ? tags.map((tag) => tag.label).join(", ") : "n/a";
  }

  if (key.startsWith("timestamp_")) {
    return formatDate(value);
  }

  return formatValue(value);
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "n/a";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function tagFromUnknown(value: unknown, index: number): AccountTag | null {
  if (typeof value === "string") {
    return { id: value, label: value };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const idValue = record.id ?? record.tag_id ?? record.value;
  const labelValue = record.label ?? record.name ?? record.tag ?? idValue;

  if (!labelValue) {
    return null;
  }

  return {
    id: String(idValue ?? `${labelValue}-${index}`),
    label: String(labelValue),
  };
}

function tagsFor(account: InstantlyAccount) {
  const rawTags = account.tags;

  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((tag, index) => tagFromUnknown(tag, index))
    .filter((tag): tag is AccountTag => tag !== null);
}

function textForSearch(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value).toLowerCase();
  }

  return String(value).toLowerCase();
}

function sortValue(account: InstantlyAccount, field: string) {
  if (field === "tags") {
    return tagsFor(account)
      .map((tag) => tag.label)
      .join(", ");
  }

  return account[field];
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

function normalizeRecipients(value: string) {
  return value
    .split(/[,\n]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join(",");
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<InstantlyAccount[]>([]);
  const [filters, setFilters] = useState<AccountFilters>(initialFilters);
  const [sort, setSort] = useState("email");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [hasRestoredPreferences, setHasRestoredPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedAccount, setSelectedAccount] =
    useState<InstantlyAccount | null>(null);
  const [testForm, setTestForm] = useState({
    from: "",
    to: "",
    subject: "",
    body: "",
  });

  const tagOptions = useMemo(() => {
    const tags = new Map<string, string>();

    for (const account of accounts) {
      for (const tag of tagsFor(account)) {
        tags.set(tag.id, tag.label);
      }
    }

    return Array.from(tags, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [accounts]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(
        accounts
          .map((account) => account.status)
          .filter((value) => value !== null && value !== undefined)
          .map(String),
      ),
    ).sort((a, b) => Number(a) - Number(b));
  }, [accounts]);

  const providerOptions = useMemo(() => {
    return Array.from(
      new Set(
        accounts
          .map((account) => account.provider_code)
          .filter((value) => value !== null && value !== undefined)
          .map(String),
      ),
    ).sort((a, b) => Number(a) - Number(b));
  }, [accounts]);

  const warmupOptions = useMemo(() => {
    return Array.from(
      new Set(
        accounts
          .map((account) => account.warmup_status)
          .filter((value) => value !== null && value !== undefined)
          .map(String),
      ),
    ).sort((a, b) => Number(a) - Number(b));
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return accounts
      .filter((account) => {
        if (search && !textForSearch(account).includes(search)) {
          return false;
        }

        if (
          filters.tagId &&
          !tagsFor(account).some((tag) => tag.id === filters.tagId)
        ) {
          return false;
        }

        if (
          filters.status !== "all" &&
          String(account.status) !== filters.status
        ) {
          return false;
        }

        if (
          filters.providerCode !== "all" &&
          String(account.provider_code) !== filters.providerCode
        ) {
          return false;
        }

        if (
          filters.warmupStatus !== "all" &&
          String(account.warmup_status) !== filters.warmupStatus
        ) {
          return false;
        }

        if (
          filters.setupPending !== "all" &&
          String(Boolean(account.setup_pending)) !== filters.setupPending
        ) {
          return false;
        }

        if (
          filters.managedAccount !== "all" &&
          String(Boolean(account.is_managed_account)) !== filters.managedAccount
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const left = sortValue(a, sort);
        const right = sortValue(b, sort);
        const multiplier = direction === "asc" ? 1 : -1;

        if (typeof left === "number" && typeof right === "number") {
          return (left - right) * multiplier;
        }

        return (
          formatValue(left).localeCompare(formatValue(right), undefined, {
            numeric: true,
            sensitivity: "base",
          }) * multiplier
        );
      });
  }, [accounts, direction, filters, sort]);

  const selectedAccountFields = useMemo(() => {
    if (!selectedAccount) {
      return [];
    }

    return Object.entries(selectedAccount).sort(([left], [right]) =>
      formatFieldLabel(left).localeCompare(formatFieldLabel(right)),
    );
  }, [selectedAccount]);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextAccounts: InstantlyAccount[] = [];
      let cursor: string | null = null;

      do {
        const params = new URLSearchParams({
          limit: "100",
          include_tags: "true",
        });

        if (cursor) {
          params.set("starting_after", cursor);
        }

        const page = await localFetch<InstantlyPaginated<InstantlyAccount>>(
          `/api/instantly/accounts?${params.toString()}`,
        );

        nextAccounts.push(...page.items);
        cursor = page.next_starting_after ?? null;
      } while (cursor);

      setAccounts(nextAccounts);
      setTestForm((current) => ({
        ...current,
        from: current.from || nextAccounts[0]?.email || "",
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load email accounts",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedFilters = readStoredFilters();
    const storedSort = readStoredSort();

    void Promise.resolve().then(() => {
      setFilters(storedFilters);
      setSort(storedSort.sort);
      setDirection(storedSort.direction);
      setHasRestoredPreferences(true);
    });
  }, []);

  useEffect(() => {
    if (!hasRestoredPreferences) {
      return;
    }

    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters, hasRestoredPreferences]);

  useEffect(() => {
    if (!hasRestoredPreferences) {
      return;
    }

    window.localStorage.setItem(
      SORT_STORAGE_KEY,
      JSON.stringify({ sort, direction }),
    );
  }, [direction, hasRestoredPreferences, sort]);

  useEffect(() => {
    if (!hasRestoredPreferences) {
      return;
    }

    void Promise.resolve().then(() => loadAccounts());
  }, [hasRestoredPreferences, loadAccounts]);

  function updateFilter<Key extends keyof AccountFilters>(
    key: Key,
    value: AccountFilters[Key],
  ) {
    setNotice("");
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function sendTestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const recipients = normalizeRecipients(testForm.to);

    if (!testForm.from || !recipients || !testForm.subject || !testForm.body) {
      setError("From account, recipients, subject, and body are required.");
      return;
    }

    setIsSending(true);
    setError("");
    setNotice("");

    try {
      const result = await localFetch<TestEmailResult>(
        "/api/instantly/emails/test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eaccount: testForm.from,
            to_address_email_list: recipients,
            subject: testForm.subject,
            body: {
              html: textToHtml(testForm.body),
            },
          }),
        },
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setNotice("Test email sent.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send test email",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <DashboardShell>
      <SiteHeader
        title="Accounts"
        description={`${filteredAccounts.length} of ${accounts.length} accounts`}
        actions={
          <Button
            type="button"
            onClick={loadAccounts}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
        }
      />

      <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:p-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <Alert>
            <AlertTitle>Updated</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-lg border bg-card">
            <div className="border-b p-4">
              <FieldGroup>
                <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(150px,180px))]">
                  <Field>
                    <FieldLabel>Search</FieldLabel>
                    <Input
                      value={filters.search}
                      onChange={(event) =>
                        updateFilter("search", event.target.value)
                      }
                      placeholder="Search account data"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Tag</FieldLabel>
                    <Select
                      value={filters.tagId || "all"}
                      onValueChange={(value) =>
                        updateFilter(
                          "tagId",
                          value && value !== "all" ? value : "",
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All tags" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All tags</SelectItem>
                          {tagOptions.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              {tag.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      value={filters.status}
                      onValueChange={(value) =>
                        updateFilter("status", value ?? "all")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All statuses</SelectItem>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {formatAccountStatus(status)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Provider</FieldLabel>
                    <Select
                      value={filters.providerCode}
                      onValueChange={(value) =>
                        updateFilter("providerCode", value ?? "all")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All providers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All providers</SelectItem>
                          {providerOptions.map((provider) => (
                            <SelectItem key={provider} value={provider}>
                              {formatProvider(provider)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-3 lg:grid-cols-5">
                  <Field>
                    <FieldLabel>Warmup</FieldLabel>
                    <Select
                      value={filters.warmupStatus}
                      onValueChange={(value) =>
                        updateFilter("warmupStatus", value ?? "all")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All warmup states" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All warmup states</SelectItem>
                          {warmupOptions.map((warmup) => (
                            <SelectItem key={warmup} value={warmup}>
                              {formatWarmupStatus(warmup)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Setup pending</FieldLabel>
                    <Select
                      value={filters.setupPending}
                      onValueChange={(value) =>
                        updateFilter(
                          "setupPending",
                          isBooleanFilter(value) ? value : "all",
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">Any</SelectItem>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Managed</FieldLabel>
                    <Select
                      value={filters.managedAccount}
                      onValueChange={(value) =>
                        updateFilter(
                          "managedAccount",
                          isBooleanFilter(value) ? value : "all",
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">Any</SelectItem>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Sort by</FieldLabel>
                    <Select
                      value={sort}
                      onValueChange={(value) => {
                        if (value) {
                          setSort(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sort field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {sortFields.map((field) => (
                            <SelectItem key={field} value={field}>
                              {formatFieldLabel(field)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Direction</FieldLabel>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDirection((current) =>
                          current === "asc" ? "desc" : "asc",
                        )
                      }
                    >
                      {direction === "asc" ? (
                        <ArrowUpIcon data-icon="inline-start" />
                      ) : (
                        <ArrowDownIcon data-icon="inline-start" />
                      )}
                      {direction === "asc" ? "Ascending" : "Descending"}
                    </Button>
                  </Field>
                </div>
              </FieldGroup>
            </div>

            <ScrollArea className="h-[calc(100vh-var(--header-height)-290px)] min-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Email",
                      "Name",
                      "Status",
                      "Warmup",
                      "Provider",
                      "Daily limit",
                      "Last used",
                      "Tags",
                      "Extra fields",
                    ].map((heading) => (
                      <TableHead
                        key={heading}
                        className="sticky top-0 z-20 bg-card"
                      >
                        {heading}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => {
                    const extraFields = Object.entries(account).filter(
                      ([key]) =>
                        ![
                          "email",
                          "first_name",
                          "last_name",
                          "status",
                          "warmup_status",
                          "provider_code",
                          "daily_limit",
                          "timestamp_last_used",
                          "tags",
                        ].includes(key),
                    );

                    return (
                      <TableRow
                        key={account.email}
                        tabIndex={0}
                        onClick={() => setSelectedAccount(account)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedAccount(account);
                          }
                        }}
                        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <TableCell className="font-medium">
                          {account.email}
                        </TableCell>
                        <TableCell>
                          {[account.first_name, account.last_name]
                            .filter(Boolean)
                            .join(" ") || "n/a"}
                        </TableCell>
                        <TableCell>
                          {formatAccountStatus(account.status)}
                        </TableCell>
                        <TableCell>
                          {formatWarmupStatus(account.warmup_status)}
                        </TableCell>
                        <TableCell>
                          {formatProvider(account.provider_code)}
                        </TableCell>
                        <TableCell>
                          {formatValue(account.daily_limit)}
                        </TableCell>
                        <TableCell>
                          {formatDate(account.timestamp_last_used)}
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-64 flex-wrap gap-1">
                            {tagsFor(account).length ? (
                              tagsFor(account).map((tag) => (
                                <Badge key={tag.id} variant="secondary">
                                  {tag.label}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">n/a</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {extraFields.length ? (
                            <div className="flex max-w-96 flex-wrap gap-1">
                              {extraFields.slice(0, 5).map(([key, value]) => (
                                <Badge key={key} variant="outline">
                                  {formatFieldLabel(key)}:{" "}
                                  {summarizeExtraValue(value)}
                                </Badge>
                              ))}
                              {extraFields.length > 5 ? (
                                <Badge variant="outline">
                                  +{extraFields.length - 5} more
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">n/a</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!isLoading && filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No accounts match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </ScrollArea>
          </section>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Send test email</CardTitle>
                <CardDescription>
                  Sends a preview email through Instantly without creating a
                  Unibox email record.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={sendTestEmail}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>From</FieldLabel>
                      <Select
                        value={testForm.from}
                        onValueChange={(value) => {
                          if (value) {
                            setTestForm((current) => ({
                              ...current,
                              from: value,
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {accounts.map((account) => (
                              <SelectItem
                                key={account.email}
                                value={account.email}
                              >
                                {account.email}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>To</FieldLabel>
                      <Textarea
                        value={testForm.to}
                        onChange={(event) =>
                          setTestForm((current) => ({
                            ...current,
                            to: event.target.value,
                          }))
                        }
                        placeholder="one@example.com, two@example.com"
                        rows={3}
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Subject</FieldLabel>
                      <Input
                        value={testForm.subject}
                        onChange={(event) =>
                          setTestForm((current) => ({
                            ...current,
                            subject: event.target.value,
                          }))
                        }
                        placeholder="Test email subject"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Body</FieldLabel>
                      <Textarea
                        value={testForm.body}
                        onChange={(event) =>
                          setTestForm((current) => ({
                            ...current,
                            body: event.target.value,
                          }))
                        }
                        placeholder="Plain text body"
                        rows={8}
                      />
                    </Field>

                    <Button type="submit" disabled={isSending}>
                      <SendIcon data-icon="inline-start" />
                      {isSending ? "Sending" : "Send test email"}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog
          open={selectedAccount !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedAccount(null);
            }
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {selectedAccount?.email ?? "Email account"}
              </DialogTitle>
              <DialogDescription>
                All account fields returned by Instantly.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[65vh] rounded-lg border">
              <div className="grid divide-y">
                {selectedAccountFields.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid gap-1 p-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4"
                  >
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {formatFieldLabel(key)}
                    </div>
                    <div className="min-w-0 text-sm">
                      {key === "tags" && tagsFor(selectedAccount!).length ? (
                        <div className="flex flex-wrap gap-1">
                          {tagsFor(selectedAccount!).map((tag) => (
                            <Badge key={tag.id} variant="secondary">
                              {tag.label}
                            </Badge>
                          ))}
                        </div>
                      ) : typeof value === "object" &&
                        value !== null &&
                        key !== "tags" ? (
                        <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : (
                        <span className="break-words">
                          {formatDetailValue(key, value)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
