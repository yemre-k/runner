create table if not exists public.runner_events (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  player_pseudo_id text not null,
  display_name text,
  session_id   text not null,
  game_id      text not null,
  event_type   text not null,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists runner_events_game_idx   on public.runner_events (game_id);
create index if not exists runner_events_player_idx on public.runner_events (player_pseudo_id);

alter table public.runner_events enable row level security;

-- anon may INSERT play events only; no select/update/delete for anon.
drop policy if exists "anon insert events" on public.runner_events;
create policy "anon insert events"
  on public.runner_events for insert to anon with check (true);

-- Leaderboard: aggregated, no raw-event access, no real identity.
create or replace function public.get_leaderboard(p_game_id text, p_limit int default 20)
returns table (rank bigint, display_name text, best_score numeric, sessions bigint, last_played timestamptz)
language sql security definer set search_path = public as $$
  with per_player as (
    select e.player_pseudo_id,
           coalesce(max(nullif(e.display_name,'')), e.player_pseudo_id) as name,
           max((e.payload->>'score')::numeric) filter (where e.event_type='score_update') as best_score,
           count(distinct e.session_id) as sessions,
           max(e.ts) as last_played
    from public.runner_events e
    where e.game_id = p_game_id
    group by e.player_pseudo_id
  )
  select row_number() over (order by best_score desc nulls last, last_played asc) as rank,
         name, coalesce(best_score,0), sessions, last_played
  from per_player
  order by best_score desc nulls last, last_played asc
  limit greatest(p_limit,1);
$$;
grant execute on function public.get_leaderboard(text,int) to anon;
