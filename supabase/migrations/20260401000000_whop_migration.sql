-- Migrate from LemonSqueezy to Whop as payment provider.
-- Both columns are currently NULL (LemonSqueezy was never connected).
ALTER TABLE subscribers RENAME COLUMN ls_customer_id TO whop_user_id;
ALTER TABLE subscribers RENAME COLUMN ls_subscription_id TO whop_membership_id;
