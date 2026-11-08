-- Accounts and credits lock-down (2026-11-08).
--
-- Before this:
--   * handle_new_user copied `role` from sign-up metadata, so anyone could
--     sign up as super_admin by passing options.data.role.
--   * profiles_update_own let a user change their own role / plan / is_active.
--   * credits_update_own / credits_insert_own let a user set their own balance.
--   * deduct_credits was executable by anon with any user id and amount
--     (zero anyone's balance, or add credit with a negative amount).
--   * usage_logs accepted inserts from anyone (rolled into project spend).

begin;

-- 1. New accounts are always plain users.
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

  insert into public.credits (user_id, balance_usd)
  values (new.id, 10.000000)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 2. Users can edit their own profile, but not the privileged columns.
--    Service-role code (admin API) and super admins still can.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if coalesce((select role from public.profiles where id = auth.uid()), '') = 'super_admin' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'user';
    new.plan := 'free';
    new.is_active := true;
  else
    new.role := old.role;
    new.plan := old.plan;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- 3. Balances only change on the server.
drop policy if exists credits_insert_own on public.credits;
drop policy if exists credits_update_own on public.credits;

-- 4. Only the server may deduct credits.
drop function if exists public.deduct_credits(uuid, numeric);
create function public.deduct_credits(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  remaining numeric;
begin
  if p_amount is null or p_amount <= 0 then
    select balance_usd into remaining from public.credits where user_id = p_user_id;
    return coalesce(remaining, 0);
  end if;
  update public.credits
     set balance_usd = greatest(balance_usd - p_amount, 0),
         updated_at  = now()
   where user_id = p_user_id
  returning balance_usd into remaining;
  return coalesce(remaining, 0);
end;
$$;
revoke execute on function public.deduct_credits(uuid, numeric) from public, anon, authenticated;
grant execute on function public.deduct_credits(uuid, numeric) to service_role;

-- 5. Email lookup is for signed-in users (project invites) only.
revoke execute on function public.get_user_id_by_email(text) from public, anon;
grant execute on function public.get_user_id_by_email(text) to authenticated, service_role;

-- 6. Usage rows are written by the server (service role bypasses RLS).
drop policy if exists usage_service_insert on public.usage_logs;
drop policy if exists usage_insert_own on public.usage_logs;

commit;
