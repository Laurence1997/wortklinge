-- 凭邀请码自己注册 (Lucas 2026-11-28, PRD「登录」). Players sign up on the login page with an invite code,
-- email and password; no confirmation mail (Supabase's own mailer only reaches team members), so
-- "Confirm email" is off in the dashboard. A trigger on auth.users refuses every sign-up without a valid
-- code, which also closes the public sign-up endpoint that was open before (disable_signup = false).
-- The codes themselves live only in the table, never in this public repo: Lucas inserts them by hand.
-- Admin invites (invited_at set) pass; the dashboard's "Add user" is refused like any other sign-up.

create table if not exists public.invite_codes (
  code text primary key check (code = lower(code)),
  max_uses int not null default 1,
  used int not null default 0,
  note text,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
-- No policies: nobody reads or writes it through the API; only the functions below touch it.

-- Lets the sign-up form say "wrong code" before trying (a failed trigger only gives a generic error).
create or replace function public.check_invite(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.invite_codes where code = lower(trim(p_code)) and used < max_uses);
$$;
revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

create or replace function public.enforce_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c text := lower(trim(coalesce(new.raw_user_meta_data->>'invite', '')));
begin
  if new.invited_at is not null then return new; end if;
  update public.invite_codes set used = used + 1 where code = c and used < max_uses;
  if not found then raise exception 'invalid invite code'; end if;
  return new;
end $$;
revoke execute on function public.enforce_invite() from public, anon, authenticated;
drop trigger if exists enforce_invite on auth.users;
create trigger enforce_invite before insert on auth.users for each row execute function public.enforce_invite();

-- New accounts get a default daily AI cap (all kinds together, see ai_take in 0004); Lucas can change it per account.
create or replace function public.new_user_ai_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ai_user_caps (user_id, daily_cap) values (new.id, 40) on conflict (user_id) do nothing;
  return new;
end $$;
revoke execute on function public.new_user_ai_cap() from public, anon, authenticated;
drop trigger if exists new_user_ai_cap on auth.users;
create trigger new_user_ai_cap after insert on auth.users for each row execute function public.new_user_ai_cap();

-- 全服聊天举报: what was reported, by whom; Lucas reads it in the dashboard. Players can only add rows.
create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nick text not null check (length(nick) <= 40),
  text text not null check (length(text) <= 400),
  msg_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.chat_reports enable row level security;
create policy "chat_reports: add own" on public.chat_reports for insert to authenticated with check ((select auth.uid()) = reporter);
