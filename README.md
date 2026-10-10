# Unibox

A self-hosted companion to Instantly for handling cold-email replies, managing leads, and testing delivery from one dashboard.

Unibox is for people who don't want to upgrade their Instantly plan just to reply to emails in Unibox, or keep signing into separate email accounts to respond. It uses Instantly's official API to bring conversations and replies into one inbox, with extra tools for lead cleanup, email verification, and placement testing.

This project was fully coded by AI. It works and has been tested.

## What you can do

- **Reply from one inbox.** Read conversations across your connected Instantly accounts and send replies through the API. Handle responses in one place without opening each mailbox separately or paying extra just for Instantly's built-in Unibox, provided your workspace has the required API access.
- **Archive leads and free up contact slots.** Select campaign leads and move them to your own PostgreSQL database. The app automatically saves each selected lead before removing it from Instantly, preserving its contact details, campaign information, engagement counts, and custom data. Keep old leads without using up your Instantly uploaded-contact allowance; you choose when to archive them.
- **Keep your own lead database.** The Old Leads DB lets you view, add, and update stored leads independently of Instantly. Your archive stays available after those leads have been removed from the platform.
- **Verify leads and clean up bad addresses.** Run email verification on selected campaign leads through Apify. After verification, use the archive actions to move bad addresses, or bad and risky addresses together, into PostgreSQL and remove them from Instantly. This gives you a separate verification and cleanup workflow without spending Instantly verification credits.
- **Send placement tests for MailReach.** Choose an Instantly sending account, paste your test recipient addresses from [MailReach](https://mailreach.co), and send a separate plain-text message to each address. Add an optional footer ID to identify the test. The app spaces out sends to respect Instantly's test-email rate limit; check placement results in your testing service.
- **Check sending accounts and send test emails.** See account connection status, warmup information, and sending limits together. Send a custom test email from a chosen account to check delivery or troubleshoot a mailbox before using it in a campaign.

## Requirements and costs

You need an Instantly API key with access to the endpoints used by the app.

Hosting and PostgreSQL may have their own costs. Email verification requires an Apify account and is billed through Apify; placement testing services are separate too.

## Local setup

Use Node.js and npm/pnpm, an Instantly API v2 key, and a Neon PostgreSQL database.

```bash
pnpm install
cp .env.example .env
```

Set `INSTANTLY_API_KEY` and `DATABASE_URI` in `.env`. Email verification also requires `APIFY_API_TOKEN`; other optional settings are listed in [.env.example](.env.example).

Apply the database migrations and start the app:

```bash
pnpm db:migrate
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

## Deployment

The app uses OpenNext to run on Cloudflare Workers. Update the Worker name in `wrangler.jsonc`, then authenticate and set your production secrets:

```bash
pnpm exec wrangler login
pnpm exec wrangler secret put INSTANTLY_API_KEY
pnpm exec wrangler secret put DATABASE_URI
# Required if you use email verification:
pnpm exec wrangler secret put APIFY_API_TOKEN
pnpm deploy
```

Keep the deployed Worker behind **Cloudflare Access**, including any enabled `workers.dev` and preview URLs. Cloudflare Access provides authentication; the app has no application-level login.

API keys and database credentials stay server-side. Keep secret values out of the repository and `wrangler.jsonc`.

## Development

```bash
pnpm lint     # Run ESLint
pnpm build    # Build for Cloudflare Workers
pnpm preview  # Build and preview locally in the Workers runtime
```
