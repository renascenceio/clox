-- Sign-in from Gaia CRM (2026-11-13).
-- Each ticket the CRM signs can be used once: its nonce is recorded here.
-- Server only (service role); nobody else can read or write it.

create table if not exists public.sso_nonces (
  nonce      text primary key,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.sso_nonces enable row level security;
revoke all on public.sso_nonces from anon, authenticated;

create index if not exists sso_nonces_created on public.sso_nonces (created_at);
