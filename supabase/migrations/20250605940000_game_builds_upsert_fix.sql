-- game_builds upsert fix — hosted pode não ter UNIQUE (game_id, version)
--
-- Erro: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- A RPC passa a fazer UPDATE + INSERT em vez de ON CONFLICT.

create unique index if not exists game_builds_game_id_version_key
  on public.game_builds (game_id, version);

create or replace function public.admin_publish_submission(
  p_id uuid,
  p_thumbnail_url text,
  p_banner_url text,
  p_build_url text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.game_submissions;
  v_manifest jsonb;
  v_slug text;
  v_game_id uuid;
  v_existing_runtime public.game_runtime;
  v_cat_slug text;
  v_cat_id uuid;
  v_tag_slug text;
  v_tag_id uuid;
  v_ach jsonb;
  v_ach_code text;
  v_ach_slug text;
  v_min_players int;
  v_max_players int;
  v_supports_mp boolean;
  v_has_builds_updated_at boolean;
  v_has_module_id boolean;
  v_has_name_en boolean;
  v_has_description_en boolean;
  v_has_achievements_updated_at boolean;
  v_has_achievements_game_id boolean;
  v_has_achievements_code boolean;
  v_has_achievements_category boolean;
  v_has_achievements_points boolean;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_builds' and column_name = 'updated_at'
  ) into v_has_builds_updated_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'module_id'
  ) into v_has_module_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'name_en'
  ) into v_has_name_en;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'description_en'
  ) into v_has_description_en;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'achievements' and column_name = 'updated_at'
  ) into v_has_achievements_updated_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'achievements' and column_name = 'game_id'
  ) into v_has_achievements_game_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'achievements' and column_name = 'code'
  ) into v_has_achievements_code;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'achievements' and column_name = 'category'
  ) into v_has_achievements_category;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'achievements' and column_name = 'points'
  ) into v_has_achievements_points;

  select * into v_sub
  from public.game_submissions
  where id = p_id;

  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  if v_sub.status <> 'approved' then
    raise exception 'submission_not_approved' using errcode = 'P0001';
  end if;

  v_manifest := v_sub.manifest;
  v_slug := v_sub.slug;
  v_min_players := greatest(1, coalesce((v_manifest->>'minPlayers')::int, 1));
  v_max_players := greatest(v_min_players, coalesce((v_manifest->>'maxPlayers')::int, v_min_players));
  v_supports_mp := v_max_players > 1;

  select g.id, g.runtime
  into v_game_id, v_existing_runtime
  from public.games g
  where g.slug = v_slug
  limit 1;

  if v_game_id is not null and coalesce(v_existing_runtime::text, 'native') = 'native' then
    raise exception 'slug_conflict_native' using errcode = 'P0001';
  end if;

  if v_game_id is null then
    if v_has_module_id and v_has_name_en and v_has_description_en then
      insert into public.games (
        slug, name, name_en, description, description_en,
        thumbnail_url, banner_url, module_id, guest_allowed,
        supports_multiplayer, supports_desktop, supports_tablet, supports_mobile,
        min_players, max_players, runtime, sdk_version, status
      )
      values (
        v_slug,
        coalesce(v_manifest->>'name', v_sub.game_name),
        coalesce(v_manifest->>'name', v_sub.game_name),
        coalesce(v_manifest->>'description', ''),
        coalesce(v_manifest->>'description', ''),
        p_thumbnail_url, p_banner_url, v_slug, true, v_supports_mp,
        coalesce((v_manifest->>'supportsDesktop')::boolean, true),
        coalesce((v_manifest->>'supportsTablet')::boolean, true),
        coalesce((v_manifest->>'supportsMobile')::boolean, true),
        v_min_players, v_max_players,
        'iframe'::public.game_runtime, v_sub.sdk_version, 'active'::public.game_status
      )
      returning id into v_game_id;
    elsif v_has_name_en then
      insert into public.games (
        slug, name, name_en, description, thumbnail_url, banner_url,
        guest_allowed, supports_multiplayer, supports_desktop, supports_tablet,
        supports_mobile, min_players, max_players, runtime, sdk_version, status
      )
      values (
        v_slug,
        coalesce(v_manifest->>'name', v_sub.game_name),
        coalesce(v_manifest->>'name', v_sub.game_name),
        coalesce(v_manifest->>'description', ''),
        p_thumbnail_url, p_banner_url, true, v_supports_mp,
        coalesce((v_manifest->>'supportsDesktop')::boolean, true),
        coalesce((v_manifest->>'supportsTablet')::boolean, true),
        coalesce((v_manifest->>'supportsMobile')::boolean, true),
        v_min_players, v_max_players,
        'iframe'::public.game_runtime, v_sub.sdk_version, 'active'::public.game_status
      )
      returning id into v_game_id;
    else
      insert into public.games (
        slug, name, description, thumbnail_url, banner_url,
        guest_allowed, supports_multiplayer, supports_desktop, supports_tablet,
        supports_mobile, min_players, max_players, runtime, sdk_version, status
      )
      values (
        v_slug,
        coalesce(v_manifest->>'name', v_sub.game_name),
        coalesce(v_manifest->>'description', ''),
        p_thumbnail_url, p_banner_url, true, v_supports_mp,
        coalesce((v_manifest->>'supportsDesktop')::boolean, true),
        coalesce((v_manifest->>'supportsTablet')::boolean, true),
        coalesce((v_manifest->>'supportsMobile')::boolean, true),
        v_min_players, v_max_players,
        'iframe'::public.game_runtime, v_sub.sdk_version, 'active'::public.game_status
      )
      returning id into v_game_id;
    end if;
  else
    if v_has_module_id and v_has_name_en and v_has_description_en then
      update public.games set
        name = coalesce(v_manifest->>'name', v_sub.game_name),
        name_en = coalesce(v_manifest->>'name', v_sub.game_name),
        description = coalesce(v_manifest->>'description', description),
        description_en = coalesce(v_manifest->>'description', description_en),
        thumbnail_url = p_thumbnail_url, banner_url = p_banner_url, module_id = v_slug,
        supports_multiplayer = v_supports_mp,
        supports_desktop = coalesce((v_manifest->>'supportsDesktop')::boolean, supports_desktop),
        supports_tablet = coalesce((v_manifest->>'supportsTablet')::boolean, supports_tablet),
        supports_mobile = coalesce((v_manifest->>'supportsMobile')::boolean, supports_mobile),
        min_players = v_min_players, max_players = v_max_players,
        runtime = 'iframe'::public.game_runtime, sdk_version = v_sub.sdk_version,
        status = 'active'::public.game_status, updated_at = now()
      where id = v_game_id;
    elsif v_has_name_en then
      update public.games set
        name = coalesce(v_manifest->>'name', v_sub.game_name),
        name_en = coalesce(v_manifest->>'name', v_sub.game_name),
        description = coalesce(v_manifest->>'description', description),
        thumbnail_url = p_thumbnail_url, banner_url = p_banner_url,
        supports_multiplayer = v_supports_mp,
        supports_desktop = coalesce((v_manifest->>'supportsDesktop')::boolean, supports_desktop),
        supports_tablet = coalesce((v_manifest->>'supportsTablet')::boolean, supports_tablet),
        supports_mobile = coalesce((v_manifest->>'supportsMobile')::boolean, supports_mobile),
        min_players = v_min_players, max_players = v_max_players,
        runtime = 'iframe'::public.game_runtime, sdk_version = v_sub.sdk_version,
        status = 'active'::public.game_status, updated_at = now()
      where id = v_game_id;
    else
      update public.games set
        name = coalesce(v_manifest->>'name', v_sub.game_name),
        description = coalesce(v_manifest->>'description', description),
        thumbnail_url = p_thumbnail_url, banner_url = p_banner_url,
        supports_multiplayer = v_supports_mp,
        supports_desktop = coalesce((v_manifest->>'supportsDesktop')::boolean, supports_desktop),
        supports_tablet = coalesce((v_manifest->>'supportsTablet')::boolean, supports_tablet),
        supports_mobile = coalesce((v_manifest->>'supportsMobile')::boolean, supports_mobile),
        min_players = v_min_players, max_players = v_max_players,
        runtime = 'iframe'::public.game_runtime, sdk_version = v_sub.sdk_version,
        status = 'active'::public.game_status, updated_at = now()
      where id = v_game_id;
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'is_multiplayer'
  ) then
    execute format(
      'update public.games set is_multiplayer = $1 where id = $2'
    ) using v_supports_mp, v_game_id;
  end if;

  if v_has_builds_updated_at then
    update public.game_builds
    set is_active = false, updated_at = now()
    where game_id = v_game_id and is_active = true;

    update public.game_builds
    set build_url = p_build_url, is_active = true, updated_at = now()
    where game_id = v_game_id and version = v_sub.version;

    if not found then
      insert into public.game_builds (game_id, version, build_url, is_active)
      values (v_game_id, v_sub.version, p_build_url, true);
    end if;
  else
    update public.game_builds
    set is_active = false
    where game_id = v_game_id and is_active = true;

    update public.game_builds
    set build_url = p_build_url, is_active = true
    where game_id = v_game_id and version = v_sub.version;

    if not found then
      insert into public.game_builds (game_id, version, build_url, is_active)
      values (v_game_id, v_sub.version, p_build_url, true);
    end if;
  end if;

  insert into public.game_stats (game_id)
  values (v_game_id)
  on conflict (game_id) do nothing;

  if jsonb_typeof(v_manifest->'categories') = 'array' then
    delete from public.game_categories where game_id = v_game_id;

    for v_cat_slug in
      select distinct lower(trim(value))
      from jsonb_array_elements_text(v_manifest->'categories') as t(value)
      where trim(value) <> ''
    loop
      select c.id into v_cat_id from public.categories c where c.slug = v_cat_slug;
      if v_cat_id is not null then
        insert into public.game_categories (game_id, category_id)
        values (v_game_id, v_cat_id)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_manifest->'tags') = 'array' then
    delete from public.game_tags where game_id = v_game_id;

    for v_tag_slug in
      select distinct lower(trim(value))
      from jsonb_array_elements_text(v_manifest->'tags') as t(value)
      where trim(value) <> ''
    loop
      select t.id into v_tag_id from public.tags t where t.slug = v_tag_slug;

      if v_tag_id is null then
        insert into public.tags (slug, name, name_en)
        values (
          v_tag_slug,
          initcap(replace(v_tag_slug, '-', ' ')),
          initcap(replace(v_tag_slug, '-', ' '))
        )
        returning id into v_tag_id;
      end if;

      insert into public.game_tags (game_id, tag_id)
      values (v_game_id, v_tag_id)
      on conflict do nothing;
    end loop;
  end if;

  if jsonb_typeof(v_manifest->'achievements') = 'array' then
    for v_ach in select * from jsonb_array_elements(v_manifest->'achievements')
    loop
      v_ach_code := upper(trim(v_ach->>'code'));
      if v_ach_code is null or v_ach_code = '' then
        continue;
      end if;

      v_ach_slug := lower(regexp_replace(v_ach_code, '[^a-zA-Z0-9]+', '_', 'g'));

      if v_has_achievements_game_id and v_has_achievements_updated_at then
        update public.achievements
        set
          name = coalesce(v_ach->>'name', v_ach_code),
          description = coalesce(v_ach->>'description', ''),
          game_id = coalesce(public.achievements.game_id, v_game_id),
          updated_at = now()
        where slug = v_ach_slug;
      elsif v_has_achievements_game_id then
        update public.achievements
        set
          name = coalesce(v_ach->>'name', v_ach_code),
          description = coalesce(v_ach->>'description', ''),
          game_id = coalesce(public.achievements.game_id, v_game_id)
        where slug = v_ach_slug;
      elsif v_has_achievements_updated_at then
        update public.achievements
        set
          name = coalesce(v_ach->>'name', v_ach_code),
          description = coalesce(v_ach->>'description', ''),
          updated_at = now()
        where slug = v_ach_slug;
      else
        update public.achievements
        set
          name = coalesce(v_ach->>'name', v_ach_code),
          description = coalesce(v_ach->>'description', '')
        where slug = v_ach_slug;
      end if;

      if not found then
        if v_has_achievements_code
           and v_has_achievements_category
           and v_has_achievements_points
           and v_has_achievements_game_id then
          insert into public.achievements (
            code, slug, name, description, icon, category, game_id, points
          )
          values (
            v_ach_code, v_ach_slug,
            coalesce(v_ach->>'name', v_ach_code),
            coalesce(v_ach->>'description', ''),
            coalesce(v_ach->>'icon', 'trophy'),
            'future_game', v_game_id, 10
          );
        elsif v_has_achievements_code and v_has_achievements_game_id then
          insert into public.achievements (
            code, slug, name, description, icon, game_id
          )
          values (
            v_ach_code, v_ach_slug,
            coalesce(v_ach->>'name', v_ach_code),
            coalesce(v_ach->>'description', ''),
            coalesce(v_ach->>'icon', 'trophy'),
            v_game_id
          );
        else
          insert into public.achievements (slug, name, description, icon)
          values (
            v_ach_slug,
            coalesce(v_ach->>'name', v_ach_code),
            coalesce(v_ach->>'description', ''),
            coalesce(v_ach->>'icon', 'trophy')
          );
        end if;
      end if;
    end loop;
  end if;

  update public.game_submissions
  set
    status = 'published',
    published_game_id = v_game_id,
    reviewed_by = auth.uid(),
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
  where id = p_id;

  return json_build_object('ok', true, 'game_id', v_game_id, 'slug', v_slug);
end;
$$;

revoke all on function public.admin_publish_submission(uuid, text, text, text) from public;
grant execute on function public.admin_publish_submission(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
