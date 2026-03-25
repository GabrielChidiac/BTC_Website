import { task, logger } from "@trigger.dev/sdk/v3";

export const revalidateSiteTask = task({
  id: "revalidate-site",
  run: async (): Promise<{ revalidated: true }> => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const secret = process.env.REVALIDATION_SECRET;

    if (!secret) {
      logger.warn("REVALIDATION_SECRET not set — skipping revalidation");
      return { revalidated: true };
    }

    const url = `${siteUrl}/api/revalidate`;
    logger.info("Revalidating site", { url });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("Revalidation request failed", { status: res.status, body });
      throw new Error(`[revalidate-site] Failed (${res.status}): ${body}`);
    }

    logger.info("Site revalidated successfully");
    return { revalidated: true };
  },
});
