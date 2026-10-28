create table public.jva_brain_state (
    singleton smallint primary key default 1 check (singleton = 1),
    version bigint not null default 0 check (version >= 0),
    snapshot jsonb not null default '{}'::jsonb
        check (jsonb_typeof(snapshot) = 'object'),
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    updated_by uuid
);

insert into public.jva_brain_state (singleton, snapshot)
values (
    1,
    '{
      "mission": "Continuidad operativa de Juega Virtual Argentina",
      "status": "bootstrap-pending",
      "environment": "QA temporal",
      "next_step": "Verificar el bootstrap autenticado del Brain y continuar desde el handoff local"
    }'::jsonb
);

create table public.jva_brain_sessions (
    id uuid primary key,
    user_id uuid not null,
    generation bigint not null check (generation > 0),
    status text not null check (status in ('active', 'handed_off', 'expired')),
    summary text check (summary is null or length(summary) <= 1200),
    started_at timestamptz not null default pg_catalog.clock_timestamp(),
    heartbeat_at timestamptz not null default pg_catalog.clock_timestamp(),
    ended_at timestamptz
);

create index jva_brain_sessions_recent
    on public.jva_brain_sessions (started_at desc);

create table public.jva_brain_events (
    id bigint generated always as identity primary key,
    session_id uuid not null,
    generation bigint not null check (generation > 0),
    event_type text not null check (
        event_type in (
            'session_claimed',
            'lease_expired',
            'snapshot_updated',
            'action_intent',
            'action_result',
            'decision',
            'finding',
            'blocker',
            'playbook',
            'note',
            'handoff'
        )
    ),
    payload jsonb not null check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index jva_brain_events_recent
    on public.jva_brain_events (created_at desc, id desc);
create index jva_brain_events_type_recent
    on public.jva_brain_events (event_type, created_at desc, id desc);

create table public.jva_brain_lease (
    singleton smallint primary key default 1 check (singleton = 1),
    owner_session_id uuid,
    generation bigint not null default 0 check (generation >= 0),
    expires_at timestamptz,
    updated_at timestamptz not null default pg_catalog.clock_timestamp(),
    check (
        (owner_session_id is null and expires_at is null)
        or (owner_session_id is not null and expires_at is not null)
    )
);

insert into public.jva_brain_lease (singleton) values (1);

alter table public.jva_brain_state enable row level security;
alter table public.jva_brain_sessions enable row level security;
alter table public.jva_brain_events enable row level security;
alter table public.jva_brain_lease enable row level security;

revoke all on public.jva_brain_state from public, anon, authenticated, service_role;
revoke all on public.jva_brain_sessions from public, anon, authenticated, service_role;
revoke all on public.jva_brain_events from public, anon, authenticated, service_role;
revoke all on public.jva_brain_lease from public, anon, authenticated, service_role;
revoke all on sequence public.jva_brain_events_id_seq
    from public, anon, authenticated, service_role;

create or replace function public.jva_brain_json_is_safe(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    item record;
    string_value text;
begin
    if p_value is null or p_value = 'null'::jsonb then
        return false;
    end if;

    if pg_catalog.jsonb_typeof(p_value) = 'object' then
        for item in select key, value from pg_catalog.jsonb_each(p_value)
        loop
            if item.key ~* '(password|passwd|secret|token|cookie|credential|service[_-]?role|api[_-]?key|authorization|database[_-]?url)' then
                return false;
            end if;
            if not public.jva_brain_json_is_safe(item.value) then
                return false;
            end if;
        end loop;
    elsif pg_catalog.jsonb_typeof(p_value) = 'array' then
        for item in select value from pg_catalog.jsonb_array_elements(p_value)
        loop
            if not public.jva_brain_json_is_safe(item.value) then
                return false;
            end if;
        end loop;
    elsif pg_catalog.jsonb_typeof(p_value) = 'string' then
        string_value := p_value #>> '{}';
        if string_value ~* '(password|passwd|secret|service[_-]?role|access[_-]?token|refresh[_-]?token|api[_-]?key)\s*[:=]'
           or string_value ~ 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
           or string_value ~* '(postgres(ql)?|mysql)://' then
            return false;
        end if;
    end if;

    return true;
end;
$$;

create or replace function public.jva_brain_authorize()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if (select auth.uid()) is null
       or not public.jva_has_role(array['ai_auditor']::text[]) then
        raise exception 'Se requiere una sesión autenticada con rol ai_auditor.'
            using errcode = '42501';
    end if;
end;
$$;

create or replace function public.jva_brain_validate_snapshot(p_snapshot jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
    snapshot_key text;
begin
    if pg_catalog.jsonb_typeof(p_snapshot) <> 'object'
       or pg_catalog.octet_length(p_snapshot::text) > 12288
       or not public.jva_brain_json_is_safe(p_snapshot) then
        raise exception 'El snapshot no cumple el formato seguro del Brain.'
            using errcode = '22023';
    end if;

    for snapshot_key in select key from pg_catalog.jsonb_each(p_snapshot)
    loop
        if snapshot_key not in (
            'mission',
            'status',
            'environment',
            'evidence',
            'decisions',
            'blockers',
            'next_step',
            'current_task',
            'open_questions',
            'updated_at'
        ) then
            raise exception 'Campo de snapshot no permitido: %', snapshot_key
                using errcode = '22023';
        end if;
    end loop;

    if pg_catalog.jsonb_typeof(p_snapshot -> 'mission') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_snapshot -> 'next_step') is distinct from 'string'
       or pg_catalog.length(p_snapshot ->> 'mission') not between 1 and 1200
       or pg_catalog.length(p_snapshot ->> 'next_step') not between 1 and 1200 then
        raise exception 'El snapshot requiere mission y next_step de 1 a 1200 caracteres.'
            using errcode = '22023';
    end if;
end;
$$;

create or replace function public.jva_brain_validate_event(
    p_event_type text,
    p_payload jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
    payload_key text;
    allowed_keys text[];
begin
    if p_event_type is null
       or p_event_type not in (
        'action_intent',
        'action_result',
        'decision',
        'finding',
        'blocker',
        'playbook',
        'note'
    ) then
        raise exception 'Tipo de evento no permitido.'
            using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(p_payload) <> 'object'
       or pg_catalog.octet_length(p_payload::text) > 8192
       or not public.jva_brain_json_is_safe(p_payload) then
        raise exception 'El evento no cumple el formato seguro del Brain.'
            using errcode = '22023';
    end if;

    allowed_keys := case p_event_type
        when 'playbook' then array[
            'symptom', 'environment', 'cause', 'steps', 'result',
            'evidence_ref', 'confidence', 'verified_at', 'version'
        ]::text[]
        when 'action_intent' then array[
            'summary', 'action', 'environment', 'evidence_ref'
        ]::text[]
        when 'action_result' then array[
            'summary', 'action', 'result', 'status', 'environment',
            'evidence_ref', 'error_code'
        ]::text[]
        when 'decision' then array[
            'summary', 'rationale', 'status', 'evidence_ref', 'supersedes'
        ]::text[]
        when 'finding' then array[
            'summary', 'category', 'confidence', 'environment',
            'evidence_ref', 'version'
        ]::text[]
        when 'blocker' then array[
            'summary', 'next_step', 'environment', 'evidence_ref'
        ]::text[]
        else array[
            'summary', 'category', 'environment', 'evidence_ref'
        ]::text[]
    end;

    for payload_key in select key from pg_catalog.jsonb_each(p_payload)
    loop
        if not (payload_key = any(allowed_keys)) then
            raise exception 'Campo de evento no permitido: %', payload_key
                using errcode = '22023';
        end if;
    end loop;
end;
$$;

create or replace function public.jva_brain_assert_writer(
    p_session_id uuid,
    p_generation bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    lease_row public.jva_brain_lease%rowtype;
begin
    perform public.jva_brain_authorize();

    select * into lease_row
    from public.jva_brain_lease
    where singleton = 1
    for update;

    if lease_row.owner_session_id is distinct from p_session_id
       or lease_row.generation is distinct from p_generation
       or lease_row.expires_at is null
       or lease_row.expires_at <= pg_catalog.clock_timestamp()
       or not exists (
           select 1
           from public.jva_brain_sessions brain_session
           where brain_session.id = p_session_id
             and brain_session.user_id = (select auth.uid())
             and brain_session.generation = p_generation
             and brain_session.status = 'active'
       ) then
        raise exception 'La sesión ya no posee un lease vigente del Brain.'
            using errcode = '42501';
    end if;
end;
$$;

create or replace function public.jva_brain_context(p_event_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    state_row public.jva_brain_state%rowtype;
    lease_row public.jva_brain_lease%rowtype;
    event_rows jsonb;
begin
    perform public.jva_brain_authorize();

    if p_event_limit is null or p_event_limit not between 1 and 50 then
        raise exception 'event_limit debe estar entre 1 y 50.'
            using errcode = '22023';
    end if;

    select * into state_row from public.jva_brain_state where singleton = 1;
    select * into lease_row from public.jva_brain_lease where singleton = 1;

    select coalesce(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'id', recent.id,
                'session_id', recent.session_id,
                'generation', recent.generation,
                'event_type', recent.event_type,
                'payload', recent.payload,
                'created_at', recent.created_at
            ) order by recent.created_at, recent.id
        ),
        '[]'::jsonb
    )
    into event_rows
    from (
        select id, session_id, generation, event_type, payload, created_at
        from public.jva_brain_events
        order by created_at desc, id desc
        limit p_event_limit
    ) recent;

    return pg_catalog.jsonb_build_object(
        'snapshot', state_row.snapshot,
        'version', state_row.version,
        'updated_at', state_row.updated_at,
        'lease', pg_catalog.jsonb_build_object(
            'owner_session_id', lease_row.owner_session_id,
            'generation', lease_row.generation,
            'expires_at', lease_row.expires_at,
            'active', lease_row.owner_session_id is not null
                and lease_row.expires_at > pg_catalog.clock_timestamp()
        ),
        'events', event_rows
    );
end;
$$;

create or replace function public.jva_brain_bootstrap(p_event_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.jva_brain_authorize();
    return public.jva_brain_context(p_event_limit);
end;
$$;

create or replace function public.jva_brain_claim(
    p_session_id uuid,
    p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    lease_row public.jva_brain_lease%rowtype;
    previous_session public.jva_brain_sessions%rowtype;
    current_session public.jva_brain_sessions%rowtype;
    next_generation bigint;
    new_expiry timestamptz;
begin
    perform public.jva_brain_authorize();
    if p_session_id is null
       or p_lease_seconds is null
       or p_lease_seconds not between 30 and 180 then
        raise exception 'session_id es obligatorio y lease_seconds debe estar entre 30 y 180.'
            using errcode = '22023';
    end if;

    select * into lease_row
    from public.jva_brain_lease
    where singleton = 1
    for update;

    if lease_row.owner_session_id = p_session_id
       and lease_row.expires_at > pg_catalog.clock_timestamp() then
        select * into current_session
        from public.jva_brain_sessions
        where id = p_session_id
          and user_id = (select auth.uid())
          and generation = lease_row.generation
          and status = 'active';
        if not found then
            raise exception 'No se puede reanudar esta sesión del Brain.'
                using errcode = '42501';
        end if;
        new_expiry := pg_catalog.clock_timestamp()
            + pg_catalog.make_interval(secs => p_lease_seconds);
        update public.jva_brain_lease
        set expires_at = new_expiry,
            updated_at = pg_catalog.clock_timestamp()
        where singleton = 1;
        update public.jva_brain_sessions
        set heartbeat_at = pg_catalog.clock_timestamp()
        where id = p_session_id;
        return pg_catalog.jsonb_build_object(
            'claimed', true,
            'session_id', p_session_id,
            'generation', lease_row.generation,
            'lease_expires_at', new_expiry,
            'context', public.jva_brain_context(20)
        );
    end if;

    if lease_row.owner_session_id is not null
       and lease_row.expires_at > pg_catalog.clock_timestamp() then
        return pg_catalog.jsonb_build_object(
            'claimed', false,
            'owner_session_id', lease_row.owner_session_id,
            'generation', lease_row.generation,
            'lease_expires_at', lease_row.expires_at
        );
    end if;

    select * into current_session
    from public.jva_brain_sessions
    where id = p_session_id;
    if found then
        raise exception 'El identificador de sesión ya fue utilizado.'
            using errcode = '22023';
    end if;

    if lease_row.owner_session_id is not null then
        select * into previous_session
        from public.jva_brain_sessions
        where id = lease_row.owner_session_id
        for update;
        if found and previous_session.status = 'active' then
            update public.jva_brain_sessions
            set status = 'expired',
                ended_at = pg_catalog.clock_timestamp()
            where id = previous_session.id;
            insert into public.jva_brain_events (
                session_id, generation, event_type, payload
            )
            values (
                previous_session.id,
                previous_session.generation,
                'lease_expired',
                pg_catalog.jsonb_build_object(
                    'summary', 'Lease vencido; una sesión nueva recuperó la continuidad.'
                )
            );
        end if;
    end if;

    next_generation := lease_row.generation + 1;
    new_expiry := pg_catalog.clock_timestamp()
        + pg_catalog.make_interval(secs => p_lease_seconds);

    insert into public.jva_brain_sessions (id, user_id, generation, status)
    values (p_session_id, (select auth.uid()), next_generation, 'active');

    update public.jva_brain_lease
    set owner_session_id = p_session_id,
        generation = next_generation,
        expires_at = new_expiry,
        updated_at = pg_catalog.clock_timestamp()
    where singleton = 1;

    insert into public.jva_brain_events (
        session_id, generation, event_type, payload
    )
    values (
        p_session_id,
        next_generation,
        'session_claimed',
        pg_catalog.jsonb_build_object(
            'summary', 'Sesión obtuvo el lease exclusivo del Brain.'
        )
    );

    return pg_catalog.jsonb_build_object(
        'claimed', true,
        'session_id', p_session_id,
        'generation', next_generation,
        'lease_expires_at', new_expiry,
        'context', public.jva_brain_context(20)
    );
end;
$$;

create or replace function public.jva_brain_heartbeat(
    p_session_id uuid,
    p_generation bigint,
    p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_expiry timestamptz;
begin
    if p_lease_seconds is null
       or p_lease_seconds not between 30 and 180 then
        raise exception 'lease_seconds debe estar entre 30 y 180.'
            using errcode = '22023';
    end if;
    perform public.jva_brain_assert_writer(p_session_id, p_generation);

    new_expiry := pg_catalog.clock_timestamp()
        + pg_catalog.make_interval(secs => p_lease_seconds);
    update public.jva_brain_lease
    set expires_at = new_expiry,
        updated_at = pg_catalog.clock_timestamp()
    where singleton = 1;
    update public.jva_brain_sessions
    set heartbeat_at = pg_catalog.clock_timestamp()
    where id = p_session_id;

    return pg_catalog.jsonb_build_object(
        'session_id', p_session_id,
        'generation', p_generation,
        'lease_expires_at', new_expiry
    );
end;
$$;

create or replace function public.jva_brain_save_state(
    p_session_id uuid,
    p_generation bigint,
    p_expected_version bigint,
    p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    state_row public.jva_brain_state%rowtype;
    next_version bigint;
begin
    perform public.jva_brain_assert_writer(p_session_id, p_generation);
    perform public.jva_brain_validate_snapshot(p_snapshot);

    select * into state_row
    from public.jva_brain_state
    where singleton = 1
    for update;
    if state_row.version is distinct from p_expected_version then
        raise exception 'Conflicto de versión del Brain; vuelve a cargar el estado.'
            using errcode = '40001';
    end if;

    next_version := state_row.version + 1;
    update public.jva_brain_state
    set snapshot = p_snapshot,
        version = next_version,
        updated_at = pg_catalog.clock_timestamp(),
        updated_by = (select auth.uid())
    where singleton = 1;
    update public.jva_brain_sessions
    set heartbeat_at = pg_catalog.clock_timestamp()
    where id = p_session_id;
    insert into public.jva_brain_events (
        session_id, generation, event_type, payload
    )
    values (
        p_session_id,
        p_generation,
        'snapshot_updated',
        pg_catalog.jsonb_build_object(
            'summary', p_snapshot ->> 'mission',
            'status', p_snapshot ->> 'status',
            'version', next_version
        )
    );

    return pg_catalog.jsonb_build_object('version', next_version);
end;
$$;

create or replace function public.jva_brain_append_event(
    p_session_id uuid,
    p_generation bigint,
    p_event_type text,
    p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    event_id bigint;
begin
    perform public.jva_brain_assert_writer(p_session_id, p_generation);
    perform public.jva_brain_validate_event(p_event_type, p_payload);

    insert into public.jva_brain_events (
        session_id, generation, event_type, payload
    )
    values (p_session_id, p_generation, p_event_type, p_payload)
    returning id into event_id;

    update public.jva_brain_sessions
    set heartbeat_at = pg_catalog.clock_timestamp()
    where id = p_session_id;

    return event_id;
end;
$$;

create or replace function public.jva_brain_search_playbooks(
    p_query text,
    p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result_rows jsonb;
begin
    perform public.jva_brain_authorize();
    if p_query is null
       or pg_catalog.length(pg_catalog.btrim(p_query)) not between 2 and 100
       or p_limit is null
       or p_limit not between 1 and 20 then
        raise exception 'query debe tener entre 2 y 100 caracteres y limit entre 1 y 20.'
            using errcode = '22023';
    end if;

    select coalesce(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'id', matches.id,
                'session_id', matches.session_id,
                'payload', matches.payload,
                'created_at', matches.created_at
            ) order by matches.created_at desc, matches.id desc
        ),
        '[]'::jsonb
    )
    into result_rows
    from (
        select id, session_id, payload, created_at
        from public.jva_brain_events
        where event_type = 'playbook'
          and pg_catalog.strpos(
              pg_catalog.lower(payload::text),
              pg_catalog.lower(pg_catalog.btrim(p_query))
          ) > 0
        order by created_at desc, id desc
        limit p_limit
    ) matches;

    return result_rows;
end;
$$;

create or replace function public.jva_brain_handoff(
    p_session_id uuid,
    p_generation bigint,
    p_expected_version bigint,
    p_snapshot jsonb,
    p_handoff_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    state_row public.jva_brain_state%rowtype;
    next_version bigint;
begin
    perform public.jva_brain_assert_writer(p_session_id, p_generation);
    perform public.jva_brain_validate_snapshot(p_snapshot);

    if pg_catalog.jsonb_typeof(p_handoff_payload) <> 'object'
       or pg_catalog.octet_length(p_handoff_payload::text) > 4096
       or not public.jva_brain_json_is_safe(p_handoff_payload)
       or exists (
           select 1
           from pg_catalog.jsonb_object_keys(p_handoff_payload) as keys(payload_key)
           where payload_key not in ('summary', 'next_step', 'status', 'blockers')
       ) then
        raise exception 'El handoff no cumple el formato seguro del Brain.'
            using errcode = '22023';
    end if;

    select * into state_row
    from public.jva_brain_state
    where singleton = 1
    for update;
    if state_row.version is distinct from p_expected_version then
        raise exception 'Conflicto de versión del Brain; vuelve a cargar el estado.'
            using errcode = '40001';
    end if;

    next_version := state_row.version + 1;
    update public.jva_brain_state
    set snapshot = p_snapshot,
        version = next_version,
        updated_at = pg_catalog.clock_timestamp(),
        updated_by = (select auth.uid())
    where singleton = 1;

    insert into public.jva_brain_events (
        session_id, generation, event_type, payload
    )
    values (
        p_session_id,
        p_generation,
        'handoff',
        p_handoff_payload || pg_catalog.jsonb_build_object(
            'version', next_version
        )
    );

    update public.jva_brain_sessions
    set status = 'handed_off',
        summary = p_snapshot ->> 'mission',
        heartbeat_at = pg_catalog.clock_timestamp(),
        ended_at = pg_catalog.clock_timestamp()
    where id = p_session_id;
    update public.jva_brain_lease
    set owner_session_id = null,
        expires_at = null,
        updated_at = pg_catalog.clock_timestamp()
    where singleton = 1;

    return pg_catalog.jsonb_build_object(
        'handed_off', true,
        'version', next_version,
        'session_id', p_session_id
    );
end;
$$;

revoke all on function public.jva_brain_json_is_safe(jsonb)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_authorize()
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_validate_snapshot(jsonb)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_validate_event(text, jsonb)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_assert_writer(uuid, bigint)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_context(integer)
    from public, anon, authenticated, service_role;

revoke all on function public.jva_brain_bootstrap(integer)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_claim(uuid, integer)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_heartbeat(uuid, bigint, integer)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_save_state(uuid, bigint, bigint, jsonb)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_append_event(uuid, bigint, text, jsonb)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_search_playbooks(text, integer)
    from public, anon, authenticated, service_role;
revoke all on function public.jva_brain_handoff(uuid, bigint, bigint, jsonb, jsonb)
    from public, anon, authenticated, service_role;

grant execute on function public.jva_brain_bootstrap(integer) to authenticated;
grant execute on function public.jva_brain_claim(uuid, integer) to authenticated;
grant execute on function public.jva_brain_heartbeat(uuid, bigint, integer) to authenticated;
grant execute on function public.jva_brain_save_state(uuid, bigint, bigint, jsonb)
    to authenticated;
grant execute on function public.jva_brain_append_event(uuid, bigint, text, jsonb)
    to authenticated;
grant execute on function public.jva_brain_search_playbooks(text, integer)
    to authenticated;
grant execute on function public.jva_brain_handoff(uuid, bigint, bigint, jsonb, jsonb)
    to authenticated;
