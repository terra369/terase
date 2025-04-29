-- =============================================
-- A) 既存ユーザーにプロフィール行を作成
-- =============================================
insert into public.profiles (id)
select id
  from auth.users
 where not exists (
   select 1 from public.profiles p where p.id = auth.users.id
 );

-- =============================================
-- B) トリガー：新規ユーザーにも自動作成
-- =============================================
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_profile on auth.users;
create trigger trg_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- =============================================
-- C) diaries.user_id → auth.users.id へ FK を張り直し
-- =============================================
alter table public.diaries
    drop constraint if exists diaries_user_id_fkey,
    add constraint diaries_user_id_fkey
      foreign key (user_id) references auth.users(id)
      on delete cascade;

-- =============================================
-- D) profiles カラムを NULL 許容に変更
--    （すでに対応済みの場合は no-op）
-- =============================================
alter table public.profiles
  alter column fairy_name drop not null,
  alter column fairy_img_url drop not null;