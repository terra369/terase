-- バケットの id を name と同じ文字列に揃える
begin;

-- 1) もし uuid の行がすでにある場合は id を更新
update storage.buckets
   set id = 'diary-audio'
 where name = 'diary-audio';

-- 2) 無ければ挿入（再実行に備えて ON CONFLICT）
insert into storage.buckets (id, name, public)
values ('diary-audio', 'diary-audio', false)
on conflict (name) do update
  set id = excluded.id;

commit;