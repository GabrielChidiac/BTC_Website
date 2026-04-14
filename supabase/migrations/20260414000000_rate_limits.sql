-- ─── Rate Limits ──────────────────────────────────────────────────────────
--
-- Generic rate-limiting primitive used by all public API routes. Buckets
-- are keyed as "{route}:{kind}:{identifier}" (for example
-- "subscribe:ip:1.2.3.4" or "verify:email:alice@example.com") and counted
-- within fixed time windows. The window_start column truncates to the
-- nearest window boundary so requests within the same window collapse to
-- one row via the (bucket, window_start) primary key.
--
-- The increment_rate_limit() RPC performs an atomic UPSERT-and-increment
-- so concurrent requests cannot race past the limit. It returns the
-- post-increment count, and callers compare that against their limit.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, window_start)
);

-- Indexed for the periodic cleanup of expired windows.
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
  ON rate_limits (window_start);

-- RLS: service-role only. Public clients must never read or write this
-- table, and the helper functions always run with the service key from
-- src/lib/supabase/server.ts (createServiceClient).
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manage rate_limits"
  ON rate_limits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic increment RPC. Returns the post-increment count so callers can
-- reject the request when count > limit. Uses ON CONFLICT to keep the
-- increment race-free under concurrent callers.
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_bucket TEXT,
  p_window TIMESTAMPTZ
) RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO rate_limits (bucket, window_start, count)
  VALUES (p_bucket, p_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service role may call the RPC directly. Belt-and-suspenders on top
-- of the table-level policy.
REVOKE ALL ON FUNCTION increment_rate_limit(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_rate_limit(TEXT, TIMESTAMPTZ) TO service_role;
