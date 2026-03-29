-- Add tier column to subscribers.
-- Default 'free' for new subscribers after this migration.
ALTER TABLE subscribers
  ADD COLUMN tier text NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'pro'));

-- Gift: all current active subscribers get 'pro' for free.
UPDATE subscribers SET tier = 'pro' WHERE status = 'active';

-- LemonSqueezy payment tracking columns.
ALTER TABLE subscribers ADD COLUMN ls_customer_id text;
ALTER TABLE subscribers ADD COLUMN ls_subscription_id text;
ALTER TABLE subscribers ADD COLUMN tier_updated_at timestamptz;
