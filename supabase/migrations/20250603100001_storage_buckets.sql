-- Document 03 — Storage buckets

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('game-assets', 'game-assets', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/javascript', 'text/css']),
  ('game-banners', 'game-banners', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('news', 'news', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Avatars: users upload to own folder
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Game assets & banners: public read, admin write
create policy "game_assets_public_read"
  on storage.objects for select
  using (bucket_id in ('game-assets', 'game-banners', 'news'));

create policy "game_assets_admin_write"
  on storage.objects for insert
  with check (
    bucket_id in ('game-assets', 'game-banners', 'news')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "game_assets_admin_update"
  on storage.objects for update
  using (
    bucket_id in ('game-assets', 'game-banners', 'news')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "game_assets_admin_delete"
  on storage.objects for delete
  using (
    bucket_id in ('game-assets', 'game-banners', 'news')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
