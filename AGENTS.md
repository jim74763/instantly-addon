<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Auth and public deployment

This dashboard relies on Cloudflare Access as its authentication layer. Do not
add application-level login, session, or authorization checks unless the auth
strategy is intentionally changed again.

- Keep the deployed Worker behind a Cloudflare Access policy.
- Do not expose secrets, credentials, or provider API keys to Client Components
  or JSON responses.
