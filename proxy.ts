import { NextResponse } from "next/server";

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set(
    "Content-Security-Policy",
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}

export function proxy() {
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
