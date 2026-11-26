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

Deploy using your own Cloudflare project with D1 and R2 bindings. Project identity,
credentials, live database records, and account sessions are not included here.
The existing public website is https://tourmesh-uz-market.violetflea13.chatgpt.site/
