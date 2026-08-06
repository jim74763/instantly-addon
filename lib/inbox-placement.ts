import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { inboxPlacementCopies } from "@/lib/db/schema";

export type InboxPlacementCopy = typeof inboxPlacementCopies.$inferSelect;

export const defaultInboxPlacementCopies = [
  {
    id: "coworking-hours",
    subject: "The coworking space",
    body: "Hi, do you know when the coworking space opens again? I wanted to stop by this week and check the schedule before I plan the rest of my day.",
    sort_order: 1,
  },
  {
    id: "monday-meeting",
    subject: "Meeting next Monday",
    body: "Hi, are you available for the meeting next Monday? I can make the morning or early afternoon work if one of those times is better.",
    sort_order: 2,
  },
  {
    id: "quick-confirmation",
    subject: "Quick confirmation",
    body: "Hi, can you confirm whether the notes from our last call are still accurate? I am cleaning up my calendar and want to make sure I have the right details.",
    sort_order: 3,
  },
  {
    id: "lunch-window",
    subject: "Lunch this week",
    body: "Hi, do you have time for lunch later this week? Tuesday or Thursday would work well on my side, but I can adjust if another day is better.",
    sort_order: 4,
  },
  {
    id: "document-check",
    subject: "Document check",
    body: "Hi, could you check if the latest document is the right version? I want to review it today and avoid using an older file by mistake.",
    sort_order: 5,
  },
  {
    id: "office-visit",
    subject: "Office visit",
    body: "Hi, will anyone be at the office on Friday afternoon? I may come by to pick something up and wanted to make sure the timing is okay.",
    sort_order: 6,
  },
  {
    id: "coffee-catchup",
    subject: "Coffee catch-up",
    body: "Hi, are you around for a quick coffee next week? It would be nice to catch up for a few minutes if your calendar is not too full.",
    sort_order: 7,
  },
  {
    id: "schedule-question",
    subject: "Schedule question",
    body: "Hi, do you know if the schedule changed for next week? I saw a note about it earlier and wanted to confirm before I move anything around.",
    sort_order: 8,
  },
  {
    id: "room-available",
    subject: "Room availability",
    body: "Hi, is the small meeting room available tomorrow morning? I need it for a short conversation and can work around existing bookings.",
    sort_order: 9,
  },
  {
    id: "follow-up-note",
    subject: "Follow-up note",
    body: "Hi, just checking if you saw my earlier note. No rush, I wanted to make sure it did not slip by before I close the loop on my side.",
    sort_order: 10,
  },
];

export async function ensureInboxPlacementCopies() {
  const db = getDb();
  const existing = await db.select().from(inboxPlacementCopies).limit(1);

  if (!existing.length) {
    await db
      .insert(inboxPlacementCopies)
      .values(defaultInboxPlacementCopies.map((copy) => ({ ...copy, active: true })))
      .onConflictDoNothing();

    return;
  }

  await Promise.all(
    defaultInboxPlacementCopies.map((copy) =>
      db
        .update(inboxPlacementCopies)
        .set({
          subject: copy.subject,
          body: copy.body,
          sort_order: copy.sort_order,
          active: true,
          timestamp_updated: new Date().toISOString(),
        })
        .where(eq(inboxPlacementCopies.id, copy.id)),
    ),
  );
}

export async function listInboxPlacementCopies() {
  const db = getDb();

  await ensureInboxPlacementCopies();

  return db
    .select()
    .from(inboxPlacementCopies)
    .where(eq(inboxPlacementCopies.active, true))
    .orderBy(asc(inboxPlacementCopies.sort_order));
}
