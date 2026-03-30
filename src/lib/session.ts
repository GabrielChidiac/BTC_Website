import { NextResponse } from "next/server";

export const COOKIE_NAME = "btc-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function cookieOptions() {
  // Only set secure flag when actually served over HTTPS.
  // NEXT_PUBLIC_SITE_URL may be https in .env even during local dev,
  // so check the runtime URL instead of the env var.
  const isSecure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  email: string,
  name?: string | null
): void {
  response.cookies.set(COOKIE_NAME, JSON.stringify({ email, token, ...(name && { name }) }), cookieOptions());
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
}
