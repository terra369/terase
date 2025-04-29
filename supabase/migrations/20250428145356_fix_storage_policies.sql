alter table storage.objects enable row level security;

drop policy if exists "audio_insert"  on storage.objects;
drop policy if exists "audio_owner_rw" on storage.objects;

create policy "audio_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'diary-audio'
  );


create policy "audio_owner_rw"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'diary-audio'
    and owner    = auth.uid()
  );