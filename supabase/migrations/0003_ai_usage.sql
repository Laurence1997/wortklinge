-- AI 批改 / 决斗场 (40 级, Lucas 2026-11-25): a daily cap per player. The edge function `ai-tutor` calls
-- ai_take() with the player's own token before every model call; the row is per player and day.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'Europe/Berlin')::date,
  kind text not null check (kind in ('grade', 'duel')),
  n int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security;
create policy "ai_usage: read own" on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);

-- Takes one use of today's quota for the calling player; false when the cap is reached.
create or replace function public.ai_take(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  cap int := case p_kind when 'grade' then 40 when 'duel' then 60 else 0 end;
  used int;
begin
  if auth.uid() is null or cap = 0 then return false; end if;
  insert into public.ai_usage (user_id, kind, n) values (auth.uid(), p_kind, 0)
    on conflict (user_id, day, kind) do nothing;
  update public.ai_usage set n = n + 1
    where user_id = auth.uid() and day = (now() at time zone 'Europe/Berlin')::date and kind = p_kind and n < cap
    returning n into used;
  return used is not null;
end $$;
revoke execute on function public.ai_take(text) from public, anon;
grant execute on function public.ai_take(text) to authenticated;
