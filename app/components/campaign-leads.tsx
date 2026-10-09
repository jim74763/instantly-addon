"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DashboardShell, SiteHeader } from "@/components/dashboard-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaginationActions } from "@/components/pagination-actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  InstantlyCampaign,
  InstantlyLead,
  InstantlyPaginated,
} from "@/lib/instantly";
import {
  ArchiveIcon,
  ChevronsUpDownIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";

type LoadMode = "replace" | "append";
type LeadStatusFilter =
  | "all"
  | "FILTER_VAL_ACTIVE"
  | "FILTER_VAL_PAUSED"
  | "FILTER_VAL_COMPLETED"
  | "FILTER_VAL_BOUNCED"
  | "FILTER_VAL_UNSUBSCRIBED"
  | "FILTER_VAL_SKIPPED"
  | "FILTER_VAL_CONTACTED"
  | "FILTER_VAL_REPLIED"
  | "FILTER_VAL_INTERESTED"
  | "FILTER_VAL_MEETING_BOOKED"
  | "FILTER_VAL_LINK_CLICKED"
  | "FILTER_VAL_EMAIL_OPENED";

const leadStatusFilters: { value: LeadStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "FILTER_VAL_ACTIVE", label: "Active" },
  { value: "FILTER_VAL_PAUSED", label: "Paused" },
  { value: "FILTER_VAL_COMPLETED", label: "Completed" },
  { value: "FILTER_VAL_BOUNCED", label: "Bounced" },
  { value: "FILTER_VAL_UNSUBSCRIBED", label: "Unsubscribed" },
  { value: "FILTER_VAL_SKIPPED", label: "Skipped" },
  { value: "FILTER_VAL_CONTACTED", label: "Contacted" },
  { value: "FILTER_VAL_REPLIED", label: "Reply received" },
  { value: "FILTER_VAL_INTERESTED", label: "Interested" },
  { value: "FILTER_VAL_MEETING_BOOKED", label: "Meeting booked" },
  { value: "FILTER_VAL_LINK_CLICKED", label: "Link clicked" },
  { value: "FILTER_VAL_EMAIL_OPENED", label: "Email opened" },
];

const leadStatusLabels: Record<string, string> = {
  "-3": "Skipped",
  "-2": "Unsubscribed",
  "-1": "Bounced",
  "1": "Active",
  "2": "Paused",
  "3": "Completed",
};

type ActionResult = {
  title: string;
  message: string;
  showVerificationArchiveActions?: boolean;
};

type VerificationState = "good" | "risky" | "bad";
type VerificationResult = {
  email: string;
  state: VerificationState;
  raw: unknown;
};

const CAMPAIGN_ID_STORAGE_KEY = "campaign-leads:selected-campaign-id";
const CAMPAIGN_NAME_STORAGE_KEY = "campaign-leads:selected-campaign-name";
const LEAD_STATUS_STORAGE_KEY = "campaign-leads:lead-status-filter";

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

function formatColumnName(key: string) {
  return key.replaceAll("_", " ");
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return JSON.stringify(value);
}

function formatCellValue(column: string, value: unknown) {
  if (column === "status" && value !== null && value !== undefined) {
    return leadStatusLabels[String(value)] ?? `Status ${String(value)}`;
  }

  return formatValue(value);
}

function readStringField(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const field = record[key];

    if (typeof field === "string" && field.trim()) {
      return field.trim();
    }
  }

  return "";
}

function classifyVerificationResult(value: unknown): VerificationState {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const quality =
      typeof record.quality === "string" ? record.quality.toLowerCase() : "";
    const result =
      typeof record.result === "string" ? record.result.toLowerCase() : "";
    const resultCode =
      typeof record.resultcode === "number"
        ? record.resultcode
        : typeof record.resultcode === "string"
          ? Number(record.resultcode)
          : null;

    if (quality === "good" || result === "ok" || resultCode === 1) {
      return "good";
    }

    if (
      quality === "bad" ||
      result === "disposable" ||
      result === "invalid" ||
      resultCode === 5 ||
      resultCode === 6
    ) {
      return "bad";
    }

    if (
      quality === "risky" ||
      result === "catch_all" ||
      result === "unknown" ||
      result === "error" ||
      resultCode === 2 ||
      resultCode === 3 ||
      resultCode === 4
    ) {
      return "risky";
    }
  }

  const status = readStringField(value, [
    "status",
    "result",
    "state",
    "verdict",
    "deliverability",
    "email_status",
  ]).toLowerCase();
  const reason = readStringField(value, [
    "reason",
    "sub_status",
    "subStatus",
    "message",
  ]).toLowerCase();
  const combined = `${status} ${reason}`;

  if (
    /\b(risky|risk|catch[-_\s]?all|accept[-_\s]?all|unknown|role|timeout)\b/.test(
      combined,
    )
  ) {
    return "risky";
  }

  if (
    /\b(bad|invalid|undeliverable|not[-_\s]?deliverable|bounce|bounced|disposable|do[-_\s]?not[-_\s]?send)\b/.test(
      combined,
    )
  ) {
    return "bad";
  }

  return "good";
}

function extractVerificationEmail(value: unknown, fallback: string) {
  return (
    readStringField(value, ["email", "input", "address", "mail"]) ||
    fallback
  ).toLowerCase();
}

function verificationRowClass(state?: VerificationState) {
  if (state === "good") {
    return "bg-green-50 hover:bg-green-100";
  }

  if (state === "risky") {
    return "bg-orange-50 hover:bg-orange-100";
  }

  if (state === "bad") {
    return "bg-red-50 hover:bg-red-100";
  }

  return "";
}

function campaignLabel(campaign: InstantlyCampaign) {
  return campaign.name || campaign.id;
}

export default function CampaignLeads() {
  const [campaigns, setCampaigns] = useState<InstantlyCampaign[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedCampaignName, setSelectedCampaignName] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] =
    useState<LeadStatusFilter>("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [draftLeadSearch, setDraftLeadSearch] = useState("");
  const [leads, setLeads] = useState<InstantlyLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isCampaignLoading, setIsCampaignLoading] = useState(true);
  const [isLeadLoading, setIsLeadLoading] = useState(false);
  const [isLoadingAllLeads, setIsLoadingAllLeads] = useState(false);
  const [isMovingToOldLeads, setIsMovingToOldLeads] = useState(false);
  const [isVerifyingEmails, setIsVerifyingEmails] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [hasRestoredPreferences, setHasRestoredPreferences] = useState(false);
  const [verificationResults, setVerificationResults] = useState<
    Record<string, VerificationResult>
  >({});

  const selectedCampaign = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === selectedCampaignId);
  }, [campaigns, selectedCampaignId]);
  const selectedCampaignDisplayName =
    selectedCampaign ? campaignLabel(selectedCampaign) : selectedCampaignName;
  const selectedLeadStatusLabel =
    leadStatusFilters.find((filter) => filter.value === leadStatusFilter)
      ?.label ?? "Lead status";

  const loadedLeadIds = useMemo(() => {
    return leads
      .map((lead, index) => String(lead.id ?? index))
      .filter(Boolean);
  }, [leads]);

  const allLoadedSelected =
    loadedLeadIds.length > 0 &&
    loadedLeadIds.every((id) => selectedLeadIds.has(id));
  const selectedLoadedCount = loadedLeadIds.filter((id) =>
    selectedLeadIds.has(id),
  ).length;
  const selectedLeads = useMemo(() => {
    return leads.filter((lead, index) =>
      selectedLeadIds.has(String(lead.id ?? index)),
    );
  }, [leads, selectedLeadIds]);
  const selectedEmails = useMemo(() => {
    return selectedLeads
      .map((lead) => (typeof lead.email === "string" ? lead.email : ""))
      .filter(Boolean);
  }, [selectedLeads]);
  const badVerifiedLeads = useMemo(() => {
    return leads.filter((lead) => {
      const email = typeof lead.email === "string" ? lead.email.toLowerCase() : "";
      return email && verificationResults[email]?.state === "bad";
    });
  }, [leads, verificationResults]);
  const riskyVerifiedLeads = useMemo(() => {
    return leads.filter((lead) => {
      const email = typeof lead.email === "string" ? lead.email.toLowerCase() : "";
      return email && verificationResults[email]?.state === "risky";
    });
  }, [leads, verificationResults]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    const preferred = [
      "email",
      "status",
      "first_name",
      "last_name",
      "company_name",
      "job_title",
      "phone",
      "website",
      "linkedin_url",
      "lt_interest_status",
      "campaign",
      "list_id",
      "timestamp_created",
      "timestamp_updated",
    ];

    for (const key of preferred) {
      if (leads.some((lead) => key in lead)) {
        keys.add(key);
      }
    }

    for (const lead of leads) {
      for (const key of Object.keys(lead).sort()) {
        keys.add(key);
      }
    }

    return Array.from(keys);
  }, [leads]);

  const loadCampaigns = useCallback(async (search: string) => {
    setIsCampaignLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "50" });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await localFetch<InstantlyPaginated<InstantlyCampaign>>(
        `/api/instantly/campaigns?${params.toString()}`,
      );

      setCampaigns(data.items);
      setSelectedCampaignId((current) => {
        if (!hasRestoredPreferences) {
          return current;
        }

        if (current) {
          return current;
        }

        const firstCampaign = data.items[0];

        if (firstCampaign) {
          setSelectedCampaignName(campaignLabel(firstCampaign));
        }

        return firstCampaign?.id || "";
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load campaigns",
      );
    } finally {
      setIsCampaignLoading(false);
    }
  }, [hasRestoredPreferences]);

  const fetchLeadPage = useCallback(
    (cursor?: string | null) => {
      return localFetch<InstantlyPaginated<InstantlyLead>>(
        "/api/instantly/leads",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign: selectedCampaignId,
            filter: leadStatusFilter === "all" ? undefined : leadStatusFilter,
            search: leadSearch,
            ...(cursor ? { starting_after: cursor } : {}),
          }),
        },
      );
    },
    [leadSearch, leadStatusFilter, selectedCampaignId],
  );

  const loadLeads = useCallback(
    async (mode: LoadMode = "replace", cursor?: string | null) => {
      if (!hasRestoredPreferences) {
        return;
      }

      if (!selectedCampaignId) {
        setLeads([]);
        setNextCursor(null);
        return;
      }

      setIsLeadLoading(true);
      setError("");

      try {
        const data = await fetchLeadPage(mode === "append" ? cursor : null);

        setLeads((current) =>
          mode === "append" ? [...current, ...data.items] : data.items,
        );
        if (mode === "replace") {
          setSelectedLeadIds(new Set());
        }
        setNextCursor(data.next_starting_after ?? null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load leads",
        );
      } finally {
        setIsLeadLoading(false);
      }
    },
    [fetchLeadPage, hasRestoredPreferences, selectedCampaignId],
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      const storedCampaignId =
        window.localStorage.getItem(CAMPAIGN_ID_STORAGE_KEY) ?? "";
      const storedCampaignName =
        window.localStorage.getItem(CAMPAIGN_NAME_STORAGE_KEY) ?? "";
      const storedLeadStatus =
        window.localStorage.getItem(LEAD_STATUS_STORAGE_KEY) ?? "";

      setSelectedCampaignId(storedCampaignId);
      setSelectedCampaignName(storedCampaignName);
      setLeadStatusFilter(
        leadStatusFilters.some((filter) => filter.value === storedLeadStatus)
          ? (storedLeadStatus as LeadStatusFilter)
          : "all",
      );
      setHasRestoredPreferences(true);
    });
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadCampaigns(""));
  }, [loadCampaigns]);

  useEffect(() => {
    if (!hasRestoredPreferences) {
      return;
    }

    window.localStorage.setItem(CAMPAIGN_ID_STORAGE_KEY, selectedCampaignId);
  }, [hasRestoredPreferences, selectedCampaignId]);

  useEffect(() => {
    if (!hasRestoredPreferences) {
      return;
    }

    if (selectedCampaignDisplayName) {
      window.localStorage.setItem(
        CAMPAIGN_NAME_STORAGE_KEY,
        selectedCampaignDisplayName,
      );
    }
  }, [hasRestoredPreferences, selectedCampaignDisplayName]);

  useEffect(() => {
    if (!hasRestoredPreferences) {
      return;
    }

    window.localStorage.setItem(LEAD_STATUS_STORAGE_KEY, leadStatusFilter);
  }, [hasRestoredPreferences, leadStatusFilter]);

  useEffect(() => {
    void Promise.resolve().then(() => loadLeads("replace"));
  }, [loadLeads]);

  function submitCampaignSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCampaigns(campaignSearch);
  }

  function submitLeadSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadSearch(draftLeadSearch);
  }

  function toggleLeadSelection(id: string, checked: boolean) {
    setSelectedLeadIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function toggleAllLoaded(checked: boolean) {
    setSelectedLeadIds((current) => {
      const next = new Set(current);

      for (const id of loadedLeadIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return next;
    });
  }

  async function loadAllLeads() {
    if (!selectedCampaignId || !nextCursor) {
      return;
    }

    setIsLoadingAllLeads(true);
    setError("");

    try {
      const allNewLeads: InstantlyLead[] = [];
      let cursor: string | null | undefined = nextCursor;

      while (cursor) {
        const data = await fetchLeadPage(cursor);
        allNewLeads.push(...data.items);
        cursor = data.next_starting_after ?? null;
      }

      setLeads((current) => [...current, ...allNewLeads]);
      setNextCursor(null);
      setActionResult({
        title: "All leads loaded",
        message: `${allNewLeads.length} additional leads loaded for the active filters.`,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load all leads",
      );
    } finally {
      setIsLoadingAllLeads(false);
    }
  }

  async function moveLeadsToOldLeads(
    leadsToMove: InstantlyLead[],
    successTitle = "Moved to old leads",
  ) {
    if (!selectedCampaignId || leadsToMove.length === 0) {
      return;
    }

    setIsMovingToOldLeads(true);
    setError("");
    setActionResult(null);

    try {
      const result = await localFetch<{
        saved: number;
        deleted: number;
        deletedIds: string[];
      }>("/api/instantly/leads/actions/move-to-old-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: selectedCampaignId,
          leadIds: leadsToMove.map((lead) => lead.id),
        }),
      });
      const deleted = new Set(result.deletedIds);

      setLeads((current) => current.filter((lead) => !deleted.has(lead.id)));
      setSelectedLeadIds(new Set());
      setVerificationResults((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([email]) => {
            return !leadsToMove.some(
              (lead) =>
                typeof lead.email === "string" &&
                lead.email.toLowerCase() === email,
            );
          }),
        ),
      );
      setActionResult({
        title: successTitle,
        message: `${result.saved} saved to old leads DB and ${result.deleted} deleted from Instantly.`,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to move leads",
      );
    } finally {
      setIsMovingToOldLeads(false);
    }
  }

  async function moveSelectedToOldLeads() {
    await moveLeadsToOldLeads(selectedLeads);
  }

  async function verifySelectedEmails() {
    if (selectedEmails.length === 0) {
      setError("Select leads with email addresses before verifying.");
      return;
    }

    setIsVerifyingEmails(true);
    setError("");
    setActionResult(null);

    try {
      const result = await localFetch<{ emails: string[]; items: unknown[] }>(
        "/api/instantly/leads/actions/verify-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: selectedEmails }),
        },
      );
      const nextVerificationResults = Object.fromEntries(
        result.emails.map((email, index) => {
          const item = result.items[index] ?? null;
          const resultEmail = extractVerificationEmail(item, email);

          return [
            resultEmail,
            {
              email: resultEmail,
              state: classifyVerificationResult(item),
              raw: item,
            } satisfies VerificationResult,
          ];
        }),
      );

      setVerificationResults((current) => ({
        ...current,
        ...nextVerificationResults,
      }));
      setActionResult({
        title: "Verification finished",
        message: `${result.emails.length} emails sent to Apify. ${result.items.length} result rows returned.`,
        showVerificationArchiveActions: true,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify emails",
      );
    } finally {
      setIsVerifyingEmails(false);
    }
  }

  return (
    <DashboardShell>
      <SiteHeader
        title="Campaign Leads"
        description={
          selectedCampaignDisplayName
            ? `${leads.length} leads loaded from ${selectedCampaignDisplayName}`
            : "Select a campaign to load Instantly leads"
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadLeads("replace")}
            disabled={!selectedCampaignId || isLeadLoading}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
        }
      />

      <div className="@container/main flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>Campaign source</CardTitle>
                  <CardDescription>
                    Leads are loaded directly from Instantly in pages of 50.
                  </CardDescription>
                </div>
                <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
                  <ChevronsUpDownIcon data-icon="inline-start" />
                  {isFiltersOpen ? "Hide" : "Show"}
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
              <form onSubmit={submitCampaignSearch}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="campaign-search">
                      Search campaigns
                    </FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="campaign-search"
                        value={campaignSearch}
                        onChange={(event) =>
                          setCampaignSearch(event.target.value)
                        }
                        placeholder="Campaign name"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isCampaignLoading}
                      >
                        <SearchIcon data-icon="inline-start" />
                        Search
                      </Button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Campaign</FieldLabel>
                    <Select
                      value={selectedCampaignId}
                      onValueChange={(value) => {
                        if (value) {
                          const campaign = campaigns.find(
                            (item) => item.id === value,
                          );
                          setSelectedCampaignId(value);
                          setSelectedCampaignName(
                            campaign ? campaignLabel(campaign) : "",
                          );
                          setLeadSearch("");
                          setDraftLeadSearch("");
                          setSelectedLeadIds(new Set());
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <span className="truncate text-left">
                          {selectedCampaignDisplayName || "Select campaign"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {campaigns.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaignLabel(campaign)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </form>

              <form onSubmit={submitLeadSearch}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Lead status</FieldLabel>
                    <Select
                      value={leadStatusFilter}
                      onValueChange={(value) => {
                        if (value) {
                          setLeadStatusFilter(value as LeadStatusFilter);
                          setSelectedLeadIds(new Set());
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <span className="truncate text-left">
                          {selectedLeadStatusLabel}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {leadStatusFilters.map((filter) => (
                            <SelectItem key={filter.value} value={filter.value}>
                              {filter.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lead-search">Search leads</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="lead-search"
                        value={draftLeadSearch}
                        onChange={(event) =>
                          setDraftLeadSearch(event.target.value)
                        }
                        placeholder="First name, last name, or email"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!selectedCampaignId || isLeadLoading}
                      >
                        <SearchIcon data-icon="inline-start" />
                        Search
                      </Button>
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaign ? (
                      <Badge variant="secondary">
                        Status {selectedCampaign.status}
                      </Badge>
                    ) : null}
                    <Badge>{selectedLeadStatusLabel}</Badge>
                    <Badge variant="outline">{columns.length} fields</Badge>
                    <Badge variant="outline">
                      {selectedLoadedCount} selected
                    </Badge>
                  </div>
                </FieldGroup>
              </form>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Instantly request failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {actionResult ? (
          <Alert>
            <AlertTitle>{actionResult.title}</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>{actionResult.message}</p>
                {actionResult.showVerificationArchiveActions ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        moveLeadsToOldLeads(
                          badVerifiedLeads,
                          "Archived bad emails",
                        )
                      }
                      disabled={
                        badVerifiedLeads.length === 0 || isMovingToOldLeads
                      }
                    >
                      <ArchiveIcon data-icon="inline-start" />
                      Archive bad emails
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        moveLeadsToOldLeads(
                          [...badVerifiedLeads, ...riskyVerifiedLeads],
                          "Archived bad and risky emails",
                        )
                      }
                      disabled={
                        badVerifiedLeads.length + riskyVerifiedLeads.length ===
                          0 || isMovingToOldLeads
                      }
                    >
                      <ArchiveIcon data-icon="inline-start" />
                      Archive bad and risky emails
                    </Button>
                  </div>
                ) : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="min-h-0 flex-1">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Lead data</CardTitle>
                <CardDescription>
                  All fields returned by Instantly are rendered, including
                  campaign-specific objects.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={verifySelectedEmails}
                  disabled={selectedEmails.length === 0 || isVerifyingEmails}
                >
                  <ShieldCheckIcon data-icon="inline-start" />
                  {isVerifyingEmails ? "Verifying" : "Verify email"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={moveSelectedToOldLeads}
                  disabled={selectedLeads.length === 0 || isMovingToOldLeads}
                >
                  <ArchiveIcon data-icon="inline-start" />
                  {isMovingToOldLeads ? "Moving" : "Move to old leads"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0">
            <div className="h-[calc(100vh-var(--header-height)-300px)] min-h-[360px] overflow-auto rounded-lg border">
              <Table className="min-w-[1400px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-40 w-10 bg-background px-3 shadow-sm">
                      <Checkbox
                        checked={allLoadedSelected}
                        onCheckedChange={(checked) =>
                          toggleAllLoaded(Boolean(checked))
                        }
                        aria-label="Select all loaded leads"
                        disabled={leads.length === 0}
                      />
                    </TableHead>
                    {columns.length ? (
                      columns.map((column) => (
                        <TableHead
                          key={column}
                          className="sticky top-0 z-30 bg-background px-3 capitalize shadow-sm"
                        >
                          {formatColumnName(column)}
                        </TableHead>
                      ))
                    ) : (
                      <TableHead>Leads</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLeadLoading && leads.length === 0 ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={Math.max(columns.length + 1, 2)}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : leads.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(columns.length + 1, 2)}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {selectedCampaignId
                          ? "No leads returned for this campaign."
                          : "Select a campaign to load leads."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead, index) => {
                      const rowId = String(lead.id ?? index);
                      const email =
                        typeof lead.email === "string"
                          ? lead.email.toLowerCase()
                          : "";
                      const verificationState =
                        verificationResults[email]?.state;

                      return (
                        <TableRow
                          key={rowId}
                          className={`align-top ${verificationRowClass(
                            verificationState,
                          )}`}
                        >
                          <TableCell className="w-10 px-3">
                            <Checkbox
                              checked={selectedLeadIds.has(rowId)}
                              onCheckedChange={(checked) =>
                                toggleLeadSelection(rowId, Boolean(checked))
                              }
                              aria-label={`Select lead ${rowId}`}
                            />
                          </TableCell>
                          {columns.map((column) => (
                            <TableCell
                              key={`${rowId}-${column}`}
                              className="max-w-[320px] px-3 whitespace-normal"
                            >
                              <span className="line-clamp-6 break-words font-mono text-xs">
                                {formatCellValue(column, lead[column])}
                              </span>
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <PaginationActions
              hasMore={Boolean(nextCursor)}
              isLoading={isLeadLoading}
              isLoadingAll={isLoadingAllLeads}
              onLoadMore={() => nextCursor && loadLeads("append", nextCursor)}
              onLoadAll={loadAllLeads}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
