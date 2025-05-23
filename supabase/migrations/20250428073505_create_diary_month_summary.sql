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