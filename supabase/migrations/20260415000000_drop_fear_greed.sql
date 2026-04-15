-- Remove the deprecated fear_greed field from archived briefings.
-- The Fear & Greed index (alternative.me) was removed from the product on
-- 2026-04-15; this strips the stale key from historical content JSONB so the
-- shape matches the current BriefingJSON type.

update daily_briefings
set content = content - 'fear_greed'
where content ? 'fear_greed';
