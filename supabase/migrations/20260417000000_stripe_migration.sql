-- Migrate from Whop to Stripe as payment provider.

ALTER TABLE subscribers RENAME COLUMN whop_user_id TO stripe_customer_id;
ALTER TABLE subscribers RENAME COLUMN whop_membership_id TO stripe_subscription_id;
