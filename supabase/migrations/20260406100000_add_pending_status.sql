-- Allow 'pending' status for subscribers in signup flow (before email verification)
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
  WHERE con.conrelid = 'subscribers'::regclass
    AND att.attname = 'status'
    AND con.contype = 'c';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE subscribers DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE subscribers ADD CONSTRAINT subscribers_status_check
  CHECK (status IN ('active', 'unsubscribed', 'pending'));
