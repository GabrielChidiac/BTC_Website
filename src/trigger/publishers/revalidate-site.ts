import { task, logger } from "@trigger.dev/sdk/v3";
import { getBaseUrl } from "@/lib/url";

export const revalidateSiteTask = task({
  id: "revalidate-site",
  run: async (): Promise<{ revalidated: true }> => {
    const siteUrl = getBaseUrl();
    const secret = process.env.REVALIDATION_SECRET;

    if (!secret) {
      logger.warn("REVALIDATION_SECRET not set — skipping revalidation");
      return { revalidated: true };
    }

    const url = `${siteUrl}/api/revalidate`;
    logger.info("Revalidating site", { url });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text();
        logger.warn("Revalidation request failed (non-fatal)", { status: res.status, body });
        return { revalidated: true };
      }

      logger.info("Site revalidated successfully");
    } catch (err) {
      logger.warn("Revalidation fetch failed (non-fatal, site may not be deployed yet)", {
        error: (err as Error).message,
      });
    }

    return { revalidated: true };
  },
});
