"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { RefreshCwIcon, SendIcon } from "lucide-react";
import type { InstantlyAccount, InstantlyPaginated } from "@/lib/instantly";

type SendResult = {
  recipient: string;
  copyId: string;
  subject: string;
  status: string;
  error: string | null;
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

function parseRecipients(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@")),
    ),
  );
}

export default function InboxPlacement() {
  const [accounts, setAccounts] = useState<InstantlyAccount[]>([]);
  const [from, setFrom] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [footerId, setFooterId] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const recipients = useMemo(
    () => parseRecipients(recipientsText),
    [recipientsText],
  );

  async function loadPageData() {
    setIsLoading(true);
    setError("");

    try {
      const accountData = await localFetch<InstantlyPaginated<InstantlyAccount>>(
        "/api/instantly/accounts?limit=100&include_tags=true",
      );

      setAccounts(accountData.items);
      setFrom((current) => current || accountData.items[0]?.email || "");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load inbox placement data",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadPageData());
  }, []);

  async function sendInboxPlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!from) {
      setError("Select a sending account first.");
      return;
    }

    if (!recipients.length) {
      setError("Add at least one recipient email.");
      return;
    }

    setIsSending(true);
    setError("");
    setNotice("");
    setResults([]);

    try {
      const response = await localFetch<{
        sent: number;
        results: SendResult[];
        rateLimit: {
          intervalMs: number;
          retryMs: number;
        };
      }>("/api/inbox-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          recipients,
          footerId: footerId.trim() || undefined,
        }),
      });

      setResults(response.results);
      setNotice(
        `${response.sent} inbox placement emails sent. Sends are spaced to stay under Instantly's test-email rate limit.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send inbox placement emails",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <DashboardShell>
      <SiteHeader
        title="Inbox Placement"
        description="Send separate plain-text placement messages"
        actions={
          <Button
            type="button"
            onClick={loadPageData}
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
            <AlertTitle>Sent</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Send test set</CardTitle>
              <CardDescription>
                Each recipient receives a separate message. Sends are spaced
                out because Instantly allows 10 test emails per minute.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={sendInboxPlacement}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>From</FieldLabel>
                    <Select
                      value={from}
                      onValueChange={(value) => {
                        if (value) {
                          setFrom(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {accounts.map((account) => (
                            <SelectItem key={account.email} value={account.email}>
                              {account.email}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Recipients</FieldLabel>
                    <Textarea
                      value={recipientsText}
                      onChange={(event) => setRecipientsText(event.target.value)}
                      placeholder="one@example.com, two@example.com"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      {recipients.length} valid recipient
                      {recipients.length === 1 ? "" : "s"} detected.
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel>Footer ID</FieldLabel>
                    <Input
                      value={footerId}
                      onChange={(event) => setFooterId(event.target.value)}
                      placeholder="Optional ID"
                    />
                  </Field>

                  <Button type="submit" disabled={isSending || isLoading}>
                    <SendIcon data-icon="inline-start" />
                    {isSending ? "Sending" : "Send placement emails"}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>

        {results.length ? (
          <section className="rounded-lg border bg-card">
            <div className="border-b p-4">
              <h2 className="text-base font-medium">Send results</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={`${result.recipient}-${result.copyId}`}>
                    <TableCell>{result.recipient}</TableCell>
                    <TableCell>{result.copyId}</TableCell>
                    <TableCell>{result.subject}</TableCell>
                    <TableCell>
                      {result.error ? (
                        <Badge variant="destructive">{result.error}</Badge>
                      ) : (
                        <Badge>{result.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ) : null}
      </div>
    </DashboardShell>
  );
}
