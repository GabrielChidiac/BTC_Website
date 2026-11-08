import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { BRIEFINGS_TAG } from "@/lib/briefings";

export async function POST(request: Request) {
  const secret = process.env.REVALIDATION_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "REVALIDATION_SECRET not configured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Expire cached briefing reads immediately so the new briefing shows on the next request
    revalidateTag(BRIEFINGS_TAG, { expire: 0 });
    revalidatePath("/");
    revalidatePath("/archive");

    return NextResponse.json({ revalidated: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
