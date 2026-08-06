import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "unibox_session";

export type DashboardSession = {
  isLoggedIn?: boolean;
  username?: string;
};

export function getAuthConfig() {
  return {
    username: process.env.DASHBOARD_USERNAME ?? "",
    password: process.env.DASHBOARD_PASSWORD ?? "",
    secret: process.env.AUTH_SECRET ?? "",
  };
}

export function getAuthConfigError() {
  const { username, password, secret } = getAuthConfig();

  if (!username || !password || !secret) {
    return "Set DASHBOARD_USERNAME, DASHBOARD_PASSWORD, and AUTH_SECRET.";
  }

  if (secret.length < 32) {
    return "AUTH_SECRET must be at least 32 characters for iron-session.";
  }

  return null;
}

export function getSessionOptions(): SessionOptions {
  const configError = getAuthConfigError();
  const { secret } = getAuthConfig();

  if (configError) {
    throw new Error(configError);
  }

  return {
    cookieName: AUTH_COOKIE_NAME,
    password: secret,
    ttl: 60 * 60 * 12,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<DashboardSession>(await cookies(), getSessionOptions());
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

export function verifyCredentials(username: string, password: string) {
  const config = getAuthConfig();

  return (
    !getAuthConfigError() &&
    constantTimeEqual(username, config.username) &&
    constantTimeEqual(password, config.password)
  );
}

export function isAuthenticated(session: IronSession<DashboardSession>) {
  const { username } = getAuthConfig();

  return session.isLoggedIn === true && session.username === username;
}

export async function requireDashboardAuth() {
  const configError = getAuthConfigError();

  if (configError) {
    return Response.json(
      { error: "Authentication is unavailable" },
      { status: 503 },
    );
  }

  const session = await getSession();

  if (!isAuthenticated(session)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
