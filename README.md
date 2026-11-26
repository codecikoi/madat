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

```sh
npx wrangler d1 create tourmesh        # put the returned id into wrangler.toml
npx wrangler r2 bucket create tourmesh-photos
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Deploy using your own Cloudflare project with D1 and R2 bindings. Project identity,
credentials, live database records, and account sessions are not included here.
The existing public website is https://tourmesh-uz-market.violetflea13.chatgpt.site/
