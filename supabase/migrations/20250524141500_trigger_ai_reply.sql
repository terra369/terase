begin;

-- Create function to trigger AI reply when user message is inserted
create or replace function trigger_ai_reply()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only trigger for user messages
  if new.role = 'user' then
    -- Call the ai_reply edge function
    perform net.http_post(
      url := 'https://' || get_app_setting('SUPABASE_PROJECT_REF') || '.supabase.co/functions/v1/ai_reply',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_app_setting('SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := jsonb_build_object('record', row_to_json(new))
    );
  end if;
  
  return new;
end;
$$;

-- Create trigger
drop trigger if exists tr_diary_messages_ai_reply on public.diary_messages;
create trigger tr_diary_messages_ai_reply
  after insert on public.diary_messages
  for each row execute function trigger_ai_reply();

commit;