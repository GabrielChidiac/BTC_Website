import { createServiceClient } from "@/lib/supabase/server";
import { FOUNDING_MEMBER_LIMIT } from "@/lib/constants";

export interface FoundingMemberStatus {
  isOfferActive: boolean;
  activeCount: number;
  limit: number;
  spotsLeft: number;
}

export async function getFoundingMemberStatus(): Promise<FoundingMemberStatus> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true })
    .eq("is_founding_member", true);

  const foundingCount = count ?? 0;
  const spotsLeft = Math.max(0, FOUNDING_MEMBER_LIMIT - foundingCount);

  return {
    isOfferActive: foundingCount < FOUNDING_MEMBER_LIMIT,
    activeCount: foundingCount,
    limit: FOUNDING_MEMBER_LIMIT,
    spotsLeft,
  };
}
