begin;

create table if not exists public.diary_messages (
  id          bigserial primary key,
  diary_id    int  not null references public.diaries(id) on delete cascade,
  role        text not null check (role in ('user','ai')),
  text        text,
  audio_url   text,
  created_at  timestamptz default now()
);
alter table public.diary_messages enable row level security;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'diaries'
       and column_name  = 'user_text'
  ) then
    insert into public.diary_messages (diary_id, role, text, audio_url, created_at)
    select id, 'user', user_text, user_audio_url, created_at
      from public.diaries
     where user_text is not null
       and not exists (
             select 1 from public.diary_messages m
              where m.diary_id = public.diaries.id
       );
  end if;
end;
$$;

alter table public.profiles
  drop column if exists fairy_name,
  drop column if exists fairy_img_url;

alter table public.diaries
  drop column if exists fairy_text,
  drop column if exists fairy_audio_url,
  drop column if exists user_text,
  drop column if exists user_audio_url;

drop policy if exists msg_select_owner_friend on public.diary_messages;
create policy msg_select_owner_friend
  on public.diary_messages for select
  using (
    exists (
      select 1 from public.diaries d
       where d.id = diary_messages.diary_id
         and (
           d.user_id = auth.uid()
           or exists (
               select 1
                 from public.friends
                where user_id        = auth.uid()
                  and friend_user_id = d.user_id
                  and status         = 'accepted'
           )
         )
    )
  );

drop policy if exists msg_insert_owner on public.diary_messages;
create policy msg_insert_owner
  on public.diary_messages for insert
  with check (
    exists (
      select 1 from public.diaries d
       where d.id      = diary_messages.diary_id
         and d.user_id = auth.uid()
    )
  );

insert into public.profiles (id)
select id
  from auth.users
 where not exists (
       select 1 from public.profiles p where p.id = auth.users.id
 );

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

drop trigger if exists trg_create_profile on auth.users;
create trigger trg_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

commit;