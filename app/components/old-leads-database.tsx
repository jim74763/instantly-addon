"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell, SiteHeader } from "@/components/dashboard-shell";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PaginationActions } from "@/components/pagination-actions";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDownAZIcon, ArrowUpAZIcon, SaveIcon, SearchIcon } from "lucide-react";
import {
  OLD_LEAD_COLUMNS,
  type OldLead,
  type OldLeadColumn,
} from "@/lib/leads-schema";

type LeadsResponse = {
  columns: OldLeadColumn[];
  items: OldLead[];
  nextOffset: number | null;
};

type LoadMode = "replace" | "append";
const PAGE_SIZE = 50;

const primaryColumns: OldLeadColumn[] = [
  "email",
  "first_name",
  "last_name",
  "company_name",
  "job_title",
  "website",
  "linkedin_url",
  "phone",
  "location",
  "data",
];

const editableColumns: OldLeadColumn[] = [
  "email",
  "first_name",
  "last_name",
  "company_name",
  "job_title",
  "website",
  "linkedin_url",
  "phone",
  "location",
  "personalization",
  "campaign",
  "list_id",
  "assigned_to",
  "pl_value_lead",
  "data",
];

const fieldLabels: Partial<Record<OldLeadColumn, string>> = {
  email: "Email",
  first_name: "First name",
  last_name: "Last name",
  company_name: "Company",
  job_title: "Job title",
  website: "Website",
  linkedin_url: "LinkedIn",
  phone: "Phone",
  location: "Location",
  personalization: "Personalization",
  campaign: "Campaign ID",
  list_id: "List ID",
  assigned_to: "Assigned to",
  pl_value_lead: "Lead value",
  data: "Custom data JSON",
};

const emptyForm = editableColumns.reduce(
  (accumulator, column) => ({ ...accumulator, [column]: "" }),
  {} as Record<OldLeadColumn, string>,
);

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

function prettifyColumn(column: string) {
  return column.replaceAll("_", " ");
}

function cellValue(value: OldLead[OldLeadColumn]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export default function OldLeadsDatabase() {
  const [leads, setLeads] = useState<OldLead[]>([]);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [sort, setSort] = useState<OldLeadColumn>("timestamp_updated");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [form, setForm] = useState<Record<OldLeadColumn, string>>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleColumns = useMemo(() => {
    return primaryColumns.filter((column) => OLD_LEAD_COLUMNS.includes(column));
  }, []);

  const loadLeads = useCallback(async (
    mode: LoadMode = "replace",
    offset = 0,
  ) => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        sort,
        direction,
        limit: String(PAGE_SIZE),
        offset: String(mode === "append" ? offset : 0),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await localFetch<LeadsResponse>(
        `/api/leads?${params.toString()}`,
      );
      setLeads((current) =>
        mode === "append" ? [...current, ...data.items] : data.items,
      );
      setNextOffset(data.nextOffset);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load leads",
      );
    } finally {
      setIsLoading(false);
    }
  }, [direction, search, sort]);

  useEffect(() => {
    void Promise.resolve().then(() => loadLeads());
  }, [loadLeads]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draftSearch);
  }

  async function loadAllLeads() {
    if (nextOffset === null) {
      return;
    }

    setIsLoadingAll(true);
    setError("");

    try {
      let offset: number | null = nextOffset;
      const allNewLeads: OldLead[] = [];

      while (offset !== null) {
        const pageOffset: number = offset;
        const params = new URLSearchParams({
          sort,
          direction,
          limit: String(PAGE_SIZE),
          offset: String(pageOffset),
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const data = await localFetch<LeadsResponse>(
          `/api/leads?${params.toString()}`,
        );

        allNewLeads.push(...data.items);
        offset = data.nextOffset;
      }

      setLeads((current) => [...current, ...allNewLeads]);
      setNextOffset(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load all leads",
      );
    } finally {
      setIsLoadingAll(false);
    }
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = Object.fromEntries(
        editableColumns
          .map((column) => [column, form[column].trim()])
          .filter(([, value]) => value),
      );

      await localFetch<{ lead: OldLead }>("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setForm(emptyForm);
      setNotice("Lead saved to old leads DB.");
      await loadLeads();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save lead",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardShell>
      <SiteHeader title="Old Leads DB" />
      <div className="@container/main grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="border-b bg-sidebar xl:border-r xl:border-b-0">
          <ScrollArea className="h-[46vh] xl:h-[calc(100vh-var(--header-height))]">
            <form onSubmit={saveLead} className="p-4 md:p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add or update lead</CardTitle>
                  <CardDescription>
                    Use Instantly-style snake_case fields. Put non-standard
                    columns in data as JSON.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      {editableColumns.map((column) => (
                        <Field key={column}>
                          <FieldLabel htmlFor={`lead-${column}`}>
                            {fieldLabels[column] ?? prettifyColumn(column)}
                          </FieldLabel>
                          {column === "data" || column === "personalization" ? (
                            <Textarea
                              id={`lead-${column}`}
                              value={form[column]}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  [column]: event.target.value,
                                }))
                              }
                              rows={column === "data" ? 5 : 3}
                              placeholder={
                                column === "data"
                                  ? "{\"source\":\"old-import\",\"score\":72}"
                                  : ""
                              }
                              className="min-h-24 resize-y"
                            />
                          ) : (
                            <Input
                              id={`lead-${column}`}
                              value={form[column]}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  [column]: event.target.value,
                                }))
                              }
                            />
                          )}
                        </Field>
                      ))}
                    </div>

                    {error ? (
                      <Alert variant="destructive">
                        <AlertTitle>Unable to save lead</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    ) : null}

                    {notice ? (
                      <Alert>
                        <AlertTitle>Saved</AlertTitle>
                        <AlertDescription>{notice}</AlertDescription>
                      </Alert>
                    ) : null}

                    <Button type="submit" disabled={isSaving} className="w-full">
                      <SaveIcon data-icon="inline-start" />
                      {isSaving ? "Saving" : "Save lead"}
                    </Button>
                  </FieldGroup>
                </CardContent>
              </Card>
            </form>
          </ScrollArea>
        </aside>

        <section className="min-w-0 bg-background">
          <div className="border-b p-4 md:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <form onSubmit={submitSearch} className="flex min-w-0 gap-2">
                <Input
                  value={draftSearch}
                  onChange={(event) => setDraftSearch(event.target.value)}
                  placeholder="Search email, name, company, phone, location, data"
                  className="min-w-0 flex-1"
                />
                <Button type="submit" size="sm">
                  <SearchIcon data-icon="inline-start" />
                  Search
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    if (value) {
                      setSort(value as OldLeadColumn);
                    }
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Sort column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OLD_LEAD_COLUMNS.map((column) => (
                        <SelectItem key={column} value={column}>
                          Sort by {prettifyColumn(column)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() =>
                    setDirection((current) =>
                      current === "asc" ? "desc" : "asc",
                    )
                  }
                  variant="outline"
                >
                  {direction === "asc" ? (
                    <ArrowUpAZIcon data-icon="inline-start" />
                  ) : (
                    <ArrowDownAZIcon data-icon="inline-start" />
                  )}
                  {direction === "asc" ? "Ascending" : "Descending"}
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-var(--header-height)-81px)]">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((column) => (
                    <TableHead key={column} className="px-4">
                      {prettifyColumn(column)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={visibleColumns.length}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No old leads saved yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={String(lead.id)} className="align-top">
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={`${lead.id}-${column}`}
                          className="max-w-[260px] px-4 whitespace-normal"
                        >
                          <span className="line-clamp-3 break-words">
                            {cellValue(lead[column])}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="px-4 pb-4 md:px-6">
            <PaginationActions
              hasMore={nextOffset !== null}
              isLoading={isLoading}
              isLoadingAll={isLoadingAll}
              onLoadMore={() =>
                nextOffset !== null && loadLeads("append", nextOffset)
              }
              onLoadAll={loadAllLeads}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
