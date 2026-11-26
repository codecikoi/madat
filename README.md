# TOURMESH source

This archive contains the website and Cloudflare Worker source, database migrations,
local AI module, font, and visual assets. The public deployment currently runs on
Cloudflare Workers with D1 (`DB`) and R2 (`BUCKET`) bindings through Sites.

## Build

Install Node.js 20 or newer, then run from this directory:

```sh
npm ci
node build-market.mjs
```

The build writes `dist/server/index.js`. `dist/index.html` contains the main UI.
Edit `market-worker.mjs` for server API, `demo-booking.mjs` for calendar booking,
`demo-calendar.mjs` for its UI, `languages.json` for translations, and the SQL files
in `drizzle/` for database migrations. Apply migrations in filename order.

## Run locally

Wrangler emulates the Worker, D1 and R2 on your machine (data lives in `.wrangler/`):

```sh
npm ci
npm run migrate:local   # first run, and after adding a migration
npm run dev             # builds, then serves http://localhost:8787
```

Rebuild after editing any source file: stop `npm run dev` and start it again.
The session cookie is `Secure`; Chrome accepts it on localhost.

## Deploy

Live: https://tourmesh.pages.dev (Cloudflare Pages, advanced mode: the built
worker is uploaded as `pages/dist/_worker.js`). Bindings for production live in
`pages/wrangler.toml`; `wrangler.toml` in the root is for local dev only.

```sh
npx wrangler login
npx wrangler d1 migrations apply DB --remote   # after adding a migration
npm run deploy
```

Offer photos are stored in the R2 bucket `tourmesh-photos`; both `wrangler.toml`
files bind it as `BUCKET`.

## Sign in with Telegram

Telegram is the main way in; login and password sit behind "Другой способ".
It uses the notification bot (`TELEGRAM_BOT_TOKEN`, optional `TELEGRAM_BOT_USERNAME`)
and needs no BotFather setup: the site opens `t.me/<bot>?start=login_<code>`, the bot
asks to confirm, and the page polls until the press arrives (`telegram.mjs`).
The bot's webhook must also receive `callback_query` updates. The first sign-in on the
live site switches that on by itself; `/api/telegram/setup` sets it explicitly.
Telegram cannot reach localhost, so locally the flow stops at "Ждём подтверждения".

Deploy using your own Cloudflare project with D1 and R2 bindings. Project identity,
credentials, live database records, and account sessions are not included here.
The existing public website is https://tourmesh-uz-market.violetflea13.chatgpt.site/
