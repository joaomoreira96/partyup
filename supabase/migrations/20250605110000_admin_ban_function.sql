-- Ban de utilizadores via função security definer (evita falhas de RLS no UPDATE)

create or replace function public.admin_set_user_ban(
  target_user_id uuid,
  banned boolean,
  until timestamptz default null,
  reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
  rows_updated int;
begin
  select p.role into caller_role
  from public.profiles p
  where p.id = auth.uid();

  if caller_role is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles where id = target_user_id
  ) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.profiles where id = target_user_id and role = 'admin'
  ) then
    raise exception 'cannot_ban_admin' using errcode = 'P0001';
  end if;

  update public.profiles
  set
    is_banned = banned,
    banned_until = case when banned then until else null end,
    ban_reason = case when banned then nullif(trim(reason), '') else null end,
    updated_at = now()
  where id = target_user_id;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

revoke all on function public.admin_set_user_ban(uuid, boolean, timestamptz, text) from public;
grant execute on function public.admin_set_user_ban(uuid, boolean, timestamptz, text) to authenticated;
