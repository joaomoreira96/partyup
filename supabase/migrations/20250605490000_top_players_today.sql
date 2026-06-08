-- Melhores jogadores do dia: maior soma de pontos em sessões terminadas hoje.
-- SECURITY DEFINER porque o select direto pode ser bloqueado por RLS no hosted.

create or replace function public.get_top_players_today(p_limit int default 3)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(t), '[]'::json)
  from (
    select
      gs.user_id,
      sum(coalesce(gs.score, 0))::bigint as points,
      p.display_name,
      p.username,
      p.avatar_url
    from public.game_sessions gs
    join public.profiles p on p.id = gs.user_id
    where gs.user_id is not null
      and gs.ended_at::date = current_date
      and coalesce(p.is_banned, false) = false
      and p.deleted_at is null
    group by gs.user_id, p.display_name, p.username, p.avatar_url
    having sum(coalesce(gs.score, 0)) > 0
    order by points desc
    limit greatest(coalesce(p_limit, 3), 1)
  ) t;
$$;

revoke all on function public.get_top_players_today(int) from public;
grant execute on function public.get_top_players_today(int) to anon, authenticated;

notify pgrst, 'reload schema';
