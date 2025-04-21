alter table public.diaries
  add column mood_emoji text check
(char_length
(mood_emoji) <= 4);

-- 既に RLS を有効化している場合は不要だが、念のため確約
alter table public.diaries enable row level security;