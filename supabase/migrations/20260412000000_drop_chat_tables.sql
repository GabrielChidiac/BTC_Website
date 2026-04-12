-- Drop chat feature tables (chat feature removed)
-- These tables previously stored AI chat conversations and rate limit counters.

DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS chat_rate_limits;
