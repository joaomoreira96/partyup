-- Colunas esperadas em room_players (schema hosted)

alter table public.room_players
  add column if not exists is_ready boolean not null default false;

alter table public.room_players
  add column if not exists is_host boolean not null default false;

alter table public.room_players
  add column if not exists guest_name text;

alter table public.room_players
  add column if not exists joined_at timestamptz not null default now();

notify pgrst, 'reload schema';
