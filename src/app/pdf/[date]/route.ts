import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date", { status: 400 });
  }

  const supabase = await createServerClient();
  const filename = `btc-today-${date}.pdf`;

  const { data } = supabase.storage
    .from("briefing-pdfs")
    .getPublicUrl(filename);

  redirect(data.publicUrl);
}
