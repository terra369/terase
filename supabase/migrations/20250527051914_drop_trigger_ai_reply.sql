begin;

-- Drop the trigger
drop trigger if exists tr_diary_messages_ai_reply on public.diary_messages;

-- Drop the function
drop function if exists trigger_ai_reply();

commit;