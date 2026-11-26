-- Sign in with Telegram. Accounts made through Telegram have login 'tg:<id>' and an empty password_hash, so password sign-in never matches them.
ALTER TABLE accounts ADD COLUMN tg_user TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX accounts_tg_user ON accounts(tg_user);
--> statement-breakpoint
-- One row per sign-in attempt. The bot sees only `code`; the browser that started it holds the secret behind `secret_hash`.
CREATE TABLE tg_logins (code TEXT PRIMARY KEY, secret_hash TEXT NOT NULL UNIQUE, lang TEXT NOT NULL, tg_user TEXT, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX tg_logins_expires ON tg_logins(expires);
