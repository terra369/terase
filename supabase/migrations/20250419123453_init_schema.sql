-- ========== profiles ==========
create table public.profiles
(
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    fairy_name text not null,
    fairy_img_url text not null,
    created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- ========== diaries ==========
create table public.diaries
(
    id serial primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    date date not null,
    user_text text not null,
    fairy_text text not null,
    user_audio_url text,
    fairy_audio_url text,
    visibility text default 'friends',
    -- 'friends' | 'private'
    created_at timestamptz default now(),
    unique (user_id, date)
);
alter table public.diaries enable row level security;

-- ========== friends ==========
create table public.friends
(
    user_id uuid,
    friend_user_id uuid,
    status text default 'accepted',
    -- pending/accepted
    created_at timestamptz default now(),
    primary key (user_id, friend_user_id),
    check (user_id <> friend_user_id),
    foreign key (user_id)        references public.profiles(id) on delete cascade,
    foreign key (friend_user_id) references public.profiles(id) on delete cascade
);
alter table public.friends enable row level security;

-- ========== invites ==========
create table public.invites
(
    code text primary key,
    inviter_id uuid references public.profiles(id) on delete cascade,
    status text default 'pending',
    -- used/expired
    created_at timestamptz default now()
);
alter table public.invites enable row level security;

-- ========== RLS Policies ==========

-- 自分 or 友だちだけ diaries を参照
create policy "diaries_select_self_or_friend"
  on public.diaries for
select
    using (
    auth.uid() = user_id
        or exists (
        select 1
        from public.friends
        where user_id = auth.uid()
            and friend_user_id = diaries.user_id
            and status = 'accepted'
    )
  );
