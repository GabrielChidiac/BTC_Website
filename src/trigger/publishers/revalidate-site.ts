import { task, logger } from "@trigger.dev/sdk/v3";
import { getBaseUrl } from "@/lib/url";
import { fetchWithTimeout } from "@/trigger/lib/fetch-timeout";

export const revalidateSiteTask = task({
  id: "revalidate-site",
  run: async (): Promise<{ revalidated: boolean }> => {
    const siteUrl = getBaseUrl();
    const secret = process.env.REVALIDATION_SECRET;

    if (!secret) {
      logger.warn("REVALIDATION_SECRET not set — skipping revalidation");
      return { revalidated: false };
    }

    const url = `${siteUrl}/api/revalidate`;
    logger.info("Revalidating site", { url });

    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      }, 15_000);

      if (!res.ok) {
        const body = await res.text();
        logger.error("Revalidation request failed", { status: res.status, body });
        return { revalidated: false };
      }

      logger.info("Site revalidated successfully");
      return { revalidated: true };
    } catch (err) {
      logger.error("Revalidation fetch failed (site may not be deployed yet)", {
        error: (err as Error).message,
      });
      return { revalidated: false };
    }
  },
});
