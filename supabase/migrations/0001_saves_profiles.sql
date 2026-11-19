-- Wortklinge 0.3: cloud saves + leaderboard profiles. Each player reads/writes only their own save;
-- every logged-in player can read profiles (nickname, level, class, named words) for the leaderboard.

create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "saves: read own" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves: insert own" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves: update own" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (char_length(nickname) between 1 and 16),
  level int not null default 1,
  cls text,
  named int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: logged-in read" on public.profiles for select to authenticated using (true);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create index if not exists profiles_rank on public.profiles (level desc, named desc);
