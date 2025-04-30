/* --------------------------------------------------------------
   set_storage_owner(bucket name, object name, new_owner uuid)
   --------------------------------------------------------------*/
create or replace function public.set_storage_owner(
  p_bucket text,
  p_name   text,
  p_owner  uuid
)
returns void
language sql
security definer
set search_path = storage
as $$
  update storage.objects
     set owner = p_owner
   where bucket_id = p_bucket
     and name      = p_name;
$$;

grant execute on function public.set_storage_owner(text,text,uuid)
  to anon, authenticated;