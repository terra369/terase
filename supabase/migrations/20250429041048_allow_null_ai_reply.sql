begin;

-- AI 返信列を NULL 許容に
alter table public.diaries
  alter column fairy_text drop not null;

commit;