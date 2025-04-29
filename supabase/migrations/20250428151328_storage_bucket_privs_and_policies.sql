/* =========================================================
   STORAGE: バケット行 + 権限 + RLS を再整備
   ========================================================= */

begin;

grant insert, select, update, delete
  on table storage.objects
  to authenticated;

drop policy if exists "audio_insert"  on storage.objects;
drop policy if exists "audio_owner_rw" on storage.objects;

create policy "audio_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'diary-audio');

create policy "audio_owner_rw"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'diary-audio' and owner = auth.uid());

commit;