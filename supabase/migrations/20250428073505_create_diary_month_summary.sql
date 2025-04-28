create or replace view public.diary_month_summary as
select
  user_id,
  date,
  mood_emoji,
  count(*) as cnt
from public.diaries
group by user_id, date, mood_emoji;

-- ビュー経由でも diaries の RLS が必ず適用されるようにする
alter view public.diary_month_summary
  set (security_barrier = true);

-- 自分 or 友だちの日記だけ見えるようにポリシーを追加
create policy "view_own_or_friend"
  on public.diary_month_summary
  for select
  using (
    auth.uid() = user_id
    or exists (
        select 1 from public.friends
        where user_id = auth.uid()
          and friend_user_id = diary_month_summary.user_id
          and status = 'accepted'
    )
  );