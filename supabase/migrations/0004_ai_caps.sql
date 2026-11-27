-- AI 次数改成可调 (Lucas 2026-11-25, 游戏设计 rev 459): no daily limit for now, but the caps are settings, and one
-- account can be capped on its own. NULL = unlimited. Usage is still counted per player and day, to watch costs.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check check (kind in ('grade', 'duel', 'essay'));

create table if not exists public.ai_settings (
  id int primary key default 1 check (id = 1),
  grade_cap int,
  duel_cap int,
  essay_cap int,
  enabled boolean not null default true
);
insert into public.ai_settings (id) values (1) on conflict (id) do nothing;
alter table public.ai_settings enable row level security;
create policy "ai_settings: read" on public.ai_settings for select to authenticated using (true);

-- Per-account daily cap over all kinds (the switch for one account); NULL or no row = no own cap.
create table if not exists public.ai_user_caps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_cap int
);
alter table public.ai_user_caps enable row level security;
create policy "ai_user_caps: read own" on public.ai_user_caps for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.ai_take(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  st public.ai_settings;
  cap int;
  ucap int;
  today date := (now() at time zone 'Europe/Berlin')::date;
  used_kind int;
  used_all int;
begin
  if auth.uid() is null or p_kind not in ('grade', 'duel', 'essay') then return false; end if;
  select * into st from public.ai_settings where id = 1;
  if st.enabled is false then return false; end if;
  cap := case p_kind when 'grade' then st.grade_cap when 'duel' then st.duel_cap else st.essay_cap end;
  select daily_cap into ucap from public.ai_user_caps where user_id = auth.uid();
  select coalesce(sum(n), 0) into used_all from public.ai_usage where user_id = auth.uid() and day = today;
  if ucap is not null and used_all >= ucap then return false; end if;
  insert into public.ai_usage (user_id, day, kind, n) values (auth.uid(), today, p_kind, 0)
    on conflict (user_id, day, kind) do nothing;
  update public.ai_usage set n = n + 1
    where user_id = auth.uid() and day = today and kind = p_kind and (cap is null or n < cap)
    returning n into used_kind;
  return used_kind is not null;
end $$;
revoke execute on function public.ai_take(text) from public, anon;
grant execute on function public.ai_take(text) to authenticated;
