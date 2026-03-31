import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME, clearSessionCookie } from "@/lib/session";

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json(
      { success: false, error: "Not logged in" },
      { status: 401 }
    );
  }

  let email: string | undefined;
  try {
    const parsed = JSON.parse(raw);
    email = parsed.email?.trim().toLowerCase();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid session" },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json(
      { success: false, error: "Invalid session" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("subscribers")
    .update({ status: "unsubscribed" })
    .eq("email", email);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Clear the session cookie
  const response = NextResponse.json(
    { success: true, message: "You have been unsubscribed." }
  );
  clearSessionCookie(response);
  return response;
}
