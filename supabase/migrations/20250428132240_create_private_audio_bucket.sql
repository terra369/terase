insert into storage.buckets (id, name, public)
values (uuid_generate_v4(),
        'diary-audio',
        false)
on conflict (name) do nothing;