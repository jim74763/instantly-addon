Local Instantly Unibox client built with Next.js App Router.

The app talks to the official Instantly API v2 from server-side route handlers, so the API key never ships to the browser bundle.

## Environment

Create `.env.local`:

```bash
INSTANTLY_API_KEY=your_instantly_v2_api_key
DATABASE_URI=your_postgres_connection_string
```

Optional:

```bash
INSTANTLY_API_BASE_URL=https://api.instantly.ai/api/v2
```

The deployed application relies on Cloudflare Access for authentication. Keep
the Worker behind an Access policy because the application does not implement a
second authentication layer.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy to Cloudflare Workers

The app is bundled for Workers with OpenNext and deployed by Wrangler. Authenticate
Wrangler, add the production secrets, then deploy:

```bash
pnpm exec wrangler login
pnpm exec wrangler secret put INSTANTLY_API_KEY
pnpm exec wrangler secret put DATABASE_URI
pnpm deploy
```

Use `pnpm build` to produce `.open-next/worker.js` without deploying. The
`pnpm deploy` command always runs that Cloudflare build before deployment.

Do not add secret values to `wrangler.jsonc`: Wrangler secrets keep them out of
the repository and Worker JSON responses. The PostgreSQL connection must be
reachable from Cloudflare Workers; the application uses Neon's HTTP driver for
this serverless runtime.

Required Instantly API scopes depend on the controls you use:

- `emails:read` for listing and opening Unibox emails
- `emails:create` for replying
- `emails:update` for marking messages read or unread
- `accounts:read` for account filters
- `campaigns:read` for campaign filters

The email list endpoint is rate-limited by Instantly to 20 requests per minute, so the app uses manual refresh and cursor paging instead of polling.

## Local API routes

- `GET /api/instantly/emails`
- `GET /api/instantly/emails/:id`
- `PATCH /api/instantly/emails/:id`
- `POST /api/instantly/emails/reply`
- `POST /api/instantly/emails/threads/:threadId/mark-as-read`
- `POST /api/instantly/meta`

All routes proxy to `https://api.instantly.ai/api/v2` using `Authorization: Bearer $INSTANTLY_API_KEY`.
