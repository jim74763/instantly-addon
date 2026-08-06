import { NextResponse, type NextRequest } from "next/server";

import {
  getAuthConfigError,
  getSession,
  isAuthenticated,
} from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth/logout"];

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = getAuthConfigError() ? null : await getSession();
  const authenticated = session ? isAuthenticated(session) : false;

  if (pathname === "/login" && authenticated) {
    return addSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (authenticated) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return addSecurityHeaders(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return addSecurityHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
