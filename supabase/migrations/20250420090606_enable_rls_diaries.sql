alter table diaries
  enable row level security;

-- 自分の行だけ SELECT
create policy "select own"
  on diaries
  for select
  using (user_id = auth.uid());

-- 自分の行だけ INSERT
create policy "insert own"
  on diaries
  for insert
  with check (user_id = auth.uid());

-- 自分の行だけ UPDATE
create policy "update own"
  on diaries
  for update
  using (user_id = auth.uid());