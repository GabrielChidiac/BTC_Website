-- Add founding member flag to subscribers
ALTER TABLE subscribers ADD COLUMN is_founding_member boolean NOT NULL DEFAULT false;

-- Backfill: existing active Pro subscribers without a Whop membership are founding members
UPDATE subscribers
SET is_founding_member = true
WHERE status = 'active'
  AND tier = 'pro'
  AND whop_membership_id IS NULL;
