begin;

/* --------------------------------------------------
   0) 共通 : “auth.uid が 同じ日付に日記を持つか”
-------------------------------------------------- */
create or replace function public.user_has_diary_on(_date date)
returns boolean
language sql
security definer          -- ← ポリシーより高権限で実行
set search_path = public
as $$
  select exists (
    select 1 from public.diaries
     where user_id = auth.uid()
       and date     = _date
  );
$$;

/* --------------------------------------------------
   1) diaries の SELECT ポリシーを置き換え
-------------------------------------------------- */
drop policy if exists diaries_select_self_or_friend_date on public.diaries;

create policy diaries_select_self_or_friend_date
  on public.diaries
  for select
  using (
    user_id = auth.uid()                     -- 自分
    or (
         public.user_has_diary_on(date)      -- 同日書いている
       and exists (                          -- 友だち判定
         select 1 from public.friends f
          where f.status = 'accepted'
            and (
              (f.user_id = auth.uid()       and f.friend_user_id = diaries.user_id)
              or
              (f.friend_user_id = auth.uid() and f.user_id       = diaries.user_id)
            )
       )
    )
  );

/* --------------------------------------------------
   2) storage.objects の SELECT ポリシーも置き換え
-------------------------------------------------- */
drop policy if exists audio_friend_same_day on storage.objects;

create policy audio_friend_same_day
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'diary-audio' and (
      owner = auth.uid()                                   -- 本人
      or (
           exists (                                        -- 友だち判定
             select 1 from public.friends f
              where f.status = 'accepted'
                and (
                  (f.user_id = auth.uid()       and f.friend_user_id = owner)
                  or
                  (f.friend_user_id = auth.uid() and f.user_id       = owner)
                )
           )
        and public.user_has_diary_on(                      -- 同日書いている
              (select d.date
                 from public.diaries d
                where d.user_id = owner
                limit 1) )      -- owner の日記は (unique user_id,date)なので 1行
      )
    )
  );

commit;