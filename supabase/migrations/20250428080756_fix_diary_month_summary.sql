drop view if exists public.diary_month_summary cascade;

create or replace view public.diary_month_summary as
select
  user_id,
  date,
  mood_emoji,
  count(*) as cnt
from public.diaries
group by user_id, date, mood_emoji;

alter view public.diary_month_summary
  set (security_barrier = true);