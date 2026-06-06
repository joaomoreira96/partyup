-- Várias categorias por jogo + nomes bilíngues (name = PT, name_en = EN)

-- Garantir que não existe unique só em game_id (impediria N:N)
alter table public.game_categories
  drop constraint if exists game_categories_game_id_key;

alter table public.games
  add column if not exists name_en text not null default '';

update public.games
set name_en = case slug
  when 'memoria-classica' then 'Classic Memory'
  when 'reacao-rapida' then 'Quick Reaction'
  when 'trivia-rapida' then 'Quick Trivia'
  when 'reaction-duel' then 'Reaction Duel'
  else name
end
where name_en = '';

alter table public.games
  alter column name_en drop default;

create or replace function public.admin_set_game_categories(
  p_game_id uuid,
  p_category_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  delete from public.game_categories where game_id = p_game_id;

  if p_category_ids is not null and coalesce(array_length(p_category_ids, 1), 0) > 0 then
    insert into public.game_categories (game_id, category_id)
    select distinct p_game_id, category_id
    from unnest(p_category_ids) as category_id
    where exists (
      select 1 from public.categories c where c.id = category_id
    );
  end if;

  -- Campo legado só guarda uma categoria; limpar para game_categories ser a fonte de verdade
  update public.games
  set category = null
  where id = p_game_id;

  return true;
end;
$$;

notify pgrst, 'reload schema';
