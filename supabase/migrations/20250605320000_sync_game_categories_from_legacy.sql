-- Sincroniza game_categories a partir do campo legado games.category (slug ou nome)

insert into public.game_categories (game_id, category_id)
select g.id, c.id
from public.games g
join public.categories c on (
  lower(trim(c.slug)) = lower(trim(g.category))
  or lower(trim(c.name)) = lower(trim(g.category))
  or lower(trim(c.name_en)) = lower(trim(g.category))
)
where g.category is not null
  and trim(g.category) <> ''
  and not exists (
    select 1
    from public.game_categories gc
    where gc.game_id = g.id
      and gc.category_id = c.id
  )
on conflict do nothing;
