import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/session";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { conversationId: null, messages: [] },
      { status: 200 }
    );
  }

  let email: string | undefined;
  let token: string | undefined;

  try {
    const parsed = JSON.parse(sessionCookie);
    email = parsed.email;
    token = parsed.token;
  } catch {
    return NextResponse.json(
      { conversationId: null, messages: [] },
      { status: 200 }
    );
  }

  if (!email || !EMAIL_RE.test(email) || !token) {
    return NextResponse.json(
      { conversationId: null, messages: [] },
      { status: 200 }
    );
  }

  const supabase = createServiceClient();

  // Verify session token is still valid
  const { data: session } = await supabase
    .from("verification_codes")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .eq("code", `session:${token}`)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) {
    return NextResponse.json(
      { conversationId: null, messages: [] },
      { status: 200 }
    );
  }

  // Fetch latest conversation
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, messages, updated_at")
    .eq("email", email.trim().toLowerCase())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json(
      { conversationId: null, messages: [], updatedAt: null },
      { status: 200 }
    );
  }

  return NextResponse.json({
    conversationId: conversation.id,
    messages: conversation.messages,
    updatedAt: conversation.updated_at,
  });
}
