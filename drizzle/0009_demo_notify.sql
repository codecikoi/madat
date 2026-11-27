-- Demo bookings tell people in Telegram. `profile` is the agency that booked while signed in (its chat may connect later);
-- `tg_code` is the t.me/<bot>?start=demo_<code> link a guest opens to get the confirmation and reminder in `tg_chat`.
ALTER TABLE demo_slots ADD COLUMN profile TEXT;
--> statement-breakpoint
ALTER TABLE demo_slots ADD COLUMN zone TEXT;
--> statement-breakpoint
ALTER TABLE demo_slots ADD COLUMN lang TEXT;
--> statement-breakpoint
ALTER TABLE demo_slots ADD COLUMN tg_chat TEXT;
--> statement-breakpoint
ALTER TABLE demo_slots ADD COLUMN tg_code TEXT;
--> statement-breakpoint
ALTER TABLE demo_slots ADD COLUMN reminded INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE UNIQUE INDEX demo_slots_tg_code ON demo_slots(tg_code);
