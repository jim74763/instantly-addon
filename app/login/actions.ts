"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getAuthConfigError,
  getSession,
  verifyCredentials,
} from "@/lib/auth/session";

export type LoginState = {
  error?: string;
};

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKeys(username: string, headersList: Headers) {
  const normalizedUsername = username.toLowerCase();
  const forwardedFor = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    headersList.get("cf-connecting-ip") ||
    headersList.get("x-real-ip") ||
    forwardedFor ||
    "unknown";

  return [
    `ip:${ip}`,
    `user:${normalizedUsername}`,
    `combo:${ip}:${normalizedUsername}`,
  ];
}

function checkLoginRateLimit(key: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }

  attempt.count += 1;
}

function clearFailedLogins(key: string) {
  loginAttempts.delete(key);
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const configError = getAuthConfigError();

  if (configError) {
    return { error: configError };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const rateLimitKeys = getRateLimitKeys(username, await headers());

  if (rateLimitKeys.some(checkLoginRateLimit)) {
    return { error: "Too many login attempts. Try again later." };
  }

  if (!verifyCredentials(username, password)) {
    rateLimitKeys.forEach(recordFailedLogin);
    return { error: "Invalid username or password." };
  }

  rateLimitKeys.forEach(clearFailedLogins);

  const session = await getSession();
  session.isLoggedIn = true;
  session.username = username;
  await session.save();

  redirect("/");
}
