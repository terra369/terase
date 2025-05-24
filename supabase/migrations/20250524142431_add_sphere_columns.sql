-- Add sphere companion columns to profiles table
alter table public.profiles
  add column sphere_name text not null default 'JARVIS',
  add column sphere_img_url text not null default 'https://example.com/default-sphere.png';

-- Add sphere companion columns to diary_messages table for AI responses
-- Note: diary_messages.role = 'ai' will store sphere responses
-- The text and audio_url columns already exist for storing sphere responses