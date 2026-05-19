-- Per-user sidebar visibility. NULL/empty array = show everything (legacy behavior).
alter table public.profiles
  add column if not exists allowed_menu text[];
