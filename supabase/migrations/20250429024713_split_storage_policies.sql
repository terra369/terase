begin;

-- 1. 旧ポリシー削除
drop policy if exists audio_owner_rw on storage.objects;

-- 2. INSERT 用（そのまま）
drop policy if exists audio_insert on storage.objects;
create policy audio_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'diary-audio');

-- 3. SELECT / UPDATE / DELETE 用に分割 3 本
create policy audio_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'diary-audio' and owner = auth.uid());

create policy audio_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'diary-audio' and owner = auth.uid());

create policy audio_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'diary-audio' and owner = auth.uid());

commit;