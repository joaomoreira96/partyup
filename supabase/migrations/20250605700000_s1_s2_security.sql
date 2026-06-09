-- S1 (resource protection) + S2 (operational security, audit, admin)

-- ---------------------------------------------------------------------------
-- Types & tables
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.security_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

alter type public.room_status add value if not exists 'expired';

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity public.security_severity not null default 'low',
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_created_at_idx
  on public.security_events (created_at desc);
create index if not exists security_events_type_created_idx
  on public.security_events (event_type, created_at desc);
create index if not exists security_events_user_idx
  on public.security_events (user_id, created_at desc);

create table if not exists public.user_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  severity public.security_severity not null default 'medium',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_flags_user_unresolved_idx
  on public.user_flags (user_id) where not resolved;

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  is_permanent boolean not null default false,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text
);

create index if not exists user_bans_active_idx
  on public.user_bans (user_id)
  where revoked_at is null;

create table if not exists public.resource_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  resource_type text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resource_usage_type_created_idx
  on public.resource_usage (resource_type, created_at desc);

create table if not exists public.rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket_key, window_start)
);

alter table public.profiles
  add column if not exists active_room_id uuid references public.rooms(id) on delete set null;

alter table public.leaderboards
  add column if not exists status text not null default 'approved',
  add column if not exists review_reason text;

alter table public.leaderboards
  drop constraint if exists leaderboards_status_check;

alter table public.leaderboards
  add constraint leaderboards_status_check
  check (status in ('approved', 'pending_review', 'rejected'));

-- Backfill leaderboards from existing stats
insert into public.leaderboards (game_id, user_id, score, achieved_at, status)
select ugs.game_id, ugs.user_id, ugs.best_score, coalesce(ugs.last_played_at, now()), 'approved'
from public.user_game_stats ugs
where ugs.best_score > 0
  and ugs.user_id is not null
on conflict (game_id, user_id) do update
set score = greatest(public.leaderboards.score, excluded.score),
    status = case
      when public.leaderboards.status = 'rejected' then 'rejected'
      else 'approved'
    end
where excluded.score > public.leaderboards.score;

-- Migrate active profile bans into user_bans
insert into public.user_bans (user_id, reason, is_permanent, expires_at, created_at)
select p.id, coalesce(nullif(trim(p.ban_reason), ''), 'Migrated ban'), p.banned_until is null, p.banned_until, coalesce(p.updated_at, now())
from public.profiles p
where p.is_banned = true
  and not exists (
    select 1 from public.user_bans ub
    where ub.user_id = p.id and ub.revoked_at is null
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_user_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_bans ub
    where ub.user_id = p_user_id
      and ub.revoked_at is null
      and (ub.is_permanent or ub.expires_at is null or ub.expires_at > now())
  );
$$;

create or replace function public.sync_profile_ban(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active record;
begin
  select ub.reason, ub.expires_at, ub.is_permanent
  into v_active
  from public.user_bans ub
  where ub.user_id = p_user_id
    and ub.revoked_at is null
    and (ub.is_permanent or ub.expires_at is null or ub.expires_at > now())
  order by ub.created_at desc
  limit 1;

  if found then
    update public.profiles
    set
      is_banned = true,
      banned_until = case when v_active.is_permanent then null else v_active.expires_at end,
      ban_reason = v_active.reason,
      updated_at = now()
    where id = p_user_id;
  else
    update public.profiles
    set is_banned = false, banned_until = null, ban_reason = null, updated_at = now()
    where id = p_user_id;
  end if;
end;
$$;

create or replace function public.log_security_event(
  p_event_type text,
  p_severity public.security_severity default 'low',
  p_user_id uuid default null,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.security_events (user_id, event_type, severity, ip_address, metadata)
  values (p_user_id, p_event_type, p_severity, p_ip_address, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  if p_user_id is not null and p_event_type in (
    'RATE_LIMIT_HIT', 'INVALID_SCORE', 'SCORE_REJECTED', 'ROOM_SPAM', 'SUSPICIOUS_SCORE'
  ) then
    perform public.check_auto_flags(p_user_id);
  end if;

  return v_id;
end;
$$;

create or replace function public.track_resource_usage(
  p_user_id uuid,
  p_resource_type text,
  p_quantity integer default 1,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.resource_usage (user_id, resource_type, quantity, metadata)
  values (p_user_id, p_resource_type, greatest(coalesce(p_quantity, 1), 1), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_allowed boolean;
begin
  if p_bucket_key is null or p_limit <= 0 or p_window_seconds <= 0 then
    return json_build_object('allowed', true, 'count', 0, 'limit', p_limit);
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets (bucket_key, window_start, count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = rate_limit_buckets.count + 1
  returning count into v_count;

  v_allowed := v_count <= p_limit;

  if not v_allowed then
    perform public.log_security_event(
      'RATE_LIMIT_HIT',
      'medium',
      case
        when p_bucket_key like '%:user:%' then
          nullif(split_part(split_part(p_bucket_key, ':user:', 2), ':', 1), '')::uuid
        else null
      end,
      null,
      jsonb_build_object('bucket', p_bucket_key, 'count', v_count, 'limit', p_limit)
    );
  end if;

  return json_build_object('allowed', v_allowed, 'count', v_count, 'limit', p_limit);
end;
$$;

create or replace function public._insert_user_flag(
  p_user_id uuid,
  p_reason text,
  p_severity public.security_severity default 'medium'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then return null; end if;

  if exists (
    select 1 from public.user_flags uf
    where uf.user_id = p_user_id and uf.reason = p_reason and not uf.resolved
  ) then
    return null;
  end if;

  insert into public.user_flags (user_id, reason, severity)
  values (p_user_id, p_reason, p_severity)
  returning id into v_id;

  perform public.log_security_event(
    'FLAG_CREATED',
    p_severity,
    p_user_id,
    null,
    jsonb_build_object('reason', p_reason, 'flag_id', v_id)
  );

  return v_id;
end;
$$;

create or replace function public.create_user_flag(
  p_user_id uuid,
  p_reason text,
  p_severity public.security_severity default 'medium'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return public._insert_user_flag(p_user_id, p_reason, p_severity);
end;
$$;

create or replace function public.check_auto_flags(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate_limits bigint;
  v_invalid_scores bigint;
  v_rooms_created bigint;
begin
  select count(*) into v_rate_limits
  from public.security_events se
  where se.user_id = p_user_id
    and se.event_type = 'RATE_LIMIT_HIT'
    and se.created_at > now() - interval '10 minutes';

  if v_rate_limits >= 20 then
    perform public._insert_user_flag(p_user_id, 'BOT_BEHAVIOUR', 'high');
  end if;

  select count(*) into v_invalid_scores
  from public.security_events se
  where se.user_id = p_user_id
    and se.event_type in ('INVALID_SCORE', 'SCORE_REJECTED')
    and se.created_at > now() - interval '1 hour';

  if v_invalid_scores >= 10 then
    perform public._insert_user_flag(p_user_id, 'SCORE_ABUSE', 'high');
  end if;

  select count(*) into v_rooms_created
  from public.resource_usage ru
  where ru.user_id = p_user_id
    and ru.resource_type = 'ROOM_CREATED'
    and ru.created_at > now() - interval '1 day';

  if v_rooms_created >= 200 then
    perform public._insert_user_flag(p_user_id, 'ROOM_SPAM', 'high');
  end if;
end;
$$;

create or replace function public.expire_inactive_rooms(p_idle_minutes int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  update public.rooms r
  set status = 'expired'
  where r.status::text not in ('finished', 'expired')
    and coalesce(r.updated_at, r.created_at, now())
      < now() - make_interval(mins => greatest(p_idle_minutes, 5));

  get diagnostics v_count = row_count;

  delete from public.room_players rp
  using public.rooms r
  where rp.room_id = r.id
    and r.status::text = 'expired';

  update public.profiles p
  set active_room_id = null
  where active_room_id in (
    select id from public.rooms where status::text = 'expired'
  );

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard with review status
-- ---------------------------------------------------------------------------

create or replace function public.upsert_leaderboard_best_score(
  p_game_id uuid,
  p_user_id uuid,
  p_score integer,
  p_status text default 'approved',
  p_review_reason text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev integer := 0;
  v_prev_status text;
  v_updated boolean := false;
  v_status text := coalesce(nullif(trim(p_status), ''), 'approved');
begin
  if p_game_id is null or p_user_id is null then
    raise exception 'invalid_leaderboard_args' using errcode = 'P0001';
  end if;

  if public.is_user_banned(p_user_id) then
    raise exception 'user_banned' using errcode = '42501';
  end if;

  if v_status not in ('approved', 'pending_review', 'rejected') then
    v_status := 'approved';
  end if;

  select lb.score, lb.status
  into v_prev, v_prev_status
  from public.leaderboards lb
  where lb.game_id = p_game_id and lb.user_id = p_user_id;

  if not found then
    insert into public.leaderboards (game_id, user_id, score, achieved_at, status, review_reason)
    values (p_game_id, p_user_id, p_score, now(), v_status, p_review_reason);
    return json_build_object('ok', true, 'updated', true, 'previous_score', null, 'status', v_status);
  end if;

  if v_prev_status = 'rejected' and v_status = 'approved' then
    null;
  elsif p_score > v_prev or v_status = 'pending_review' then
    update public.leaderboards
    set
      score = case when p_score > v_prev then p_score else score end,
      achieved_at = case when p_score > v_prev then now() else achieved_at end,
      status = v_status,
      review_reason = coalesce(p_review_reason, review_reason)
    where game_id = p_game_id and user_id = p_user_id;
    v_updated := true;
  end if;

  return json_build_object(
    'ok', true,
    'updated', v_updated,
    'previous_score', v_prev,
    'status', v_status
  );
end;
$$;

create or replace function public.admin_review_leaderboard_score(
  p_leaderboard_id uuid,
  p_action text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.leaderboards%rowtype;
  v_event text;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.leaderboards where id = p_leaderboard_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    update public.leaderboards set status = 'approved', review_reason = null where id = p_leaderboard_id;
    v_event := 'SCORE_APPROVED';
  elsif p_action = 'reject' then
    update public.leaderboards set status = 'rejected', review_reason = coalesce(p_reason, review_reason) where id = p_leaderboard_id;
    v_event := 'SCORE_REJECTED';
  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  perform public.log_security_event(
    v_event,
    'medium',
    v_row.user_id,
    null,
    jsonb_build_object(
      'leaderboard_id', p_leaderboard_id,
      'game_id', v_row.game_id,
      'score', v_row.score,
      'admin_id', auth.uid(),
      'reason', p_reason
    )
  );

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ban management (user_bans + audit)
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_user_ban(
  target_user_id uuid,
  banned boolean,
  until timestamptz default null,
  reason text default null,
  revocation_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
  v_reason text := nullif(trim(reason), '');
  v_revoke_reason text := nullif(trim(revocation_reason), '');
begin
  select p.role into caller_role from public.profiles p where p.id = auth.uid();

  if caller_role is distinct from 'admin' then
    perform public.log_security_event('ADMIN_ACCESS_DENIED', 'high', auth.uid(), null, jsonb_build_object('action', 'set_ban'));
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.profiles where id = target_user_id and role = 'admin') then
    raise exception 'cannot_ban_admin' using errcode = 'P0001';
  end if;

  if banned then
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;

    update public.user_bans
    set revoked_at = now(), revoked_by = auth.uid(), revocation_reason = 'replaced_by_new_ban'
    where user_id = target_user_id and revoked_at is null;

    insert into public.user_bans (user_id, reason, expires_at, is_permanent)
    values (
      target_user_id,
      v_reason,
      until,
      until is null
    );

    perform public.log_security_event(
      'BAN_CREATED',
      'high',
      target_user_id,
      null,
      jsonb_build_object('until', until, 'permanent', until is null, 'reason', v_reason, 'admin_id', auth.uid())
    );
  else
    update public.user_bans
    set
      revoked_at = now(),
      revoked_by = auth.uid(),
      revocation_reason = coalesce(v_revoke_reason, 'admin_unban')
    where user_id = target_user_id and revoked_at is null;

    perform public.log_security_event(
      'BAN_REMOVED',
      'medium',
      target_user_id,
      null,
      jsonb_build_object('admin_id', auth.uid(), 'reason', v_revoke_reason)
    );
  end if;

  perform public.sync_profile_ban(target_user_id);
  return true;
end;
$$;

create or replace function public.admin_resolve_user_flag(
  p_flag_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flag public.user_flags%rowtype;
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_flag from public.user_flags where id = p_flag_id;
  if not found then return false; end if;

  update public.user_flags set resolved = true where id = p_flag_id;

  perform public.log_security_event(
    'FLAG_RESOLVED',
    'low',
    v_flag.user_id,
    null,
    jsonb_build_object('flag_id', p_flag_id, 'reason', v_flag.reason, 'admin_id', auth.uid())
  );

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Room functions (S1 enforcement)
-- ---------------------------------------------------------------------------

create or replace function public.leave_active_room(p_user_id uuid, p_room_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid := coalesce(p_room_id, (select active_room_id from public.profiles where id = p_user_id));
begin
  if v_room_id is null then return; end if;

  delete from public.room_players
  where room_id = v_room_id and user_id = p_user_id;

  update public.profiles
  set active_room_id = null
  where id = p_user_id and active_room_id = v_room_id;
end;
$$;

create or replace function public.create_game_room(
  p_game_slug text,
  p_code text,
  p_guest_name text default 'Convidado',
  p_max_players int default 2
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_player_id uuid;
  v_multiplayer boolean;
  v_guest text;
  v_status text := 'waiting';
  v_cols text := 'code, game_id';
  v_vals text;
  v_pcols text;
  v_pvals text;
  v_has_is_multiplayer boolean;
  v_has_supports_multiplayer boolean;
begin
  if v_user_id is null then
    perform public.log_security_event('ROOM_CREATE_DENIED', 'medium', null, null, jsonb_build_object('slug', p_game_slug));
    raise exception 'auth_required' using errcode = '42501';
  end if;

  if public.is_user_banned(v_user_id) then
    perform public.log_security_event('BANNED_ACCESS', 'high', v_user_id, null, jsonb_build_object('action', 'room_create'));
    raise exception 'user_banned' using errcode = '42501';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'is_multiplayer'
  ) into v_has_is_multiplayer;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'supports_multiplayer'
  ) into v_has_supports_multiplayer;

  if v_has_is_multiplayer and v_has_supports_multiplayer then
    select g.id, coalesce(g.is_multiplayer, g.supports_multiplayer, false)
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug and g.status::text in ('active', 'published');
  elsif v_has_is_multiplayer then
    select g.id, coalesce(g.is_multiplayer, false)
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug and g.status::text in ('active', 'published');
  elsif v_has_supports_multiplayer then
    select g.id, coalesce(g.supports_multiplayer, false)
    into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug and g.status::text in ('active', 'published');
  else
    select g.id, false into v_game_id, v_multiplayer
    from public.games g
    where g.slug = p_game_slug and g.status::text in ('active', 'published');
  end if;

  if v_game_id is null then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if not v_multiplayer then
    raise exception 'not_multiplayer' using errcode = 'P0001';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'room_status' and e.enumlabel = 'waiting'
  ) then
    v_status := 'lobby';
  end if;

  v_vals := format('%L, %L', p_code, v_game_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_user_id'
  ) then
    v_cols := v_cols || ', host_user_id';
    v_vals := v_vals || format(', %L', v_user_id);
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'host_id'
  ) then
    v_cols := v_cols || ', host_id';
    v_vals := v_vals || format(', %L', v_user_id);
  end if;

  v_cols := v_cols || ', status';
  v_vals := v_vals || format(', %L', v_status);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    v_cols := v_cols || ', max_players';
    v_vals := v_vals || format(', %s', p_max_players);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'metadata'
  ) then
    v_cols := v_cols || ', metadata';
    v_vals := v_vals || ', ''{}''::jsonb';
  end if;

  execute format('insert into public.rooms (%s) values (%s) returning id', v_cols, v_vals)
  into v_room_id;

  perform public.leave_active_room(v_user_id, null);

  v_pcols := 'room_id';
  v_pvals := format('%L', v_room_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    v_pcols := v_pcols || ', user_id';
    v_pvals := v_pvals || format(', %L', v_user_id);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    v_pcols := v_pcols || ', guest_name';
    v_pvals := v_pvals || ', null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  ) then
    v_pcols := v_pcols || ', is_host';
    v_pvals := v_pvals || ', true';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    v_pcols := v_pcols || ', is_ready';
    v_pvals := v_pvals || ', false';
  end if;

  execute format('insert into public.room_players (%s) values (%s) returning id', v_pcols, v_pvals)
  into v_player_id;

  update public.profiles set active_room_id = v_room_id where id = v_user_id;

  perform public.track_resource_usage(v_user_id, 'ROOM_CREATED', 1, jsonb_build_object('room_id', v_room_id, 'code', p_code));

  return json_build_object('room_id', v_room_id, 'code', p_code, 'player_id', v_player_id, 'game_id', v_game_id);
end;
$$;

create or replace function public.join_game_room(
  p_room_id uuid,
  p_guest_name text default 'Convidado',
  p_player_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_guest text;
  v_count int;
  v_max int := 2;
  v_pcols text;
  v_pvals text;
  v_room_status text;
begin
  if p_room_id is null then
    raise exception 'room_required' using errcode = 'P0001';
  end if;

  select r.status::text into v_room_status from public.rooms r where r.id = p_room_id;
  if v_room_status = 'expired' then
    raise exception 'room_expired' using errcode = 'P0001';
  end if;

  if v_user_id is not null and public.is_user_banned(v_user_id) then
    perform public.log_security_event('BANNED_ACCESS', 'high', v_user_id, null, jsonb_build_object('action', 'room_join'));
    raise exception 'user_banned' using errcode = '42501';
  end if;

  v_guest := coalesce(nullif(trim(p_guest_name), ''), 'Convidado');

  if p_player_id is not null then
    select rp.id into v_player_id
    from public.room_players rp
    where rp.id = p_player_id and rp.room_id = p_room_id;

    if v_player_id is not null then
      if v_user_id is null and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
      ) then
        update public.room_players set guest_name = v_guest where id = v_player_id;
      end if;
      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  if v_user_id is not null then
    select rp.id into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id and rp.user_id = v_user_id;

    if v_player_id is not null then
      update public.profiles set active_room_id = p_room_id where id = v_user_id;
      return json_build_object('player_id', v_player_id);
    end if;

    perform public.leave_active_room(v_user_id, null);
  end if;

  if v_user_id is null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    select rp.id into v_player_id
    from public.room_players rp
    where rp.room_id = p_room_id and rp.user_id is null and rp.guest_name = v_guest;

    if v_player_id is not null then
      return json_build_object('player_id', v_player_id);
    end if;
  end if;

  select count(*)::int into v_count from public.room_players where room_id = p_room_id;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'max_players'
  ) then
    execute 'select max_players from public.rooms where id = $1' into v_max using p_room_id;
  end if;

  if v_count >= coalesce(v_max, 2) then
    raise exception 'room_full' using errcode = 'P0001';
  end if;

  v_pcols := 'room_id';
  v_pvals := format('%L', p_room_id);

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'user_id'
  ) then
    v_pcols := v_pcols || ', user_id';
    v_pvals := v_pvals || format(', %L', v_user_id);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'guest_name'
  ) then
    v_pcols := v_pcols || ', guest_name';
    v_pvals := v_pvals || format(', %L', case when v_user_id is null then v_guest else null end);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_host'
  ) then
    v_pcols := v_pcols || ', is_host';
    v_pvals := v_pvals || ', false';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'is_ready'
  ) then
    v_pcols := v_pcols || ', is_ready';
    v_pvals := v_pvals || ', false';
  end if;

  execute format('insert into public.room_players (%s) values (%s) returning id', v_pcols, v_pvals)
  into v_player_id;

  if v_user_id is not null then
    update public.profiles set active_room_id = p_room_id where id = v_user_id;
    perform public.track_resource_usage(v_user_id, 'ROOM_JOINED', 1, jsonb_build_object('room_id', p_room_id));
  end if;

  return json_build_object('player_id', v_player_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.security_events enable row level security;
alter table public.user_flags enable row level security;
alter table public.user_bans enable row level security;
alter table public.resource_usage enable row level security;
alter table public.rate_limit_buckets enable row level security;

drop policy if exists security_events_admin_select on public.security_events;
create policy security_events_admin_select on public.security_events
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists user_flags_admin_all on public.user_flags;
create policy user_flags_admin_all on public.user_flags
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists user_bans_admin_select on public.user_bans;
create policy user_bans_admin_select on public.user_bans
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists resource_usage_admin_select on public.resource_usage;
create policy resource_usage_admin_select on public.resource_usage
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists leaderboards_select_approved on public.leaderboards;
drop policy if exists leaderboards_select_public on public.leaderboards;

create policy leaderboards_select_approved on public.leaderboards
  for select using (
    status = 'approved'
    or auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_game_room(text, text, text, int) from public;
grant execute on function public.create_game_room(text, text, text, int) to authenticated;

revoke all on function public.log_security_event(text, public.security_severity, uuid, text, jsonb) from public;
grant execute on function public.log_security_event(text, public.security_severity, uuid, text, jsonb) to authenticated, anon;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated, anon;

revoke all on function public.track_resource_usage(uuid, text, integer, jsonb) from public;
grant execute on function public.track_resource_usage(uuid, text, integer, jsonb) to authenticated;

revoke all on function public.is_user_banned(uuid) from public;
grant execute on function public.is_user_banned(uuid) to authenticated, anon;

revoke all on function public.upsert_leaderboard_best_score(uuid, uuid, integer, text, text) from public;
grant execute on function public.upsert_leaderboard_best_score(uuid, uuid, integer, text, text) to authenticated;

revoke all on function public.admin_review_leaderboard_score(uuid, text, text) from public;
grant execute on function public.admin_review_leaderboard_score(uuid, text, text) to authenticated;

revoke all on function public.create_user_flag(uuid, text, public.security_severity) from public;
grant execute on function public.create_user_flag(uuid, text, public.security_severity) to authenticated;

revoke all on function public.admin_resolve_user_flag(uuid) from public;
grant execute on function public.admin_resolve_user_flag(uuid) to authenticated;

revoke all on function public.leave_active_room(uuid, uuid) from public;
grant execute on function public.leave_active_room(uuid, uuid) to authenticated;

revoke all on function public.expire_inactive_rooms(int) from public;
grant execute on function public.expire_inactive_rooms(int) to authenticated, anon;

notify pgrst, 'reload schema';
