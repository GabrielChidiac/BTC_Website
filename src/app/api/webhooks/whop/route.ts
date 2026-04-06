import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWhopWebhook } from "@/lib/whop";

interface WhopWebhookPayload {
  action: string;
  data: {
    id: string;
    user: {
      id: string;
      email: string;
    };
    status: string;
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("whop-signature") ?? "";

  if (!verifyWhopWebhook(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhopWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, data } = payload;
  const email = data?.user?.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "No email in payload" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (action === "membership.went_valid" || action === "membership_activated") {
    // Check if subscriber exists
    const { data: existing } = await supabase
      .from("subscribers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Upgrade existing subscriber to pro
      await supabase
        .from("subscribers")
        .update({
          tier: "pro",
          whop_user_id: data.user.id,
          whop_membership_id: data.id,
          tier_updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    } else {
      // Create new pro subscriber (they paid but weren't subscribed yet)
      await supabase.from("subscribers").insert({
        email,
        status: "active",
        tier: "pro",
        whop_user_id: data.user.id,
        whop_membership_id: data.id,
        tier_updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, action: "upgraded_to_pro" });
  }

  if (action === "membership.went_invalid" || action === "membership_deactivated") {
    // Only downgrade if this membership is the one that granted pro
    const { data: sub } = await supabase
      .from("subscribers")
      .select("whop_membership_id, tier")
      .eq("email", email)
      .maybeSingle();

    if (sub && sub.tier === "pro" && sub.whop_membership_id === data.id) {
      await supabase
        .from("subscribers")
        .update({
          tier: "free",
          tier_updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    }

    return NextResponse.json({ ok: true, action: "downgraded_to_free" });
  }

  // Unhandled event — acknowledge it
  return NextResponse.json({ ok: true, action: "ignored" });
}
