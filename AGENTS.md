<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Auth and public deployment

This dashboard is deployed publicly and must remain private. Keep authentication and authorization in mind for every new page, server action, and API route.

- Dashboard UI routes must stay protected by `proxy.ts`.
- Private API routes must also call `requireDashboardAuth()` from `lib/auth/session.ts`; do not rely on proxy-only protection for APIs.
- Do not expose secrets, credentials, provider API keys, or session data to Client Components or JSON responses.
- Preserve the `iron-session` based single-user auth model unless the auth strategy is intentionally changed.
