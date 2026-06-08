-- Pódio global: jogadores com mais pontos na plataforma (total_score).
-- SECURITY DEFINER porque o select direto em user_stats pode ser bloqueado por RLS no hosted.

create or replace function public.get_top_players_by_points(p_limit int default 3)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(t), '[]'::json)
  from (
    select
      us.user_id,
      us.total_score,
      p.display_name,
      p.username,
      p.avatar_url
    from public.user_stats us
    join public.profiles p on p.id = us.user_id
    where coalesce(us.total_score, 0) > 0
      and coalesce(p.is_banned, false) = false
      and p.deleted_at is null
    order by us.total_score desc
    limit greatest(coalesce(p_limit, 3), 1)
  ) t;
$$;

revoke all on function public.get_top_players_by_points(int) from public;
grant execute on function public.get_top_players_by_points(int) to anon, authenticated;

notify pgrst, 'reload schema';
