CREATE TABLE profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('supplier','operator','both')));
--> statement-breakpoint
CREATE TABLE offers (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES profiles(id), data TEXT NOT NULL, visible INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE requests (id TEXT PRIMARY KEY, offer TEXT NOT NULL REFERENCES offers(id), buyer TEXT NOT NULL REFERENCES profiles(id), seller TEXT NOT NULL REFERENCES profiles(id), brief TEXT NOT NULL, snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sent', response TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX requests_buyer ON requests(buyer,created);
--> statement-breakpoint
CREATE INDEX requests_seller ON requests(seller,created);
