-- Add optional `tipper_name` column to lightning_tips so tippers can self-identify
-- on the /tip form. Stays nullable; the form treats it as optional and the
-- backend trims to 80 chars. Pseudonymity remains the default.

alter table lightning_tips
  add column if not exists tipper_name text;
