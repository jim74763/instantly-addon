import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession, isDashboardAuthDisabled } from "@/lib/auth/session";

function isSameOrigin(headersList: Headers) {
  const origin = headersList.get("origin");

  if (!origin) {
    return true;
  }

  const host = headersList.get("host");
  const protocol =
    headersList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (!host) {
    return false;
  }

  return origin === `${protocol}://${host}`;
}

export async function POST() {
  if (!isSameOrigin(await headers())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isDashboardAuthDisabled()) {
    redirect("/");
  }

  const session = await getSession();
  session.destroy();

  redirect("/login");
}
