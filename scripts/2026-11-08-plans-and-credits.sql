-- Plans and credits (2026-11-08).
--
-- The dollar balance becomes credits (1 credit = $0.001 of model cost):
--   plan_credits   this month's grant, left over
--   carry_credits  last month's leftover grant, gone at period_end
--   topup_credits  bought packs, never expire
-- New accounts get the Free plan's monthly grant instead of $10.

begin;

alter table public.credits
  add column if not exists plan_credits  numeric(14, 2) not null default 0,
  add column if not exists carry_credits numeric(14, 2) not null default 0,
  add column if not exists topup_credits numeric(14, 2) not null default 0,
  add column if not exists period_start  timestamptz,
  add column if not exists period_end    timestamptz,
  add column if not exists stripe_customer_id  text,
  add column if not exists subscription_id     text,
  add column if not exists subscription_status text,
  add column if not exists billing_cycle       text;

alter table public.credits
  add column if not exists balance_credits numeric(14, 2)
  generated always as (plan_credits + carry_credits + topup_credits) stored;

create unique index if not exists credits_stripe_customer on public.credits (stripe_customer_id) where stripe_customer_id is not null;

alter table public.usage_logs add column if not exists credits numeric(14, 2) not null default 0;
create index if not exists usage_logs_user_day on public.usage_logs (user_id, created_at desc);

-- Existing dollar balances are kept as non-expiring credits.
update public.credits
   set topup_credits = round(balance_usd * 1000, 2),
       plan_credits  = 300,
       period_start  = now(),
       period_end    = now() + interval '1 month'
 where period_end is null;

alter table public.credits alter column balance_usd set default 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'user'
  )
  on conflict (id) do nothing;

  insert into public.credits (user_id, balance_usd, plan_credits, period_start, period_end)
  values (new.id, 0, 300, now(), now() + interval '1 month')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Starts a new period. Regular renewal: this period's leftover grant
-- carries over one month, the older carry-over expires. Plan change
-- (p_change): everything left is kept as carry-over.
create or replace function public.renew_credits(p_user_id uuid, p_grant numeric, p_period_end timestamptz, p_change boolean default false)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  total numeric;
begin
  update public.credits
     set carry_credits = case when p_change then carry_credits + plan_credits else plan_credits end,
         plan_credits  = greatest(p_grant, 0),
         period_start  = now(),
         period_end    = p_period_end,
         updated_at    = now()
   where user_id = p_user_id
     and (p_change or period_end is null or period_end <= now())
  returning balance_credits into total;
  return total;
end;
$$;

-- Spends the credits that expire first.
create or replace function public.spend_credits(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c record;
  left_to_take numeric := greatest(coalesce(p_amount, 0), 0);
  from_carry numeric;
  from_plan numeric;
  from_topup numeric;
  total numeric;
begin
  select * into c from public.credits where user_id = p_user_id for update;
  if not found then return 0; end if;
  from_carry := least(c.carry_credits, left_to_take); left_to_take := left_to_take - from_carry;
  from_plan  := least(c.plan_credits,  left_to_take); left_to_take := left_to_take - from_plan;
  from_topup := least(c.topup_credits, left_to_take);
  update public.credits
     set carry_credits = carry_credits - from_carry,
         plan_credits  = plan_credits  - from_plan,
         topup_credits = topup_credits - from_topup,
         updated_at    = now()
   where user_id = p_user_id
  returning balance_credits into total;
  return total;
end;
$$;

create or replace function public.add_topup_credits(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  total numeric;
begin
  update public.credits
     set topup_credits = topup_credits + greatest(p_amount, 0), updated_at = now()
   where user_id = p_user_id
  returning balance_credits into total;
  return total;
end;
$$;

revoke execute on function public.renew_credits(uuid, numeric, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.spend_credits(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.add_topup_credits(uuid, numeric) from public, anon, authenticated;
grant execute on function public.renew_credits(uuid, numeric, timestamptz, boolean) to service_role;
grant execute on function public.spend_credits(uuid, numeric) to service_role;
grant execute on function public.add_topup_credits(uuid, numeric) to service_role;

-- Each Stripe event is applied once.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

commit;
