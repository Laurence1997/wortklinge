-- 排行榜 (Lucas 2026-11-25): 每日榜、总榜、语法榜, study volume only; hidden players are left out.
-- Reads the counters the client keeps in saves.data->'board' (src/core/board.ts). Applied 2026-11-25.
create or replace function public.leaderboard(kind text, lim integer default 20)
returns table(pos integer, nickname text, level integer, score integer, extra integer, me boolean)
language sql stable security definer set search_path to 'public'
as $function$
  with b as (
    select s.user_id, p.nickname, p.level,
           s.data->'board' as bd
    from saves s join profiles p on p.id = s.user_id
    where coalesce((s.data->'board'->>'hidden')::boolean, false) = false
  ), scored as (
    select user_id, nickname, level,
      case kind
        when 'daily' then case when bd->>'day' = to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') then coalesce((bd->>'daily')::int, 0) else 0 end
        when 'total' then coalesce((bd->>'mastered')::int, 0)
        when 'gram' then coalesce((bd->>'trials')::int, 0)
      end as score,
      case kind
        when 'total' then level
        when 'gram' then case when coalesce((bd->>'gramN')::int, 0) > 0 then round(100.0 * coalesce((bd->>'gramOk')::int, 0) / (bd->>'gramN')::int)::int else 0 end
        else 0
      end as extra,
      coalesce((bd->>'gramN')::int, 0) as gram_n
    from b
  )
  select (row_number() over (order by score desc, extra desc, level desc))::int as pos, nickname, level, score, extra, user_id = auth.uid() as me
  from scored
  where score > 0 and (kind <> 'gram' or gram_n >= 50)
  order by score desc, extra desc, level desc
  limit greatest(1, least(lim, 100));
$function$;

revoke all on function public.leaderboard(text, integer) from public, anon;
grant execute on function public.leaderboard(text, integer) to authenticated;
