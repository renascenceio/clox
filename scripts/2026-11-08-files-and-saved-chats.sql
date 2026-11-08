-- Files the user created (decks, reports, images…) and chats saved on the
-- server. Until now both lived only in the browser's localStorage, so a new
-- device, another browser or a cleared cache lost everything.

-- One row per stored file in the private `chat-outputs` bucket.
create table if not exists public.chat_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id text not null,
  path text not null unique,
  filename text not null,
  mime text not null default 'application/octet-stream',
  size bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_files_user_updated on public.chat_files (user_id, updated_at desc);

alter table public.chat_files enable row level security;
drop policy if exists chat_files_own_select on public.chat_files;
create policy chat_files_own_select on public.chat_files for select using (user_id = auth.uid());
-- Writes go through the server (service role) so a row always matches a stored file.
revoke all on public.chat_files from anon;
grant select on public.chat_files to authenticated;

-- One row per chat: its sidebar record plus the conversation (text chats)
-- or the list of generations (image / video / voice).
create table if not exists public.saved_chats (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id text not null,
  modality text not null default 'text',
  record jsonb not null default '{}'::jsonb,
  history jsonb,
  history_bytes integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);
create index if not exists saved_chats_user_updated on public.saved_chats (user_id, updated_at desc);

alter table public.saved_chats enable row level security;
drop policy if exists saved_chats_own_select on public.saved_chats;
create policy saved_chats_own_select on public.saved_chats for select using (user_id = auth.uid());
drop policy if exists saved_chats_own_insert on public.saved_chats;
create policy saved_chats_own_insert on public.saved_chats for insert with check (user_id = auth.uid());
drop policy if exists saved_chats_own_update on public.saved_chats;
create policy saved_chats_own_update on public.saved_chats for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists saved_chats_own_delete on public.saved_chats;
create policy saved_chats_own_delete on public.saved_chats for delete using (user_id = auth.uid());
revoke all on public.saved_chats from anon;
grant select, insert, update, delete on public.saved_chats to authenticated;
