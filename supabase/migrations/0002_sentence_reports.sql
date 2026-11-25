-- 「这句有问题」: players flag a German sentence they think is wrong. Each logged-in player can add reports and
-- read only their own; nobody can change or delete them from the game. The developer reads them in the dashboard.
create table if not exists public.sentence_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sentence_hash text not null check (char_length(sentence_hash) between 1 and 16),
  sentence text not null check (char_length(sentence) between 1 and 500),
  reason text not null check (reason in ('wrong', 'unnatural', 'translation', 'grading', 'other')),
  note text check (char_length(note) <= 500),
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) < 4000),
  game_version text check (char_length(game_version) <= 20),
  status text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.sentence_reports enable row level security;
create policy "sentence_reports: insert own" on public.sentence_reports for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'open');
create policy "sentence_reports: read own" on public.sentence_reports for select to authenticated
  using ((select auth.uid()) = user_id);
create index if not exists sentence_reports_hash on public.sentence_reports (sentence_hash);
create index if not exists sentence_reports_user_time on public.sentence_reports (user_id, created_at desc);

-- At most 30 reports per player per day, so a stuck key cannot flood the table.
create or replace function public.sentence_reports_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.sentence_reports r
      where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many reports today';
  end if;
  return new;
end $$;
revoke execute on function public.sentence_reports_limit() from public, anon, authenticated;
drop trigger if exists sentence_reports_limit on public.sentence_reports;
create trigger sentence_reports_limit before insert on public.sentence_reports
  for each row execute function public.sentence_reports_limit();
