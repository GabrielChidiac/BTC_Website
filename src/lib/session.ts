import { NextResponse } from "next/server";

export const COOKIE_NAME = "btc-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function cookieOptions() {
  const isProduction = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https");
  return {
    httpOnly: true,
    secure: !!isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  email: string
): void {
  response.cookies.set(COOKIE_NAME, JSON.stringify({ email, token }), cookieOptions());
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
}
