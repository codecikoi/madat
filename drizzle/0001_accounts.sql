CREATE TABLE accounts (user_id TEXT PRIMARY KEY REFERENCES profiles(id), login TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, recovery_hash TEXT, version INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(user_id), version INTEGER NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX sessions_expires ON sessions(expires);
--> statement-breakpoint
CREATE TABLE auth_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX auth_limits_expires ON auth_limits(expires);
