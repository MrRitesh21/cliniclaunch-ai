-- Policies for the clinic-media bucket (bucket must be created via the Storage dashboard).
drop policy if exists "clinic-media public read" on storage.objects;
drop policy if exists "clinic-media authenticated upload own" on storage.objects;
drop policy if exists "clinic-media authenticated update own" on storage.objects;
drop policy if exists "clinic-media authenticated delete own" on storage.objects;

create policy "clinic-media public read"
on storage.objects for select
using (bucket_id = 'clinic-media');

create policy "clinic-media authenticated upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clinic-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "clinic-media authenticated update own"
on storage.objects for update to authenticated
using (
  bucket_id = 'clinic-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "clinic-media authenticated delete own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'clinic-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);