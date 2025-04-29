-- objects テーブルに RLS を有効化
alter table storage.objects enable row level security;

-- オーナーのみ INSERT / SELECT / DELETE 可
create policy "audio_owner_rw"
  on storage.objects
  for all
  using  (bucket_id = 'diary-audio' and owner = auth.uid())
  with check (bucket_id = 'diary-audio' and owner = auth.uid());