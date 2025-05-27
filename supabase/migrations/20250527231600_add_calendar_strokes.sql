-- Add stroke functionality to calendar
begin;

-- Create calendar_strokes table for storing drawing data
create table if not exists public.calendar_strokes (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  stroke_data jsonb not null, -- stores path data, color, thickness, etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on calendar_strokes
alter table public.calendar_strokes enable row level security;

-- RLS policies for calendar_strokes
create policy "calendar_strokes_select_owner"
  on public.calendar_strokes for select
  using (auth.uid() = user_id);

create policy "calendar_strokes_insert_owner"
  on public.calendar_strokes for insert
  with check (auth.uid() = user_id);

create policy "calendar_strokes_update_owner"
  on public.calendar_strokes for update
  using (auth.uid() = user_id);

create policy "calendar_strokes_delete_owner"
  on public.calendar_strokes for delete
  using (auth.uid() = user_id);

-- Create index for efficient date-based queries
create index idx_calendar_strokes_user_date 
  on public.calendar_strokes(user_id, date);

-- Create trigger function for updated_at
create or replace function public.update_calendar_strokes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger for auto-updating updated_at column
create trigger trg_calendar_strokes_updated_at
  before update on public.calendar_strokes
  for each row execute function public.update_calendar_strokes_updated_at();

commit;