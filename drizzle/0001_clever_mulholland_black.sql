CREATE TABLE "inbox_placement_copies" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"timestamp_created" timestamp DEFAULT now() NOT NULL,
	"timestamp_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbox_placement_copies_order_idx" ON "inbox_placement_copies" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "inbox_placement_copies_active_idx" ON "inbox_placement_copies" USING btree ("active");--> statement-breakpoint
INSERT INTO "inbox_placement_copies" ("id", "subject", "body", "sort_order", "active") VALUES
('coworking-hours', 'The coworking space', 'Hi, do you know when the coworking space opens again? I wanted to stop by this week and check the schedule before I plan the rest of my day.', 1, true),
('monday-meeting', 'Meeting next Monday', 'Hi, are you available for the meeting next Monday? I can make the morning or early afternoon work if one of those times is better.', 2, true),
('quick-confirmation', 'Quick confirmation', 'Hi, can you confirm whether the notes from our last call are still accurate? I am cleaning up my calendar and want to make sure I have the right details.', 3, true),
('lunch-window', 'Lunch this week', 'Hi, do you have time for lunch later this week? Tuesday or Thursday would work well on my side, but I can adjust if another day is better.', 4, true),
('document-check', 'Document check', 'Hi, could you check if the latest document is the right version? I want to review it today and avoid using an older file by mistake.', 5, true),
('office-visit', 'Office visit', 'Hi, will anyone be at the office on Friday afternoon? I may come by to pick something up and wanted to make sure the timing is okay.', 6, true),
('coffee-catchup', 'Coffee catch-up', 'Hi, are you around for a quick coffee next week? It would be nice to catch up for a few minutes if your calendar is not too full.', 7, true),
('schedule-question', 'Schedule question', 'Hi, do you know if the schedule changed for next week? I saw a note about it earlier and wanted to confirm before I move anything around.', 8, true),
('room-available', 'Room availability', 'Hi, is the small meeting room available tomorrow morning? I need it for a short conversation and can work around existing bookings.', 9, true),
('follow-up-note', 'Follow-up note', 'Hi, just checking if you saw my earlier note. No rush, I wanted to make sure it did not slip by before I close the loop on my side.', 10, true);
