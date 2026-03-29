import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { setSessionCookie } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string; token?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const token = body.token?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }

  if (!token || token.length < 32) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Find valid, unused magic link token
  const { data: magicToken, error: lookupError } = await supabase
    .from("verification_codes")
    .select("id, expires_at")
    .eq("email", email)
    .eq("code", `magic:${token}`)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  if (!magicToken) {
    return NextResponse.json(
      { error: "Invalid or expired link. Please request a new one." },
      { status: 401 }
    );
  }

  // Mark magic link as used
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("id", magicToken.id);

  // Fetch subscriber name for personalized display
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("name")
    .eq("email", email)
    .maybeSingle();

  // Generate a long-lived session token
  const sessionBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionBytes);
  const sessionToken = Array.from(sessionBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await supabase
    .from("verification_codes")
    .insert({
      email,
      code: `session:${sessionToken}`,
      expires_at: sessionExpiry.toISOString(),
      used: false,
    });

  const response = NextResponse.json(
    { success: true, token: sessionToken },
    { status: 200 }
  );
  setSessionCookie(response, sessionToken, email, subscriber?.name);
  return response;
}
