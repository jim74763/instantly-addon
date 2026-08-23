Local Instantly Unibox client built with Next.js App Router.

The app talks to the official Instantly API v2 from server-side route handlers, so the API key never ships to the browser bundle.

## Environment

Create `.env.local`:

```bash
INSTANTLY_API_KEY=your_instantly_v2_api_key
```

Optional:

```bash
INSTANTLY_API_BASE_URL=https://api.instantly.ai/api/v2
```

Dashboard auth is required unless explicitly disabled for local development:

```bash
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=change-me
AUTH_SECRET=at-least-32-characters
DASHBOARD_AUTH_DISABLED=true
```

`DASHBOARD_AUTH_DISABLED=true` is ignored when `NODE_ENV=production` so the public deployment remains protected.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
