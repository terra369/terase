-- 1) カラムを NULL 許容へ
alter table public.profiles
  alter column fairy_name drop not null,
  alter column fairy_img_url drop not null;

-- 2) トリガー & 関数
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles(id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger trg_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- 3) RLS ポリシー（存在しない場合のみ）
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'profiles_owner'
  ) then
    create policy "profiles_owner"
      on public.profiles
      for all
      using  (id = auth.uid())
      with check (id = auth.uid());
  end if;
end; $$;