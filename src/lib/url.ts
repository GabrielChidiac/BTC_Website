/**
 * Resolve the canonical base URL for the site.
 *
 * Checked in order:
 *   1. NEXT_PUBLIC_SITE_URL  (set in .env, available in Next.js runtime)
 *   2. SITE_URL              (server-only variant, useful for Trigger.dev)
 *   3. VERCEL_URL            (auto-set by Vercel on deployments)
 *   4. Hard-coded production domain
 *
 * During local dev, `.env` provides the correct value.
 * In production, even if env vars are missing, the fallback is the real domain.
 */
export function getBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;

  if (explicit) return explicit.replace(/\/+$/, "");

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "https://www.btctoday.co";
}
