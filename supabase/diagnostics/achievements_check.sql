-- PartyUp — diagnóstico de achievements
-- No SQL Editor do Supabase: substitui YOUR_USER_ID pelo UUID do utilizador

-- 0) Encontrar user_id pelo username
select id, username, display_name from public.profiles where username = 'TEU_USERNAME';

-- 1) apply_session_stats atualiza user_game_stats?
select case
  when pg_get_functiondef(p.oid) ilike '%user_game_stats%' then 'OK — trigger com user_game_stats'
  else 'PROBLEMA — corre 20250605420000_user_game_stats_trigger_backfill.sql'
end as apply_session_stats_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'apply_session_stats';

-- 2) record_game_session devolve unlocked_achievements?
select
  case
    when pg_get_functiondef(p.oid) ilike '%unlocked_achievements%' then 'OK — função atualizada'
    else 'PROBLEMA — função antiga sem avaliação de achievements'
  end as record_game_session_status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_game_session';

-- 2) Catálogo (esperado: 16 linhas com category = platform)
select count(*) as platform_achievements
from public.achievements
where coalesce(category, 'platform') = 'platform';

select id, code, slug, name, category, metric, target_value
from public.achievements
where coalesce(category, 'platform') = 'platform'
order by target_value;

-- 3) Conquistas do utilizador (substituir YOUR_USER_ID)
select
  ua.unlocked_at,
  a.code,
  a.name,
  a.category
from public.user_achievements ua
join public.achievements a on a.id = ua.achievement_id
where ua.user_id = 'YOUR_USER_ID';

-- 4) user_stats
select total_games_played, total_play_time_seconds, total_score, achievements_unlocked
from public.user_stats
where user_id = 'YOUR_USER_ID';

-- 5) Streak
select current_streak, longest_streak, last_active_date
from public.profiles
where id = 'YOUR_USER_ID';

-- 6) Sessões recentes (user_id NULL = jogaste como convidado)
select id, game_id, user_id, score, duration_seconds, ended_at
from public.game_sessions
where user_id = 'YOUR_USER_ID'
order by coalesce(ended_at, created_at) desc
limit 5;

-- 7) Avaliação manual (deve devolver FIRST_GAME após 1ª partida)
select public.evaluate_platform_achievements('YOUR_USER_ID'::uuid);

-- 8) Eventos recentes
select event_type, payload, created_at
from public.game_events
where user_id = 'YOUR_USER_ID'
order by created_at desc
limit 10;
