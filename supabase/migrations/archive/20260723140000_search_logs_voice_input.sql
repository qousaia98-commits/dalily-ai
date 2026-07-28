-- Voice search analytics: which searches came from speech vs typing, and
-- the language Whisper detected. Additive, nullable — no backfill needed.
alter table public.search_logs
  add column if not exists input_mode text,
  add column if not exists voice_language text;

alter table public.search_logs
  drop constraint if exists search_logs_input_mode_check;

alter table public.search_logs
  add constraint search_logs_input_mode_check
  check (input_mode is null or input_mode in ('text', 'voice'));
