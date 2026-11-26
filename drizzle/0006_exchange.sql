ALTER TABLE profiles ADD COLUMN city TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN about TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN telegram TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN logo TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN tg_chat TEXT;
--> statement-breakpoint
-- 1: sample agency that answers demo requests; 2: presenter account whose requests get sample answers.
ALTER TABLE profiles ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES profiles(id), text TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', chosen TEXT, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX jobs_status ON jobs(status,created);
--> statement-breakpoint
CREATE INDEX jobs_owner ON jobs(owner,created);
--> statement-breakpoint
CREATE TABLE bids (id TEXT PRIMARY KEY, job TEXT NOT NULL REFERENCES jobs(id), owner TEXT NOT NULL REFERENCES profiles(id), price INTEGER NOT NULL, currency TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL, notified INTEGER NOT NULL DEFAULT 0, UNIQUE(job,owner));
--> statement-breakpoint
CREATE INDEX bids_owner ON bids(owner,created);
--> statement-breakpoint
CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, bid TEXT NOT NULL REFERENCES bids(id), sender TEXT NOT NULL REFERENCES profiles(id), text TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX messages_bid ON messages(bid,id);
--> statement-breakpoint
CREATE TABLE reviews (id TEXT PRIMARY KEY, target TEXT NOT NULL REFERENCES profiles(id), author TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), text TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX reviews_target ON reviews(target);
--> statement-breakpoint
CREATE TABLE tg_links (code TEXT PRIMARY KEY, profile TEXT NOT NULL REFERENCES profiles(id), expires INTEGER NOT NULL);
