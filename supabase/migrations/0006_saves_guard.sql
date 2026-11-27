-- 审查 A2 (2026-11-26): a stale pre-0.8 page must not write an old-format save over a new one (0.8 would wipe it a
-- second time). An update that would lower data.lexicon (or drop it) is skipped silently, so the old page sees no
-- error and the new save stays.
create or replace function public.saves_keep_lexicon() returns trigger
language plpgsql set search_path = public as $$
declare
  o int := coalesce(case when (old.data->>'lexicon') ~ '^\d+$' then (old.data->>'lexicon')::int end, 0);
  n int := coalesce(case when (new.data->>'lexicon') ~ '^\d+$' then (new.data->>'lexicon')::int end, 0);
begin
  if o >= 1 and n < o then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists saves_keep_lexicon on public.saves;
create trigger saves_keep_lexicon before update on public.saves
  for each row execute function public.saves_keep_lexicon();
