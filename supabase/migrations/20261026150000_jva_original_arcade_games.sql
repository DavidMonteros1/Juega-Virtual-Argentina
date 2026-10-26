alter table public.jva_games
    drop constraint jva_games_game_key_check,
    add constraint jva_games_game_key_check
        check (game_key in ('slots', 'lottery', 'tables', 'dice', 'mines', 'crash', 'wheel', 'jackpot')),
    add column arcade_settings jsonb not null default '{}'::jsonb
        check (jsonb_typeof(arcade_settings) = 'object');

insert into public.jva_games (game_key, title, arcade_settings)
values
    ('dice', 'Dados', '{"win_multiplier":1.4}'::jsonb),
    ('mines', 'Minas', '{"mine_count":10,"max_multiplier":5}'::jsonb),
    ('crash', 'Crash', '{"max_multiplier":5,"max_crash_multiplier":5,"growth_per_second":0.15}'::jsonb),
    ('wheel', 'Ruleta de premios', '{"multipliers":[0,0,0,0,0,1.1,1.1,1.4,1.4,1.6]}'::jsonb),
    ('jackpot', 'Jackpot', '{"entry_price_tokens":10,"draw_interval_hours":24}'::jsonb);

insert into public.jva_financial_accounts (account_key, account_type, normal_side, game_key)
values
    ('game:dice', 'game_prize_liability', 'credit', 'dice'),
    ('game:mines', 'game_prize_liability', 'credit', 'mines'),
    ('game:crash', 'game_prize_liability', 'credit', 'crash'),
    ('game:wheel', 'game_prize_liability', 'credit', 'wheel'),
    ('game:jackpot', 'game_prize_liability', 'credit', 'jackpot');

alter table public.jva_site_modules
    drop constraint jva_site_modules_module_key_check,
    add constraint jva_site_modules_module_key_check
        check (module_key in (
            'home', 'lottery', 'slots', 'tables', 'chat', 'winners',
            'dice', 'mines', 'crash', 'wheel', 'jackpot'
        ));

insert into public.jva_site_modules (module_key, visible, sort_order)
values
    ('dice', false, 6),
    ('mines', false, 7),
    ('crash', false, 8),
    ('wheel', false, 9),
    ('jackpot', false, 10);

alter table public.jva_game_reservations
    drop constraint jva_game_reservations_source_type_check,
    add constraint jva_game_reservations_source_type_check
        check (source_type in ('slot_bet', 'lottery_ticket', 'arcade_round'));

alter table public.jva_game_bets
    drop constraint jva_game_bets_outcome_check,
    add constraint jva_game_bets_outcome_check
        check (outcome in ('jackpot', 'pair', 'loss', 'win', 'pending', 'jackpot_entry'));

create table public.jva_arcade_rounds (
    id uuid primary key default extensions.gen_random_uuid(),
    request_id uuid not null unique,
    game_key text not null references public.jva_games(game_key)
        check (game_key in ('mines', 'crash')),
    user_id uuid not null references auth.users(id),
    stake_tokens bigint not null check (stake_tokens > 0),
    maximum_payout_tokens bigint not null check (maximum_payout_tokens > 0),
    reservation_id uuid not null unique references public.jva_game_reservations(id),
    status text not null default 'active'
        check (status in ('active', 'lost', 'crashed', 'cashed_out')),
    state jsonb not null check (jsonb_typeof(state) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index jva_one_active_arcade_round
    on public.jva_arcade_rounds (user_id, game_key)
    where status = 'active';
create index jva_arcade_rounds_user_created
    on public.jva_arcade_rounds (user_id, created_at desc);

create table public.jva_arcade_actions (
    request_id uuid primary key,
    round_id uuid not null references public.jva_arcade_rounds(id),
    user_id uuid not null references auth.users(id),
    action text not null check (action in ('reveal', 'cashout')),
    cell integer check (cell is null or cell between 0 and 24),
    result jsonb not null check (jsonb_typeof(result) = 'object'),
    created_at timestamptz not null default now()
);

create table public.jva_jackpot_draws (
    id uuid primary key default extensions.gen_random_uuid(),
    draw_number bigint generated always as identity unique,
    status text not null default 'open' check (status in ('open', 'settled')),
    opened_by uuid not null references auth.users(id),
    opened_at timestamptz not null default now(),
    settled_by uuid references auth.users(id),
    settled_at timestamptz,
    winner_user_id uuid references auth.users(id),
    prize_tokens bigint not null default 0 check (prize_tokens >= 0)
);

create unique index jva_one_open_jackpot_draw
    on public.jva_jackpot_draws ((status))
    where status = 'open';

create table public.jva_jackpot_entries (
    id uuid primary key default extensions.gen_random_uuid(),
    draw_id uuid not null references public.jva_jackpot_draws(id),
    user_id uuid not null references auth.users(id),
    request_id uuid not null unique,
    price_tokens bigint not null check (price_tokens > 0),
    created_at timestamptz not null default now()
);

create index jva_jackpot_entries_draw_created
    on public.jva_jackpot_entries (draw_id, created_at, id);

alter table public.jva_arcade_rounds enable row level security;
alter table public.jva_arcade_actions enable row level security;
alter table public.jva_jackpot_draws enable row level security;
alter table public.jva_jackpot_entries enable row level security;
revoke all on public.jva_arcade_rounds from anon, authenticated;
revoke all on public.jva_arcade_actions from anon, authenticated;
revoke all on public.jva_jackpot_draws from anon, authenticated;
revoke all on public.jva_jackpot_entries from anon, authenticated;

create or replace function public.jva_random_int(p_upper_bound integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    random_bytes bytea;
    random_value bigint;
    accepted_limit bigint;
begin
    if p_upper_bound is null or p_upper_bound < 1 then
        raise exception 'El límite aleatorio no es válido.';
    end if;
    accepted_limit := (4294967296::bigint / p_upper_bound) * p_upper_bound;
    loop
        random_bytes := extensions.gen_random_bytes(4);
        random_value :=
            (pg_catalog.get_byte(random_bytes, 0)::bigint << 24)
            + (pg_catalog.get_byte(random_bytes, 1)::bigint << 16)
            + (pg_catalog.get_byte(random_bytes, 2)::bigint << 8)
            + pg_catalog.get_byte(random_bytes, 3)::bigint;
        if random_value < accepted_limit then
            return (random_value % p_upper_bound)::integer;
        end if;
    end loop;
end;
$$;

create or replace function public.jva_update_arcade_game_config(
    p_game_key text,
    p_enabled boolean,
    p_house_share_percent numeric,
    p_settings jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    expected_keys text[];
    item jsonb;
    wheel_count integer;
    wheel_has_prize boolean := false;
begin
    if not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Se requiere el rol de administrador maestro.';
    end if;
    if p_game_key is null or p_game_key not in ('dice', 'mines', 'crash', 'wheel', 'jackpot')
       or p_enabled is null
       or p_house_share_percent is null
       or p_house_share_percent <= 0 or p_house_share_percent >= 100
       or p_settings is null or jsonb_typeof(p_settings) <> 'object' then
        raise exception 'La configuración del juego no es válida.';
    end if;

    expected_keys := case p_game_key
        when 'dice' then array['win_multiplier']
        when 'mines' then array['mine_count', 'max_multiplier']
        when 'crash' then array['max_multiplier', 'max_crash_multiplier', 'growth_per_second']
        when 'wheel' then array['multipliers']
        when 'jackpot' then array['entry_price_tokens', 'draw_interval_hours']
    end;
    if jsonb_object_length(p_settings) <> cardinality(expected_keys)
       or not (p_settings ?& expected_keys) then
        raise exception 'La configuración contiene opciones faltantes o no permitidas.';
    end if;

    if p_game_key = 'dice' then
        if jsonb_typeof(p_settings -> 'win_multiplier') is distinct from 'number'
           or (p_settings ->> 'win_multiplier')::numeric not between 1.01 and 10 then
            raise exception 'El multiplicador de dados debe estar entre 1,01 y 10.';
        end if;
    elsif p_game_key = 'mines' then
        if jsonb_typeof(p_settings -> 'mine_count') is distinct from 'number'
           or (p_settings ->> 'mine_count')::numeric not between 1 and 20
           or (p_settings ->> 'mine_count')::numeric <> trunc((p_settings ->> 'mine_count')::numeric)
           or jsonb_typeof(p_settings -> 'max_multiplier') is distinct from 'number'
           or (p_settings ->> 'max_multiplier')::numeric not between 1.01 and 100 then
            raise exception 'La configuración de Minas no es válida.';
        end if;
    elsif p_game_key = 'crash' then
        if jsonb_typeof(p_settings -> 'max_multiplier') is distinct from 'number'
           or (p_settings ->> 'max_multiplier')::numeric not between 1.1 and 100
           or jsonb_typeof(p_settings -> 'max_crash_multiplier') is distinct from 'number'
           or (p_settings ->> 'max_crash_multiplier')::numeric not between 1.1 and 100
           or jsonb_typeof(p_settings -> 'growth_per_second') is distinct from 'number'
           or (p_settings ->> 'growth_per_second')::numeric not between 0.02 and 2 then
            raise exception 'La configuración de Crash no es válida.';
        end if;
    elsif p_game_key = 'wheel' then
        if jsonb_typeof(p_settings -> 'multipliers') is distinct from 'array' then
            raise exception 'Los segmentos de la ruleta no son válidos.';
        end if;
        wheel_count := jsonb_array_length(p_settings -> 'multipliers');
        if wheel_count not between 5 and 20 then
            raise exception 'La ruleta debe tener entre 5 y 20 segmentos.';
        end if;
        for item in select value from jsonb_array_elements(p_settings -> 'multipliers')
        loop
            if jsonb_typeof(item) is distinct from 'number'
               or item::text::numeric not between 0 and 100 then
                raise exception 'Cada multiplicador de la ruleta debe estar entre 0 y 100.';
            end if;
            wheel_has_prize := wheel_has_prize or item::text::numeric > 0;
        end loop;
        if not wheel_has_prize then
            raise exception 'La ruleta debe incluir al menos un segmento con premio.';
        end if;
    elsif p_game_key = 'jackpot' then
        if jsonb_typeof(p_settings -> 'entry_price_tokens') is distinct from 'number'
           or (p_settings ->> 'entry_price_tokens')::numeric not between 1 and 1000000
           or (p_settings ->> 'entry_price_tokens')::numeric
                < ceil(100 / p_house_share_percent)
           or (p_settings ->> 'entry_price_tokens')::numeric <> trunc(
               (p_settings ->> 'entry_price_tokens')::numeric
           )
           or jsonb_typeof(p_settings -> 'draw_interval_hours') is distinct from 'number'
           or (p_settings ->> 'draw_interval_hours')::numeric not between 1 and 720
           or (p_settings ->> 'draw_interval_hours')::numeric <> trunc(
               (p_settings ->> 'draw_interval_hours')::numeric
           ) then
            raise exception 'La configuración del Jackpot no es válida.';
        end if;
    end if;

    update public.jva_games
    set enabled = p_enabled,
        house_share_percent = p_house_share_percent,
        arcade_settings = p_settings,
        updated_by = (select auth.uid()),
        updated_at = now()
    where game_key = p_game_key;

    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        (select auth.uid()),
        'arcade_game_config_updated',
        'game',
        p_game_key,
        jsonb_build_object(
            'enabled', p_enabled,
            'house_share_percent', p_house_share_percent,
            'settings', p_settings
        )
    );
end;
$$;

create or replace function public.jva_get_arcade_status(p_game_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    game public.jva_games;
begin
    if current_user_id is null
       or p_game_key is null
       or p_game_key not in ('dice', 'mines', 'crash', 'wheel') then
        raise exception 'No se puede consultar el estado de este juego.';
    end if;
    perform public.jva_require_active_user(current_user_id);
    select * into game
    from public.jva_games
    where game_key = p_game_key;
    if not found then
        raise exception 'No existe el juego indicado.';
    end if;
    return jsonb_build_object(
        'game_key', game.game_key,
        'enabled', game.enabled,
        'house_share_percent', game.house_share_percent,
        'minimum_stake_tokens', ceil(100 / game.house_share_percent)::bigint,
        'available_prize_pool_tokens', public.jva_available_prize_tokens(p_game_key),
        'settings', game.arcade_settings
    );
end;
$$;

create or replace function public.jva_play_instant_arcade(
    p_game_key text,
    p_stake_tokens bigint,
    p_choice text,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    game public.jva_games;
    existing_bet public.jva_game_bets;
    wallet_key text;
    player_balance bigint;
    house_amount bigint;
    contribution bigint;
    available_after_bet bigint;
    max_multiplier numeric;
    multiplier numeric := 0;
    maximum_payout bigint;
    payout_value bigint := 0;
    random_value integer;
    segment_count integer;
    outcome_value text;
    result_value jsonb;
    bet_id uuid := extensions.gen_random_uuid();
    payout_request_id uuid := extensions.gen_random_uuid();
begin
    if current_user_id is null or p_request_id is null
       or p_game_key is null or p_game_key not in ('dice', 'wheel')
       or p_stake_tokens is null or p_stake_tokens not between 1 and 1000000 then
        raise exception 'Los datos de la jugada no son válidos.';
    end if;
    if p_choice is null
       or (p_game_key = 'dice' and p_choice not in ('high', 'low'))
       or (p_game_key = 'wheel' and p_choice <> 'spin') then
        raise exception 'La opción elegida no es válida.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    select * into existing_bet
    from public.jva_game_bets
    where request_id = p_request_id;
    if found then
        if existing_bet.user_id <> current_user_id
           or existing_bet.game_key <> p_game_key
           or existing_bet.stake_tokens <> p_stake_tokens
           or existing_bet.payout_snapshot ->> 'choice' is distinct from p_choice then
            raise exception 'La solicitud ya se utilizó con otros datos.';
        end if;
        return existing_bet.payout_snapshot
            || jsonb_build_object(
                'bet_id', existing_bet.id,
                'payout_tokens', existing_bet.payout_tokens,
                'outcome', existing_bet.outcome,
                'replayed', true
            );
    end if;

    perform public.jva_require_active_user(current_user_id);
    select * into game from public.jva_games
    where game_key = p_game_key for update;
    if not found or not game.enabled then
        raise exception 'Este juego está pausado.';
    end if;

    if p_game_key = 'dice' then
        multiplier := (game.arcade_settings ->> 'win_multiplier')::numeric;
    else
        segment_count := jsonb_array_length(game.arcade_settings -> 'multipliers');
        select max(value::numeric)
        into max_multiplier
        from jsonb_array_elements_text(game.arcade_settings -> 'multipliers') as multiplier_rows(value);
        multiplier := max_multiplier;
    end if;

    wallet_key := 'player:' || current_user_id::text;
    perform 1 from public.jva_financial_accounts
    where account_key in ('game:' || p_game_key, wallet_key)
    order by account_key
    for update;
    select balance_tokens into player_balance
    from public.jva_financial_accounts where account_key = wallet_key;
    if player_balance < p_stake_tokens then
        raise exception 'No tienes suficientes fichas.';
    end if;

    house_amount := floor(p_stake_tokens * game.house_share_percent / 100)::bigint;
    contribution := p_stake_tokens - house_amount;
    if house_amount <= 0 or contribution <= 0 then
        raise exception 'La apuesta mínima es de % fichas.', ceil(100 / game.house_share_percent)::bigint;
    end if;
    available_after_bet := public.jva_available_prize_tokens(p_game_key) + contribution;
    maximum_payout := least(
        floor(p_stake_tokens * multiplier)::bigint,
        available_after_bet
    );
    if maximum_payout <= 0 then
        raise exception 'El fondo del juego no puede cubrir esta apuesta.';
    end if;

    if p_game_key = 'dice' then
        random_value := public.jva_random_int(100) + 1;
        outcome_value := case
            when (p_choice = 'high' and random_value > 50)
              or (p_choice = 'low' and random_value <= 50)
                then 'win'
            else 'loss'
        end;
        if outcome_value = 'win' then
            payout_value := least(floor(p_stake_tokens * multiplier)::bigint, maximum_payout);
        end if;
    else
        random_value := public.jva_random_int(segment_count);
        multiplier := (game.arcade_settings -> 'multipliers' ->> random_value)::numeric;
        outcome_value := case when multiplier > 0 then 'win' else 'loss' end;
        if multiplier > 0 then
            payout_value := least(floor(p_stake_tokens * multiplier)::bigint, maximum_payout);
        end if;
    end if;

    perform public.jva_post_journal(
        p_request_id,
        'arcade_bet',
        current_user_id,
        jsonb_build_object(
            'game_key', p_game_key,
            'user_id', current_user_id,
            'stake_tokens', p_stake_tokens,
            'choice', p_choice
        ),
        case when p_game_key = 'dice' then 'Apuesta en dados' else 'Apuesta en ruleta' end,
        jsonb_build_array(
            jsonb_build_object('account', wallet_key, 'side', 'debit', 'amount', p_stake_tokens),
            jsonb_build_object('account', 'house_earnings', 'side', 'credit', 'amount', house_amount),
            jsonb_build_object('account', 'game:' || p_game_key, 'side', 'credit', 'amount', contribution)
        )
    );

    result_value := jsonb_build_object(
        'game_key', p_game_key,
        'choice', p_choice,
        'roll', case when p_game_key = 'dice' then random_value else null end,
        'segment', case when p_game_key = 'wheel' then random_value + 1 else null end,
        'multiplier', multiplier,
        'maximum_payout_tokens', maximum_payout,
        'house_share_tokens', house_amount
    );
    insert into public.jva_game_bets (
        id, request_id, game_key, user_id, stake_tokens,
        maximum_payout_tokens, payout_tokens, outcome, payout_snapshot
    )
    values (
        bet_id, p_request_id, p_game_key, current_user_id, p_stake_tokens,
        maximum_payout, payout_value, outcome_value, result_value
    );

    if payout_value > 0 then
        perform public.jva_post_journal(
            payout_request_id,
            'arcade_payout',
            current_user_id,
            jsonb_build_object(
                'bet_id', bet_id,
                'payout_tokens', payout_value,
                'multiplier', multiplier
            ),
            case when p_game_key = 'dice' then 'Premio de dados' else 'Premio de ruleta' end,
            jsonb_build_array(
                jsonb_build_object('account', 'game:' || p_game_key, 'side', 'debit', 'amount', payout_value),
                jsonb_build_object('account', wallet_key, 'side', 'credit', 'amount', payout_value)
            )
        );
    end if;

    return result_value || jsonb_build_object(
        'bet_id', bet_id,
        'outcome', outcome_value,
        'payout_tokens', payout_value,
        'replayed', false
    );
end;
$$;

create or replace function public.jva_start_arcade_round(
    p_game_key text,
    p_stake_tokens bigint,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    game public.jva_games;
    existing_round public.jva_arcade_rounds;
    wallet_key text;
    player_balance bigint;
    house_amount bigint;
    contribution bigint;
    available_after_bet bigint;
    max_multiplier numeric;
    maximum_payout bigint;
    round_id uuid := extensions.gen_random_uuid();
    reservation_id uuid := extensions.gen_random_uuid();
    mine_positions integer[] := array[]::integer[];
    candidate integer;
    mine_count integer;
    state_value jsonb;
    crash_point numeric;
    bet_id uuid := extensions.gen_random_uuid();
begin
    if current_user_id is null or p_request_id is null
       or p_game_key is null or p_game_key not in ('mines', 'crash')
       or p_stake_tokens is null or p_stake_tokens not between 1 and 1000000 then
        raise exception 'Los datos de la partida no son válidos.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    select * into existing_round from public.jva_arcade_rounds
    where request_id = p_request_id;
    if found then
        if existing_round.user_id <> current_user_id
           or existing_round.game_key <> p_game_key
           or existing_round.stake_tokens <> p_stake_tokens then
            raise exception 'La solicitud ya se utilizó con otros datos.';
        end if;
        return public.jva_get_arcade_round_json(existing_round.id, false)
            || jsonb_build_object('replayed', true);
    end if;

    perform public.jva_require_active_user(current_user_id);
    select * into game from public.jva_games
    where game_key = p_game_key for update;
    if not found or not game.enabled then
        raise exception 'Este juego está pausado.';
    end if;
    select id into round_id from public.jva_arcade_rounds
    where user_id = current_user_id
      and game_key = p_game_key
      and status = 'active'
      and created_at <= clock_timestamp() - interval '30 minutes'
    for update;
    if found then
        perform public.jva_expire_arcade_round(round_id);
    end if;
    if exists (
        select 1 from public.jva_arcade_rounds
        where user_id = current_user_id and game_key = p_game_key and status = 'active'
    ) then
        raise exception 'Ya tienes una partida activa. Continúa esa partida antes de iniciar otra.';
    end if;
    round_id := extensions.gen_random_uuid();

    if p_game_key = 'mines' then
        mine_count := (game.arcade_settings ->> 'mine_count')::integer;
        max_multiplier := (game.arcade_settings ->> 'max_multiplier')::numeric;
        while cardinality(mine_positions) < mine_count loop
            candidate := public.jva_random_int(25);
            if not candidate = any(mine_positions) then
                mine_positions := array_append(mine_positions, candidate);
            end if;
        end loop;
        state_value := jsonb_build_object(
            'mine_positions', mine_positions,
            'revealed', '[]'::jsonb,
            'mine_count', mine_count,
            'max_multiplier', max_multiplier,
            'house_share_percent', game.house_share_percent
        );
    else
        max_multiplier := (game.arcade_settings ->> 'max_multiplier')::numeric;
        candidate := public.jva_random_int(10000);
        crash_point := greatest(
            1,
            least(
                (game.arcade_settings ->> 'max_crash_multiplier')::numeric,
                round(
                    (1 - game.house_share_percent / 100)
                    * 10000 / (10000 - candidate),
                    2
                )
            )
        );
        state_value := jsonb_build_object(
            'crash_point', crash_point,
            'max_multiplier', max_multiplier,
            'max_crash_multiplier', (game.arcade_settings ->> 'max_crash_multiplier')::numeric,
            'growth_per_second', (game.arcade_settings ->> 'growth_per_second')::numeric,
            'house_share_percent', game.house_share_percent
        );
    end if;

    wallet_key := 'player:' || current_user_id::text;
    perform 1 from public.jva_financial_accounts
    where account_key in ('game:' || p_game_key, wallet_key)
    order by account_key
    for update;
    select balance_tokens into player_balance
    from public.jva_financial_accounts where account_key = wallet_key;
    if player_balance < p_stake_tokens then
        raise exception 'No tienes suficientes fichas.';
    end if;
    house_amount := floor(p_stake_tokens * game.house_share_percent / 100)::bigint;
    contribution := p_stake_tokens - house_amount;
    if house_amount <= 0 or contribution <= 0 then
        raise exception 'La apuesta mínima es de % fichas.', ceil(100 / game.house_share_percent)::bigint;
    end if;

    available_after_bet := public.jva_available_prize_tokens(p_game_key) + contribution;
    maximum_payout := least(floor(p_stake_tokens * max_multiplier)::bigint, available_after_bet);
    if maximum_payout <= 0 then
        raise exception 'El fondo del juego no puede respaldar esta partida.';
    end if;

    perform public.jva_post_journal(
        p_request_id,
        'arcade_bet',
        current_user_id,
        jsonb_build_object(
            'game_key', p_game_key,
            'user_id', current_user_id,
            'stake_tokens', p_stake_tokens,
            'maximum_payout_tokens', maximum_payout
        ),
        case when p_game_key = 'mines' then 'Apuesta en Minas' else 'Apuesta en Crash' end,
        jsonb_build_array(
            jsonb_build_object('account', wallet_key, 'side', 'debit', 'amount', p_stake_tokens),
            jsonb_build_object('account', 'house_earnings', 'side', 'credit', 'amount', house_amount),
            jsonb_build_object('account', 'game:' || p_game_key, 'side', 'credit', 'amount', contribution)
        )
    );
    insert into public.jva_game_reservations (
        id, game_key, source_type, source_id, owner_user_id, amount_tokens, status
    )
    values (
        reservation_id, p_game_key, 'arcade_round', round_id,
        current_user_id, maximum_payout, 'held'
    );
    insert into public.jva_arcade_rounds (
        id, request_id, game_key, user_id, stake_tokens,
        maximum_payout_tokens, reservation_id, state
    )
    values (
        round_id, p_request_id, p_game_key, current_user_id, p_stake_tokens,
        maximum_payout, reservation_id, state_value
    );
    insert into public.jva_game_bets (
        id, request_id, game_key, user_id, stake_tokens,
        maximum_payout_tokens, payout_tokens, outcome, payout_snapshot
    )
    values (
        bet_id, p_request_id, p_game_key, current_user_id, p_stake_tokens,
        maximum_payout, 0, 'pending',
        jsonb_build_object(
            'round_id', round_id,
            'house_share_percent', game.house_share_percent,
            'settings', game.arcade_settings
        )
    );

    return public.jva_get_arcade_round_json(round_id, false)
        || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.jva_get_arcade_round_json(
    p_round_id uuid,
    p_reveal_hidden boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    round_row public.jva_arcade_rounds;
    result jsonb;
    elapsed_seconds numeric;
    current_multiplier numeric;
begin
    select * into round_row from public.jva_arcade_rounds where id = p_round_id;
    if not found then
        raise exception 'No existe la partida indicada.';
    end if;
    result := jsonb_build_object(
        'round_id', round_row.id,
        'game_key', round_row.game_key,
        'stake_tokens', round_row.stake_tokens,
        'maximum_payout_tokens', round_row.maximum_payout_tokens,
        'status', round_row.status,
        'started_at', round_row.created_at
    );
    if round_row.game_key = 'mines' then
        result := result || jsonb_build_object(
            'mine_count', round_row.state -> 'mine_count',
            'revealed', round_row.state -> 'revealed',
            'mine_positions', case
                when p_reveal_hidden then round_row.state -> 'mine_positions'
                else null
            end
        );
    else
        elapsed_seconds := greatest(
            0,
            extract(epoch from (now() - round_row.created_at))::numeric
        );
        current_multiplier := least(
            1 + floor(elapsed_seconds * (round_row.state ->> 'growth_per_second')::numeric * 100) / 100,
            (round_row.state ->> 'max_multiplier')::numeric
        );
        result := result || jsonb_build_object(
            'growth_per_second', round_row.state -> 'growth_per_second',
            'current_multiplier', current_multiplier,
            'crash_multiplier', case
                when p_reveal_hidden then round_row.state -> 'crash_point'
                else null
            end
        );
    end if;
    return result;
end;
$$;

create or replace function public.jva_expire_arcade_round(p_round_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    round_row public.jva_arcade_rounds;
begin
    select * into round_row from public.jva_arcade_rounds
    where id = p_round_id for update;
    if not found
       or round_row.status <> 'active'
       or round_row.created_at > clock_timestamp() - interval '30 minutes' then
        return false;
    end if;

    perform 1 from public.jva_financial_accounts
    where account_key = 'game:' || round_row.game_key
    for update;
    update public.jva_game_reservations
    set status = 'released', amount_tokens = 0, updated_at = now()
    where id = round_row.reservation_id and status = 'held';
    update public.jva_arcade_rounds
    set status = case when round_row.game_key = 'crash' then 'crashed' else 'lost' end,
        state = state || jsonb_build_object('expired', true),
        updated_at = now()
    where id = round_row.id;
    update public.jva_game_bets
    set outcome = 'loss',
        payout_snapshot = payout_snapshot || jsonb_build_object('expired', true)
    where request_id = round_row.request_id;
    return true;
end;
$$;

create or replace function public.jva_get_my_arcade_round(p_game_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    round_row public.jva_arcade_rounds;
    current_multiplier numeric;
    crash_point numeric;
    elapsed_seconds numeric;
begin
    if current_user_id is null or p_game_key not in ('mines', 'crash') then
        raise exception 'No se puede consultar la partida.';
    end if;
    perform public.jva_require_active_user(current_user_id);
    select * into round_row
    from public.jva_arcade_rounds
    where user_id = current_user_id and game_key = p_game_key and status = 'active'
    for update;
    if not found then
        return null;
    end if;
    if public.jva_expire_arcade_round(round_row.id) then
        return null;
    end if;
    if round_row.game_key = 'crash' then
        elapsed_seconds := greatest(
            0,
            extract(epoch from (clock_timestamp() - round_row.created_at))::numeric
        );
        current_multiplier := least(
            1 + floor(elapsed_seconds * (round_row.state ->> 'growth_per_second')::numeric * 100) / 100,
            (round_row.state ->> 'max_multiplier')::numeric
        );
        crash_point := least(
            (round_row.state ->> 'crash_point')::numeric,
            (round_row.state ->> 'max_multiplier')::numeric
        );
        if current_multiplier >= crash_point then
            perform 1 from public.jva_financial_accounts
            where account_key = 'game:crash'
            for update;
            update public.jva_game_reservations
            set status = 'released', amount_tokens = 0, updated_at = now()
            where id = round_row.reservation_id and status = 'held';
            update public.jva_arcade_rounds
            set status = 'crashed', updated_at = now()
            where id = round_row.id;
            update public.jva_game_bets
            set outcome = 'loss',
                payout_snapshot = payout_snapshot || jsonb_build_object(
                    'crash_multiplier', crash_point
                )
            where request_id = round_row.request_id;
            return jsonb_build_object(
                'round_id', round_row.id,
                'game_key', 'crash',
                'status', 'crashed',
                'crash_multiplier', crash_point,
                'payout_tokens', 0
            );
        end if;
    end if;
    return public.jva_get_arcade_round_json(round_row.id, false);
end;
$$;

create or replace function public.jva_play_arcade_action(
    p_round_id uuid,
    p_action text,
    p_cell integer,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    round_row public.jva_arcade_rounds;
    existing_action public.jva_arcade_actions;
    wallet_key text;
    mine_positions integer[];
    revealed_cells integer[];
    mine_count integer;
    safe_count integer;
    next_cell integer;
    should_cashout boolean := false;
    safe_probability numeric := 1;
    step_number integer;
    multiplier numeric;
    payout_value bigint := 0;
    elapsed_seconds numeric;
    crash_point numeric;
    current_multiplier numeric;
    result_value jsonb;
    state_value jsonb;
    journal_request_id uuid;
    entry_id uuid;
    multiplier_preview numeric;
    outcome_value text;
begin
    if current_user_id is null or p_round_id is null or p_request_id is null
       or p_action not in ('reveal', 'cashout') then
        raise exception 'La acción de la partida no es válida.';
    end if;
    if (p_action = 'reveal' and (p_cell is null or p_cell not between 0 and 24))
       or (p_action = 'cashout' and p_cell is not null) then
        raise exception 'La casilla indicada no es válida.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    select * into existing_action from public.jva_arcade_actions
    where request_id = p_request_id;
    if found then
        if existing_action.user_id <> current_user_id
           or existing_action.round_id <> p_round_id
           or existing_action.action <> p_action
           or existing_action.cell is distinct from p_cell then
            raise exception 'El identificador de acción ya fue utilizado.';
        end if;
        return existing_action.result || jsonb_build_object('replayed', true);
    end if;

    select * into round_row
    from public.jva_arcade_rounds
    where id = p_round_id
    for update;
    if not found or round_row.user_id <> current_user_id then
        raise exception 'No existe una partida activa para tu cuenta.';
    end if;
    if public.jva_expire_arcade_round(round_row.id) then
        return jsonb_build_object(
            'round_id', round_row.id,
            'status', 'expired',
            'payout_tokens', 0
        );
    end if;
    if round_row.status <> 'active' then
        raise exception 'La partida ya terminó.';
    end if;
    perform public.jva_require_active_user(current_user_id);
    perform 1 from public.jva_financial_accounts
    where account_key in ('game:' || round_row.game_key, 'player:' || current_user_id::text)
    order by account_key
    for update;

    if round_row.game_key = 'mines' then
        if p_action = 'cashout' then
            revealed_cells := array(
                select value::integer
                from jsonb_array_elements_text(round_row.state -> 'revealed')
            );
            safe_count := cardinality(revealed_cells);
            if safe_count = 0 then
                raise exception 'Descubre al menos una casilla antes de cobrar.';
            end if;
            mine_count := (round_row.state ->> 'mine_count')::integer;
            for step_number in 0..safe_count - 1 loop
                safe_probability := safe_probability
                    * (25 - mine_count - step_number)::numeric
                    / (25 - step_number)::numeric;
            end loop;
            multiplier := least(
                (1 - (round_row.state ->> 'house_share_percent')::numeric / 100)
                    / safe_probability,
                (round_row.state ->> 'max_multiplier')::numeric
            );
            payout_value := least(
                floor(round_row.stake_tokens * multiplier)::bigint,
                round_row.maximum_payout_tokens
            );
            outcome_value := 'cashed_out';
            should_cashout := true;
        else
            mine_positions := array(
                select value::integer
                from jsonb_array_elements_text(round_row.state -> 'mine_positions')
            );
            revealed_cells := array(
                select value::integer
                from jsonb_array_elements_text(round_row.state -> 'revealed')
            );
            if p_cell = any(revealed_cells) then
                raise exception 'Ya descubriste esa casilla.';
            end if;
            revealed_cells := array_append(revealed_cells, p_cell);
            mine_count := (round_row.state ->> 'mine_count')::integer;
            if p_cell = any(mine_positions) then
                outcome_value := 'lost';
                update public.jva_game_reservations
                set status = 'released', amount_tokens = 0, updated_at = now()
                where id = round_row.reservation_id and status = 'held';
                update public.jva_arcade_rounds
                set status = 'lost',
                    state = state || jsonb_build_object('revealed', to_jsonb(revealed_cells)),
                    updated_at = now()
                where id = round_row.id;
                update public.jva_game_bets
                set outcome = 'loss',
                    payout_snapshot = payout_snapshot || jsonb_build_object(
                        'revealed', revealed_cells,
                        'mine_positions', mine_positions
                    )
                where request_id = round_row.request_id;
                result_value := jsonb_build_object(
                    'round_id', round_row.id,
                    'status', 'lost',
                    'hit_mine', true,
                    'revealed', revealed_cells,
                    'mine_positions', mine_positions,
                    'payout_tokens', 0
                );
            end if;
        end if;
    else
        if p_action <> 'cashout' then
            raise exception 'En Crash solo puedes cobrar la partida.';
        end if;
        elapsed_seconds := greatest(
            0,
            extract(epoch from (clock_timestamp() - round_row.created_at))::numeric
        );
        current_multiplier := least(
            1 + floor(elapsed_seconds * (round_row.state ->> 'growth_per_second')::numeric * 100) / 100,
            (round_row.state ->> 'max_multiplier')::numeric
        );
        crash_point := least(
            (round_row.state ->> 'crash_point')::numeric,
            (round_row.state ->> 'max_multiplier')::numeric
        );
        if current_multiplier >= crash_point then
            outcome_value := 'crashed';
            update public.jva_game_reservations
            set status = 'released', amount_tokens = 0, updated_at = now()
            where id = round_row.reservation_id and status = 'held';
            update public.jva_arcade_rounds
            set status = 'crashed', updated_at = now()
            where id = round_row.id;
            update public.jva_game_bets
            set outcome = 'loss',
                payout_snapshot = payout_snapshot || jsonb_build_object(
                    'crash_multiplier', crash_point
                )
            where request_id = round_row.request_id;
            result_value := jsonb_build_object(
                'round_id', round_row.id,
                'status', 'crashed',
                'crash_multiplier', crash_point,
                'payout_tokens', 0
            );
        else
            multiplier := current_multiplier;
            payout_value := least(
                floor(round_row.stake_tokens * multiplier)::bigint,
                round_row.maximum_payout_tokens
            );
            outcome_value := 'cashed_out';
            should_cashout := true;
        end if;
    end if;

    if round_row.game_key = 'mines' and p_action = 'reveal'
       and outcome_value is distinct from 'lost' then
        mine_positions := array(
            select value::integer
            from jsonb_array_elements_text(round_row.state -> 'mine_positions')
        );
        safe_count := cardinality(revealed_cells);
        for step_number in 0..safe_count - 1 loop
            safe_probability := safe_probability
                * (25 - (round_row.state ->> 'mine_count')::integer - step_number)::numeric
                / (25 - step_number)::numeric;
        end loop;
        multiplier_preview := least(
            (1 - (round_row.state ->> 'house_share_percent')::numeric / 100)
                / safe_probability,
            (round_row.state ->> 'max_multiplier')::numeric
        );
        if safe_count = 25 - (round_row.state ->> 'mine_count')::integer then
            should_cashout := true;
            outcome_value := 'cashed_out';
        else
            outcome_value := 'active';
        end if;

        state_value := round_row.state || jsonb_build_object('revealed', to_jsonb(revealed_cells));
        update public.jva_arcade_rounds
        set state = state_value, updated_at = now()
        where id = round_row.id;
        if should_cashout then
            multiplier := multiplier_preview;
            payout_value := least(
                floor(round_row.stake_tokens * multiplier)::bigint,
                round_row.maximum_payout_tokens
            );
        end if;
        result_value := jsonb_build_object(
            'round_id', round_row.id,
            'status', case when should_cashout then 'cashed_out' else 'active' end,
            'hit_mine', false,
            'revealed', revealed_cells,
            'mine_count', round_row.state -> 'mine_count',
            'multiplier', multiplier_preview,
            'cashout_tokens', least(
                floor(round_row.stake_tokens * multiplier_preview)::bigint,
                round_row.maximum_payout_tokens
            ),
            'payout_tokens', case when should_cashout then payout_value else 0 end
        );
    end if;

    if should_cashout then
        if payout_value <= 0 then
            raise exception 'El pozo no puede cubrir un premio en esta partida.';
        end if;
        wallet_key := 'player:' || current_user_id::text;
        journal_request_id := p_request_id;
        entry_id := public.jva_post_journal(
            journal_request_id,
            'arcade_payout',
            current_user_id,
            jsonb_build_object(
                'round_id', round_row.id,
                'payout_tokens', payout_value,
                'multiplier', multiplier
            ),
            case when round_row.game_key = 'mines' then 'Premio de Minas' else 'Premio de Crash' end,
            jsonb_build_array(
                jsonb_build_object('account', 'game:' || round_row.game_key, 'side', 'debit', 'amount', payout_value),
                jsonb_build_object('account', wallet_key, 'side', 'credit', 'amount', payout_value)
            )
        );
        update public.jva_game_reservations
        set status = 'paid', amount_tokens = 0, updated_at = now()
        where id = round_row.reservation_id and status = 'held';
        update public.jva_arcade_rounds
        set status = 'cashed_out', updated_at = now()
        where id = round_row.id;
        update public.jva_game_bets
        set outcome = 'win',
            payout_tokens = payout_value,
            payout_snapshot = payout_snapshot || jsonb_build_object(
                'multiplier', multiplier,
                'payout_tokens', payout_value
            )
        where request_id = round_row.request_id;
        result_value := coalesce(result_value, '{}'::jsonb) || jsonb_build_object(
            'round_id', round_row.id,
            'status', 'cashed_out',
            'multiplier', multiplier,
            'payout_tokens', payout_value,
            'crash_multiplier', case
                when round_row.game_key = 'crash' then round_row.state -> 'crash_point'
                else null
            end
        );
    end if;

    if p_action = 'cashout' or outcome_value in ('lost', 'crashed') then
        if p_action = 'cashout' and not should_cashout then
            result_value := coalesce(result_value, '{}'::jsonb);
        end if;
    end if;
    if result_value is null then
        result_value := jsonb_build_object(
            'round_id', round_row.id,
            'status', 'active'
        );
    end if;

    insert into public.jva_arcade_actions (
        request_id, round_id, user_id, action, cell, result
    )
    values (p_request_id, round_row.id, current_user_id, p_action, p_cell, result_value);

    return result_value || jsonb_build_object('replayed', false);
end;
$$;

create or replace function public.jva_get_jackpot_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    game public.jva_games;
    draw_row public.jva_jackpot_draws;
    result jsonb;
begin
    if current_user_id is null then
        raise exception 'Debes iniciar sesión para consultar el Jackpot.';
    end if;
    perform public.jva_require_active_user(current_user_id);
    select * into game from public.jva_games where game_key = 'jackpot';
    select * into draw_row from public.jva_jackpot_draws
    where status = 'open' order by opened_at desc limit 1;
    result := jsonb_build_object(
        'enabled', game.enabled,
        'entry_price_tokens', (game.arcade_settings ->> 'entry_price_tokens')::bigint,
        'minimum_entry_price_tokens', ceil(100 / game.house_share_percent)::bigint,
        'house_share_percent', game.house_share_percent,
        'draw_interval_hours', (game.arcade_settings ->> 'draw_interval_hours')::integer,
        'prize_pool_tokens', public.jva_available_prize_tokens('jackpot'),
        'draw_id', draw_row.id,
        'draw_number', draw_row.draw_number,
        'draw_opened_at', draw_row.opened_at,
        'entries_count', (
            select count(*) from public.jva_jackpot_entries entry
            where entry.draw_id = draw_row.id
        ),
        'my_entries_count', (
            select count(*) from public.jva_jackpot_entries entry
            where entry.draw_id = draw_row.id and entry.user_id = current_user_id
        )
    );
    return result;
end;
$$;

create or replace function public.jva_join_jackpot(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    game public.jva_games;
    draw_row public.jva_jackpot_draws;
    existing_entry public.jva_jackpot_entries;
    wallet_key text;
    player_balance bigint;
    entry_price bigint;
    house_amount bigint;
    contribution bigint;
    entry_id uuid := extensions.gen_random_uuid();
    pool_after bigint;
begin
    if current_user_id is null or p_request_id is null then
        raise exception 'Debes iniciar sesión para entrar al Jackpot.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    select * into existing_entry from public.jva_jackpot_entries
    where request_id = p_request_id;
    if found then
        if existing_entry.user_id <> current_user_id then
            raise exception 'El identificador de solicitud ya fue utilizado.';
        end if;
        select * into draw_row
        from public.jva_jackpot_draws
        where id = existing_entry.draw_id;
        return jsonb_build_object(
            'entry_id', existing_entry.id,
            'draw_id', existing_entry.draw_id,
            'draw_number', draw_row.draw_number,
            'price_tokens', existing_entry.price_tokens,
            'prize_pool_tokens', public.jva_available_prize_tokens('jackpot'),
            'replayed', true
        );
    end if;

    perform public.jva_require_active_user(current_user_id);
    select * into game from public.jva_games
    where game_key = 'jackpot' for update;
    if not game.enabled then
        raise exception 'El Jackpot está pausado.';
    end if;
    select * into draw_row from public.jva_jackpot_draws
    where status = 'open' for update;
    if not found then
        raise exception 'No hay un sorteo de Jackpot abierto.';
    end if;
    entry_price := (game.arcade_settings ->> 'entry_price_tokens')::bigint;
    house_amount := floor(entry_price * game.house_share_percent / 100)::bigint;
    contribution := entry_price - house_amount;
    if house_amount <= 0 or contribution <= 0 then
        raise exception 'La entrada mínima del Jackpot es de % fichas.',
            ceil(100 / game.house_share_percent)::bigint;
    end if;

    wallet_key := 'player:' || current_user_id::text;
    perform 1 from public.jva_financial_accounts
    where account_key in ('game:jackpot', wallet_key)
    order by account_key
    for update;
    select balance_tokens into player_balance
    from public.jva_financial_accounts where account_key = wallet_key;
    if player_balance < entry_price then
        raise exception 'No tienes suficientes fichas para entrar al Jackpot.';
    end if;

    perform public.jva_post_journal(
        p_request_id,
        'jackpot_entry',
        current_user_id,
        jsonb_build_object(
            'draw_id', draw_row.id,
            'user_id', current_user_id,
            'price_tokens', entry_price
        ),
        'Entrada al Jackpot',
        jsonb_build_array(
            jsonb_build_object('account', wallet_key, 'side', 'debit', 'amount', entry_price),
            jsonb_build_object('account', 'house_earnings', 'side', 'credit', 'amount', house_amount),
            jsonb_build_object('account', 'game:jackpot', 'side', 'credit', 'amount', contribution)
        )
    );

    insert into public.jva_jackpot_entries (
        id, draw_id, user_id, request_id, price_tokens
    )
    values (entry_id, draw_row.id, current_user_id, p_request_id, entry_price);
    insert into public.jva_game_bets (
        request_id, game_key, user_id, stake_tokens,
        maximum_payout_tokens, outcome, payout_snapshot
    )
    values (
        p_request_id, 'jackpot', current_user_id, entry_price,
        greatest(1, public.jva_available_prize_tokens('jackpot')),
        'jackpot_entry',
        jsonb_build_object('draw_id', draw_row.id, 'entry_id', entry_id)
    );

    pool_after := public.jva_available_prize_tokens('jackpot');
    return jsonb_build_object(
        'entry_id', entry_id,
        'draw_id', draw_row.id,
        'draw_number', draw_row.draw_number,
        'price_tokens', entry_price,
        'prize_pool_tokens', pool_after,
        'replayed', false
    );
end;
$$;

create or replace function public.jva_open_jackpot_draw()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    draw_row public.jva_jackpot_draws;
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede abrir un sorteo de Jackpot.';
    end if;
    perform 1 from public.jva_games where game_key = 'jackpot' and enabled for update;
    if not found then
        raise exception 'Activa el Jackpot antes de abrir un sorteo.';
    end if;
    if exists (select 1 from public.jva_jackpot_draws where status = 'open') then
        raise exception 'Ya hay un sorteo de Jackpot abierto.';
    end if;
    insert into public.jva_jackpot_draws (opened_by)
    values (current_user_id)
    returning * into draw_row;
    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id)
    values (current_user_id, 'jackpot_draw_opened', 'jackpot_draw', draw_row.id::text);
    return jsonb_build_object(
        'draw_id', draw_row.id,
        'draw_number', draw_row.draw_number,
        'opened_at', draw_row.opened_at
    );
end;
$$;

create or replace function public.jva_settle_jackpot_draw(
    p_draw_id uuid,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    draw_row public.jva_jackpot_draws;
    winner_row public.jva_jackpot_entries;
    entry_count bigint;
    winning_offset bigint;
    prize_value bigint;
    winner_wallet text;
    entry_id uuid;
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede realizar el sorteo de Jackpot.';
    end if;
    if p_draw_id is null or p_request_id is null then
        raise exception 'El sorteo indicado no es válido.';
    end if;

    select * into draw_row from public.jva_jackpot_draws
    where id = p_draw_id for update;
    if not found then
        raise exception 'No existe el sorteo indicado.';
    end if;
    if draw_row.status = 'settled' then
        return jsonb_build_object(
            'draw_id', draw_row.id,
            'draw_number', draw_row.draw_number,
            'winner_user_id', draw_row.winner_user_id,
            'prize_tokens', draw_row.prize_tokens,
            'already_settled', true,
            'no_entries', draw_row.winner_user_id is null
        );
    end if;

    perform 1 from public.jva_financial_accounts
    where account_key = 'game:jackpot'
    for update;
    select count(*) into entry_count
    from public.jva_jackpot_entries where draw_id = p_draw_id;
    if entry_count = 0 then
        update public.jva_jackpot_draws
        set status = 'settled',
            settled_by = current_user_id,
            settled_at = now(),
            prize_tokens = 0
        where id = draw_row.id;
        insert into public.jva_admin_audit (
            actor_id, action, entity_type, entity_id, details
        )
        values (
            current_user_id,
            'jackpot_draw_settled_empty',
            'jackpot_draw',
            draw_row.id::text,
            jsonb_build_object('entries', 0, 'prize_tokens', 0)
        );
        return jsonb_build_object(
            'draw_id', draw_row.id,
            'draw_number', draw_row.draw_number,
            'winner_user_id', null,
            'prize_tokens', 0,
            'no_entries', true
        );
    end if;
    winning_offset := public.jva_random_int(entry_count::integer);
    select * into winner_row
    from public.jva_jackpot_entries
    where draw_id = p_draw_id
    order by created_at, id
    offset winning_offset
    limit 1;
    prize_value := public.jva_available_prize_tokens('jackpot');
    if prize_value <= 0 then
        raise exception 'El pozo del Jackpot no tiene fichas disponibles.';
    end if;
    winner_wallet := 'player:' || winner_row.user_id::text;
    entry_id := public.jva_post_journal(
        p_request_id,
        'jackpot_prize',
        current_user_id,
        jsonb_build_object(
            'draw_id', draw_row.id,
            'winner_user_id', winner_row.user_id,
            'prize_tokens', prize_value
        ),
        'Premio del sorteo Jackpot',
        jsonb_build_array(
            jsonb_build_object('account', 'game:jackpot', 'side', 'debit', 'amount', prize_value),
            jsonb_build_object('account', winner_wallet, 'side', 'credit', 'amount', prize_value)
        )
    );

    update public.jva_jackpot_draws
    set status = 'settled',
        settled_by = current_user_id,
        settled_at = now(),
        winner_user_id = winner_row.user_id,
        prize_tokens = prize_value
    where id = draw_row.id;
    update public.jva_game_bets
    set outcome = 'win',
        payout_tokens = prize_value,
        payout_snapshot = payout_snapshot || jsonb_build_object(
            'prize_tokens', prize_value,
            'draw_id', draw_row.id
        )
    where request_id in (
        select entry.request_id
        from public.jva_jackpot_entries entry
        where entry.draw_id = draw_row.id and entry.user_id = winner_row.user_id
        order by entry.created_at, entry.id
        limit 1
    );
    insert into public.jva_admin_audit (
        actor_id, action, entity_type, entity_id, details
    )
    values (
        current_user_id,
        'jackpot_draw_settled',
        'jackpot_draw',
        draw_row.id::text,
        jsonb_build_object(
            'winner_user_id', winner_row.user_id,
            'prize_tokens', prize_value,
            'journal_entry_id', entry_id
        )
    );

    return jsonb_build_object(
        'draw_id', draw_row.id,
        'draw_number', draw_row.draw_number,
        'winner_user_id', winner_row.user_id,
        'prize_tokens', prize_value,
        'already_settled', false
    );
end;
$$;

create or replace function public.jva_get_public_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'settings', jsonb_build_object(
            'unverified_login_limit', settings.unverified_login_limit,
            'organizer_whatsapp', settings.organizer_whatsapp,
            'lottery_ticket_price', settings.lottery_ticket_price
        ),
        'games', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'key', game.game_key,
                'title', game.title,
                'enabled', game.enabled,
                'house_share_percent', game.house_share_percent,
                'payout_includes_stake', game.payout_includes_stake,
                'max_jackpot_multiplier', game.max_jackpot_multiplier,
                'max_pair_multiplier', game.max_pair_multiplier,
                'jackpot_probability_bps', game.jackpot_probability_bps,
                'pair_probability_bps', game.pair_probability_bps,
                'prize_shares', game.prize_shares,
                'arcade_settings', game.arcade_settings
            ) order by game.game_key), '[]'::jsonb)
            from public.jva_games game
        ),
        'modules', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'key', module.module_key,
                'visible', module.visible,
                'order', module.sort_order,
                'settings', module.settings
            ) order by module.sort_order, module.module_key), '[]'::jsonb)
            from public.jva_site_modules module
        ),
        'ticket_templates', (
            select coalesce(jsonb_object_agg(template.template_kind, template.definition), '{}'::jsonb)
            from public.jva_ticket_templates template
        ),
        'open_lottery_draw', (
            select jsonb_build_object('id', draw.id, 'draw_number', draw.draw_number)
            from public.jva_lottery_draws draw
            where draw.status = 'open' and draw.game_key = 'lottery'
            limit 1
        ),
        'open_jackpot_draw', (
            select jsonb_build_object('id', draw.id, 'draw_number', draw.draw_number)
            from public.jva_jackpot_draws draw
            where draw.status = 'open'
            limit 1
        )
    )
    from public.jva_platform_settings settings
    where settings.id = 1;
$$;

create or replace function public.jva_update_site_modules(p_modules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    item jsonb;
    requested_module_key text;
    desired_order integer;
    visible_value boolean;
    enabled_value boolean;
begin
    if not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Se requiere el rol de administrador maestro.';
    end if;
    if p_modules is null or jsonb_typeof(p_modules) <> 'array'
       or jsonb_array_length(p_modules) > 20 then
        raise exception 'La lista de módulos no es válida.';
    end if;

    for item in select value from jsonb_array_elements(p_modules)
    loop
        if jsonb_typeof(item) <> 'object' then
            raise exception 'El módulo contiene una opción inválida.';
        end if;
        requested_module_key := item ->> 'key';
        if coalesce(item ->> 'order', '') !~ '^[0-9]{1,6}$'
           or coalesce(item ->> 'visible', '') not in ('true', 'false') then
            raise exception 'El módulo contiene una opción inválida.';
        end if;
        desired_order := (item ->> 'order')::integer;
        visible_value := (item ->> 'visible')::boolean;
        if requested_module_key is null
           or requested_module_key not in (
               'home', 'lottery', 'slots', 'tables', 'chat', 'winners',
               'dice', 'mines', 'crash', 'wheel', 'jackpot'
           )
           or desired_order < 0 then
            raise exception 'El módulo contiene una opción no permitida.';
        end if;
        if requested_module_key = 'home' and not visible_value then
            raise exception 'La sección Inicio debe permanecer visible.';
        end if;
        if visible_value and requested_module_key in (
            'lottery', 'slots', 'tables', 'dice', 'mines', 'crash', 'wheel', 'jackpot'
        ) then
            select enabled into enabled_value
            from public.jva_games where game_key = requested_module_key;
            if not coalesce(enabled_value, false) then
                raise exception 'No se puede mostrar un juego que está pausado.';
            end if;
            if requested_module_key = 'tables' then
                raise exception 'Las mesas siguen en migración y no se pueden mostrar.';
            end if;
        elsif visible_value and requested_module_key in ('chat', 'winners') then
            raise exception 'Este módulo todavía no está habilitado para producción.';
        end if;

        update public.jva_site_modules
        set visible = visible_value,
            sort_order = desired_order,
            updated_by = (select auth.uid()),
            updated_at = now()
        where module_key = requested_module_key;
    end loop;

    insert into public.jva_admin_audit (
        actor_id, action, entity_type, entity_id, details
    )
    values (
        (select auth.uid()), 'site_modules_updated', 'site', 'modules',
        jsonb_build_object('modules', p_modules)
    );
end;
$$;

revoke all on function public.jva_random_int(integer) from public, anon, authenticated;
revoke all on function public.jva_get_arcade_round_json(uuid, boolean) from public, anon, authenticated;
revoke all on function public.jva_expire_arcade_round(uuid) from public, anon, authenticated;
revoke all on function public.jva_update_arcade_game_config(text, boolean, numeric, jsonb)
    from public, anon;
revoke all on function public.jva_get_arcade_status(text) from public, anon;
revoke all on function public.jva_play_instant_arcade(text, bigint, text, uuid)
    from public, anon;
revoke all on function public.jva_start_arcade_round(text, bigint, uuid)
    from public, anon;
revoke all on function public.jva_get_my_arcade_round(text) from public, anon;
revoke all on function public.jva_play_arcade_action(uuid, text, integer, uuid)
    from public, anon;
revoke all on function public.jva_get_jackpot_status() from public, anon;
revoke all on function public.jva_join_jackpot(uuid) from public, anon;
revoke all on function public.jva_open_jackpot_draw() from public, anon;
revoke all on function public.jva_settle_jackpot_draw(uuid, uuid) from public, anon;

grant execute on function public.jva_update_arcade_game_config(text, boolean, numeric, jsonb)
    to authenticated;
grant execute on function public.jva_get_arcade_status(text) to authenticated;
grant execute on function public.jva_play_instant_arcade(text, bigint, text, uuid)
    to authenticated;
grant execute on function public.jva_start_arcade_round(text, bigint, uuid)
    to authenticated;
grant execute on function public.jva_get_my_arcade_round(text) to authenticated;
grant execute on function public.jva_play_arcade_action(uuid, text, integer, uuid)
    to authenticated;
grant execute on function public.jva_get_jackpot_status() to authenticated;
grant execute on function public.jva_join_jackpot(uuid) to authenticated;
grant execute on function public.jva_open_jackpot_draw() to authenticated;
grant execute on function public.jva_settle_jackpot_draw(uuid, uuid) to authenticated;
