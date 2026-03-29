import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/session";

const SIGNED_URL_EXPIRY = 60; // seconds

export async function GET(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date", { status: 400 });
  }

  // Check tier via session cookie
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return Response.redirect(new URL("/pricing", req.url));
  }

  let email: string | undefined;
  let token: string | undefined;

  try {
    const parsed = JSON.parse(raw);
    email = parsed.email?.trim().toLowerCase();
    token = parsed.token;
  } catch {
    return Response.redirect(new URL("/pricing", req.url));
  }

  if (!email || !token) {
    return Response.redirect(new URL("/pricing", req.url));
  }

  const supabase = createServiceClient();

  // Verify session token
  const { data: session } = await supabase
    .from("verification_codes")
    .select("id")
    .eq("email", email)
    .eq("code", `session:${token}`)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (!session) {
    return Response.redirect(new URL("/pricing", req.url));
  }

  // Check subscriber tier
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("tier")
    .eq("email", email)
    .single();

  if (subscriber?.tier !== "pro") {
    return Response.redirect(new URL("/pricing", req.url));
  }

  // Pro user — generate a short-lived signed URL (not a permanent public link)
  const filename = `btc-today-${date}.pdf`;
  const { data, error } = await supabase.storage
    .from("briefing-pdfs")
    .createSignedUrl(filename, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    return new Response("PDF not found", { status: 404 });
  }

  return Response.redirect(data.signedUrl);
}
