-- MultiGrizz initial schema. Run once in the project's Supabase SQL Editor.
-- Fails atomically if these application objects already exist; never drops data.
begin;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members(user_id, team_id);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  role text not null check (char_length(btrim(role)) between 1 and 120),
  instructions text not null check (char_length(btrim(instructions)) between 1 and 8000),
  created_at timestamptz not null default now(),
  unique (id, team_id)
);
create index agents_team_created_idx on public.agents(team_id, created_at, id);

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  goal text not null default '' check (char_length(goal) <= 8000),
  created_at timestamptz not null default now(),
  unique (id, team_id)
);
create index squads_team_created_idx on public.squads(team_id, created_at, id);

create table public.squad_agents (
  team_id uuid not null references public.teams(id) on delete cascade,
  squad_id uuid not null,
  agent_id uuid not null,
  position integer not null default 0 check (position between 0 and 1000),
  primary key (squad_id, agent_id),
  foreign key (squad_id, team_id) references public.squads(id, team_id) on delete cascade,
  foreign key (agent_id, team_id) references public.agents(id, team_id) on delete cascade
);
create index squad_agents_team_squad_idx on public.squad_agents(team_id, squad_id, position, agent_id);
create index squad_agents_agent_idx on public.squad_agents(agent_id, team_id);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  squad_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  goal text not null check (char_length(btrim(goal)) between 1 and 8000),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  error text check (char_length(error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (squad_id, team_id) references public.squads(id, team_id) on delete cascade
);
create unique index runs_one_active_per_squad_idx on public.runs(squad_id)
  where status in ('queued', 'running');
create index runs_team_squad_created_idx on public.runs(team_id, squad_id, created_at desc, id);

create table public.context_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  squad_id uuid not null,
  kind text not null check (kind in ('note', 'result', 'handoff')),
  content text not null check (char_length(btrim(content)) between 1 and 16000),
  source_squad_id uuid,
  run_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (squad_id, team_id) references public.squads(id, team_id) on delete cascade,
  foreign key (source_squad_id, team_id) references public.squads(id, team_id) on delete cascade,
  foreign key (run_id, team_id) references public.runs(id, team_id),
  check (
    (kind = 'handoff' and source_squad_id is not null and source_squad_id <> squad_id)
    or (kind <> 'handoff' and source_squad_id is null)
  )
);
create index context_entries_team_squad_created_idx on public.context_entries(team_id, squad_id, created_at desc, id);
create index context_entries_source_idx on public.context_entries(source_squad_id, team_id)
  where source_squad_id is not null;
create index context_entries_run_idx on public.context_entries(run_id, team_id, squad_id)
  where run_id is not null;

create function public.touch_run_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
create trigger runs_touch_updated_at before update on public.runs
for each row execute function public.touch_run_updated_at();
revoke all on function public.touch_run_updated_at() from public, anon, authenticated;

-- SECURITY DEFINER deliberately avoids recursive team_members RLS lookup.
-- Only the current authenticated user's membership is inspected.
create function public.is_team_member(team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members as member
    where member.team_id = team and member.user_id = auth.uid()
  );
$$;
revoke all on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated, service_role;

create function public.create_team(team_name text)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  created_team public.teams;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if team_name is null or char_length(btrim(team_name)) not between 1 and 120 then
    raise exception 'Team name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  insert into public.teams(name, created_by)
    values (btrim(team_name), actor) returning * into created_team;
  insert into public.team_members(team_id, user_id) values (created_team.id, actor);
  return created_team;
end;
$$;
revoke all on function public.create_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;

create function public.join_team(code text)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  selected_team public.teams;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if code is null or code !~ '^[a-f0-9]{32}$' then
    raise exception 'Invalid invitation code' using errcode = '22023';
  end if;
  select * into selected_team from public.teams where invite_code = code;
  if not found then
    raise exception 'Invalid invitation code' using errcode = '22023';
  end if;
  insert into public.team_members(team_id, user_id)
    values (selected_team.id, actor) on conflict (team_id, user_id) do nothing;
  return selected_team;
end;
$$;
revoke all on function public.join_team(text) from public, anon;
grant execute on function public.join_team(text) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.agents enable row level security;
alter table public.squads enable row level security;
alter table public.squad_agents enable row level security;
alter table public.runs enable row level security;
alter table public.context_entries enable row level security;

revoke all on table public.teams, public.team_members, public.agents, public.squads,
  public.squad_agents, public.runs, public.context_entries from public, anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant select on table public.teams, public.team_members to authenticated;
grant update (name) on public.teams to authenticated;
grant select, insert, delete on table public.agents, public.squads, public.squad_agents,
  public.runs, public.context_entries to authenticated;
-- Do not let a member rewrite a row's team, origin, author, or timestamps.
grant update (name, role, instructions) on public.agents to authenticated;
grant update (name, goal) on public.squads to authenticated;
grant update (position) on public.squad_agents to authenticated;
grant update (status, error) on public.runs to authenticated;
grant update (content) on public.context_entries to authenticated;
grant all on table public.teams, public.team_members, public.agents, public.squads,
  public.squad_agents, public.runs, public.context_entries to service_role;

create policy teams_read on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_member(id)) with check (public.is_team_member(id));
create policy team_members_read on public.team_members for select to authenticated
  using (public.is_team_member(team_id));

create policy agents_read on public.agents for select to authenticated using (public.is_team_member(team_id));
create policy agents_insert on public.agents for insert to authenticated with check (public.is_team_member(team_id));
create policy agents_update on public.agents for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy agents_delete on public.agents for delete to authenticated using (public.is_team_member(team_id));

create policy squads_read on public.squads for select to authenticated using (public.is_team_member(team_id));
create policy squads_insert on public.squads for insert to authenticated with check (public.is_team_member(team_id));
create policy squads_update on public.squads for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy squads_delete on public.squads for delete to authenticated using (public.is_team_member(team_id));

create policy squad_agents_read on public.squad_agents for select to authenticated using (public.is_team_member(team_id));
create policy squad_agents_insert on public.squad_agents for insert to authenticated with check (public.is_team_member(team_id));
create policy squad_agents_update on public.squad_agents for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy squad_agents_delete on public.squad_agents for delete to authenticated using (public.is_team_member(team_id));

create policy runs_read on public.runs for select to authenticated using (public.is_team_member(team_id));
create policy runs_insert on public.runs for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy runs_update on public.runs for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy runs_delete on public.runs for delete to authenticated using (public.is_team_member(team_id));

create policy context_entries_read on public.context_entries for select to authenticated using (public.is_team_member(team_id));
create policy context_entries_insert on public.context_entries for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy context_entries_update on public.context_entries for update to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy context_entries_delete on public.context_entries for delete to authenticated using (public.is_team_member(team_id));

-- Supabase normally supplies this publication. Skip cleanly in plain Postgres.
-- Retain DEFAULT replica identity: deleted rows must not expose full context.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['teams', 'team_members', 'agents', 'squads', 'squad_agents', 'runs', 'context_entries'] loop
      if not exists (
        select 1 from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute pg_catalog.format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
