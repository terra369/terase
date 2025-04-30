/* ===========================================================
   1) diaries テーブル : “自分 or 同日の日記を書いた友だち” だけ SELECT
   ========================================================== */

drop policy if exists diaries_select_self_or_friend_date on public.diaries;

create policy diaries_select_self_or_friend_date
  on public.diaries
  for select
  using (
    /* ① 自分自身 */
    user_id = auth.uid()

    /* ② 友だち かつ 同じ date に日記を持っている */
    or exists (
      select 1
        from public.friends f
       where f.status = 'accepted'
         and (
           (f.user_id = auth.uid()       and f.friend_user_id = diaries.user_id) or
           (f.friend_user_id = auth.uid() and f.user_id       = diaries.user_id)
         )
         /* 同じ日付で自分の日記が存在することを確認 */
         and exists (
           select 1
             from public.diaries my
            where my.user_id = auth.uid()
              and my.date    = diaries.date
         )
    )
  );


/* ===========================================================
   2) diary_messages ビュー (行単位) も同じルールで SELECT 制御
   ========================================================== */

drop policy if exists diary_messages_friend_same_day on public.diary_messages;

create policy diary_messages_friend_same_day
  on public.diary_messages
  for select
  using (
    /* 参照先 diaries が見える行だけ */
    exists (
      select 1
        from public.diaries d
       where d.id = diary_messages.diary_id
         and (
           /* 自分自身 */
           d.user_id = auth.uid()
           /* 友だち + 同日条件は diaries 側のポリシーで保証済み */
         )
    )
  );


/* ===========================================================
   3) diary-audio バケット (AI 音声含む) SELECT 制御
   ========================================================== */

drop policy if exists audio_friend_same_day on storage.objects;

create policy audio_friend_same_day
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'diary-audio' and
    (
      /* owner = 自分 (ユーザー録音 & AI音声どちらも) */
      owner = auth.uid()

      /* 友だち + 同日の日記を持つ場合 */
      or exists (
        select 1
          from public.diaries d
         where d.user_id = owner               -- owner は音声ファイルの持ち主
           and exists (
             select 1
               from public.friends f
              where f.status = 'accepted'
                and (
                  (f.user_id = auth.uid()       and f.friend_user_id = d.user_id)
                  or
                  (f.friend_user_id = auth.uid() and f.user_id       = d.user_id)
                )
           )
           /* 自分も同じ date の日記があること */
           and exists (
             select 1
               from public.diaries my
              where my.user_id = auth.uid()
                and my.date    = d.date
           )
      )
    )
  );