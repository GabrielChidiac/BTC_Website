-- Add name column to subscribers for personalized emails
alter table subscribers add column if not exists name text;
