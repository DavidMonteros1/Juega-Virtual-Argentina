create extension if not exists pgcrypto with schema extensions;

create table public.jva_platform_settings (
    id smallint primary key check (id = 1),
    signup_bonus_tokens bigint not null default 0 check (signup_bonus_tokens >= 0),
    unverified_login_limit integer not null default 5 check (unverified_login_limit between 1 and 100),
    organizer_whatsapp text not null default '5491157054802'
        check (organizer_whatsapp ~ '^[1-9][0-9]{7,14}$'),
    lottery_ticket_price bigint not null default 10 check (lottery_ticket_price > 0),
    updated_at timestamptz not null default now()
);

insert into public.jva_platform_settings (id) values (1);

create table public.jva_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
    phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
    created_at timestamptz not null default now()
);

create unique index jva_profiles_username_ci on public.jva_profiles (lower(username));
create unique index jva_profiles_phone_unique on public.jva_profiles (phone_e164);

create table public.jva_account_security (
    user_id uuid primary key references auth.users(id) on delete cascade,
    successful_signins integer not null default 0 check (successful_signins >= 0),
    verification_required boolean not null default false,
    manually_verified_at timestamptz,
    access_blocked_at timestamptz,
    access_blocked_by uuid references auth.users(id) on delete set null,
    access_block_reason text check (
        access_block_reason is null or length(trim(access_block_reason)) between 3 and 200
    ),
    updated_at timestamptz not null default now()
);

create table public.jva_user_roles (
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('super_admin', 'admin', 'cashier')),
    created_at timestamptz not null default now(),
    primary key (user_id, role)
);

create table public.jva_games (
    game_key text primary key check (game_key in ('slots', 'lottery', 'tables')),
    title text not null,
    enabled boolean not null default false,
    house_share_percent numeric(5, 2) not null default 30
        check (house_share_percent > 0 and house_share_percent < 100),
    payout_includes_stake boolean not null default true,
    max_jackpot_multiplier numeric(8, 2) not null default 3
        check (max_jackpot_multiplier >= 1 and max_jackpot_multiplier <= 1000),
    max_pair_multiplier numeric(8, 2) not null default 1.5
        check (max_pair_multiplier >= 0 and max_pair_multiplier <= 1000),
    jackpot_probability_bps integer not null default 500
        check (jackpot_probability_bps between 0 and 10000),
    pair_probability_bps integer not null default 1500
        check (pair_probability_bps between 0 and 10000),
    prize_shares jsonb not null default '{"15":40,"14":25,"13":15,"12":12,"11":8}'::jsonb
        check (jsonb_typeof(prize_shares) = 'object'),
    updated_by uuid references auth.users(id),
    updated_at timestamptz not null default now(),
    constraint jva_slot_probabilities_valid check (
        jackpot_probability_bps + pair_probability_bps <= 10000
    )
);

insert into public.jva_games (game_key, title)
values
    ('slots', 'Tragamonedas'),
    ('lottery', 'Lotería 15 de 25'),
    ('tables', 'Mesas')
;

create table public.jva_financial_accounts (
    account_key text primary key,
    account_type text not null check (
        account_type in ('asset', 'player_liability', 'game_prize_liability', 'house_income')
    ),
    normal_side text not null check (normal_side in ('debit', 'credit')),
    owner_user_id uuid references auth.users(id),
    game_key text references public.jva_games(game_key),
    balance_tokens bigint not null default 0 check (balance_tokens >= 0),
    created_at timestamptz not null default now(),
    constraint jva_financial_account_shape check (
        (account_type = 'asset' and normal_side = 'debit' and owner_user_id is null and game_key is null)
        or (account_type = 'house_income' and normal_side = 'credit' and owner_user_id is null and game_key is null)
        or (account_type = 'player_liability' and normal_side = 'credit' and owner_user_id is not null and game_key is null)
        or (account_type = 'game_prize_liability' and normal_side = 'credit' and owner_user_id is null and game_key is not null)
    )
);

create unique index jva_one_wallet_per_user
    on public.jva_financial_accounts (owner_user_id)
    where account_type = 'player_liability';

create unique index jva_one_prize_fund_per_game
    on public.jva_financial_accounts (game_key)
    where account_type = 'game_prize_liability';

insert into public.jva_financial_accounts (account_key, account_type, normal_side)
values
    ('physical_tokens', 'asset', 'debit'),
    ('house_earnings', 'house_income', 'credit');

insert into public.jva_financial_accounts (account_key, account_type, normal_side, game_key)
select 'game:' || game_key, 'game_prize_liability', 'credit', game_key
from public.jva_games;

create table public.jva_journal_entries (
    id uuid primary key default extensions.gen_random_uuid(),
    request_id uuid not null unique,
    operation text not null,
    actor_id uuid references auth.users(id),
    request_payload jsonb not null,
    description text not null check (length(trim(description)) between 1 and 300),
    created_at timestamptz not null default now()
);

create table public.jva_journal_lines (
    entry_id uuid not null references public.jva_journal_entries(id),
    line_number smallint not null,
    account_key text not null references public.jva_financial_accounts(account_key),
    side text not null check (side in ('debit', 'credit')),
    amount_tokens bigint not null check (amount_tokens > 0),
    primary key (entry_id, line_number)
);

create index jva_journal_lines_account on public.jva_journal_lines (account_key, entry_id);

create table public.jva_game_reservations (
    id uuid primary key default extensions.gen_random_uuid(),
    game_key text not null references public.jva_games(game_key),
    source_type text not null check (source_type in ('slot_bet', 'lottery_ticket')),
    source_id uuid not null,
    owner_user_id uuid not null references auth.users(id),
    amount_tokens bigint not null check (amount_tokens >= 0),
    status text not null check (status in ('held', 'claimable', 'paid', 'released')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_type, source_id)
);

create index jva_game_reservations_open
    on public.jva_game_reservations (game_key, amount_tokens)
    where status in ('held', 'claimable');

create table public.jva_game_bets (
    id uuid primary key default extensions.gen_random_uuid(),
    request_id uuid not null unique,
    game_key text not null references public.jva_games(game_key),
    user_id uuid not null references auth.users(id),
    stake_tokens bigint not null check (stake_tokens > 0),
    maximum_payout_tokens bigint not null check (maximum_payout_tokens > 0),
    payout_tokens bigint not null default 0 check (payout_tokens >= 0),
    outcome text not null check (outcome in ('jackpot', 'pair', 'loss')),
    payout_snapshot jsonb not null,
    created_at timestamptz not null default now()
);

create index jva_game_bets_game_created on public.jva_game_bets (game_key, created_at desc);
create index jva_game_bets_user_created on public.jva_game_bets (user_id, created_at desc);

create table public.jva_lottery_draws (
    id uuid primary key default extensions.gen_random_uuid(),
    draw_number bigint generated always as identity unique,
    game_key text not null default 'lottery' references public.jva_games(game_key),
    status text not null default 'open' check (status in ('open', 'settled')),
    drawn_numbers integer[],
    opened_by uuid not null references auth.users(id),
    opened_at timestamptz not null default now(),
    settled_by uuid references auth.users(id),
    settled_at timestamptz,
    constraint jva_draw_number_count check (
        drawn_numbers is null or cardinality(drawn_numbers) = 15
    )
);

create unique index jva_one_open_lottery_draw
    on public.jva_lottery_draws (game_key)
    where status = 'open';

create or replace function public.jva_ticket_numbers_are_unique(numbers integer[])
returns boolean
language sql
immutable
strict
as $$
    select cardinality(numbers) = count(distinct drawn_number)
    from unnest(numbers) as drawn(drawn_number);
$$;

create table public.jva_lottery_tickets (
    id uuid primary key default extensions.gen_random_uuid(),
    ticket_number bigint generated always as identity unique,
    draw_id uuid not null references public.jva_lottery_draws(id),
    buyer_id uuid not null references auth.users(id),
    sold_by uuid not null references auth.users(id),
    payment_method text not null check (payment_method in ('digital', 'physical')),
    price_tokens bigint not null check (price_tokens > 0),
    numbers integer[] not null check (
        cardinality(numbers) = 15
        and numbers <@ array[
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
            14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25
        ]::integer[]
    ),
    prize_preview_tokens jsonb not null,
    reservation_id uuid references public.jva_game_reservations(id),
    prize_tokens bigint not null default 0 check (prize_tokens >= 0),
    prize_claimed_at timestamptz,
    request_id uuid not null unique,
    created_at timestamptz not null default now(),
    constraint jva_ticket_numbers_unique
        check (public.jva_ticket_numbers_are_unique(numbers))
);

create index jva_lottery_tickets_buyer_created
    on public.jva_lottery_tickets (buyer_id, created_at desc);
create index jva_lottery_tickets_draw on public.jva_lottery_tickets (draw_id);

create table public.jva_site_modules (
    module_key text primary key check (
        module_key in ('home', 'lottery', 'slots', 'tables', 'chat', 'winners')
    ),
    visible boolean not null default false,
    sort_order integer not null default 0 check (sort_order >= 0),
    settings jsonb not null default '{}'::jsonb check (
        jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 8192
    ),
    updated_by uuid references auth.users(id),
    updated_at timestamptz not null default now()
);

insert into public.jva_site_modules (module_key, visible, sort_order)
values
    ('home', true, 0),
    ('lottery', false, 1),
    ('slots', false, 2),
    ('tables', false, 3),
    ('chat', false, 4),
    ('winners', false, 5);

create table public.jva_ticket_templates (
    template_kind text primary key check (template_kind in ('web', 'thermal')),
    definition jsonb not null check (
        jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 32768
    ),
    updated_by uuid references auth.users(id),
    updated_at timestamptz not null default now()
);

insert into public.jva_ticket_templates (template_kind, definition)
values
    ('web', '{"width":900,"height":560,"background":"#ffffff","elements":[]}'::jsonb),
    ('thermal', '{"width":384,"height":900,"background":"#ffffff","elements":[]}'::jsonb);

create table public.jva_user_activity (
    user_id uuid primary key references auth.users(id) on delete cascade,
    current_page text not null default 'lobby',
    last_active_at timestamptz not null default now()
);

create index jva_user_activity_last_active on public.jva_user_activity (last_active_at desc);

create table public.jva_admin_audit (
    id bigint generated always as identity primary key,
    actor_id uuid references auth.users(id),
    action text not null,
    entity_type text not null,
    entity_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index jva_admin_audit_created on public.jva_admin_audit (created_at desc);

create or replace function public.jva_has_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.jva_user_roles
        where user_id = (select auth.uid())
          and role = any(required_roles)
    );
$$;

create or replace function public.jva_is_platform_access_allowed(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when target_user = (select auth.uid())
          or public.jva_has_role(array['super_admin', 'admin']::text[])
        then exists (
            select 1 from public.jva_account_security security
            where security.user_id = target_user
              and (
                  security.manually_verified_at is not null
                  or not security.verification_required
              )
              and security.access_blocked_at is null
          )
        else false
    end;
$$;

create or replace function public.jva_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_username text;
begin
    requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
    if requested_username is null
       or length(requested_username) not between 3 and 24
       or requested_username !~ '^[A-Za-z0-9_]+$'
       or new.phone is null
       or new.phone !~ '^\+[1-9][0-9]{7,14}$' then
        raise exception 'El registro requiere usuario válido y WhatsApp internacional.';
    end if;

    insert into public.jva_profiles (user_id, username, phone_e164)
    values (new.id, requested_username, new.phone);

    insert into public.jva_account_security (user_id) values (new.id);
    insert into public.jva_financial_accounts (
        account_key, account_type, normal_side, owner_user_id
    )
    values (
        'player:' || new.id::text, 'player_liability', 'credit', new.id
    );
    return new;
end;
$$;

create trigger jva_on_auth_user_created
    after insert on auth.users
    for each row execute function public.jva_handle_new_user();

alter table public.jva_platform_settings enable row level security;
alter table public.jva_profiles enable row level security;
alter table public.jva_account_security enable row level security;
alter table public.jva_user_roles enable row level security;
alter table public.jva_games enable row level security;
alter table public.jva_financial_accounts enable row level security;
alter table public.jva_journal_entries enable row level security;
alter table public.jva_journal_lines enable row level security;
alter table public.jva_game_reservations enable row level security;
alter table public.jva_game_bets enable row level security;
alter table public.jva_lottery_draws enable row level security;
alter table public.jva_lottery_tickets enable row level security;
alter table public.jva_site_modules enable row level security;
alter table public.jva_ticket_templates enable row level security;
alter table public.jva_user_activity enable row level security;
alter table public.jva_admin_audit enable row level security;

revoke all on public.jva_platform_settings from anon, authenticated;
revoke all on public.jva_profiles from anon, authenticated;
revoke all on public.jva_account_security from anon, authenticated;
revoke all on public.jva_user_roles from anon, authenticated;
revoke all on public.jva_games from anon, authenticated;
revoke all on public.jva_financial_accounts from anon, authenticated;
revoke all on public.jva_journal_entries from anon, authenticated;
revoke all on public.jva_journal_lines from anon, authenticated;
revoke all on public.jva_game_reservations from anon, authenticated;
revoke all on public.jva_game_bets from anon, authenticated;
revoke all on public.jva_lottery_draws from anon, authenticated;
revoke all on public.jva_lottery_tickets from anon, authenticated;
revoke all on public.jva_site_modules from anon, authenticated;
revoke all on public.jva_ticket_templates from anon, authenticated;
revoke all on public.jva_user_activity from anon, authenticated;
revoke all on public.jva_admin_audit from anon, authenticated;

grant select on public.jva_platform_settings to anon, authenticated;
grant select on public.jva_games to anon, authenticated;
grant select on public.jva_site_modules to anon, authenticated;
grant select on public.jva_ticket_templates to anon, authenticated;
grant select on public.jva_profiles to authenticated;
grant select on public.jva_user_roles to authenticated;
grant select on public.jva_account_security to authenticated;
grant select on public.jva_lottery_draws to authenticated;
grant select on public.jva_lottery_tickets to authenticated;
grant select on public.jva_game_bets to authenticated;
grant select on public.jva_user_activity to authenticated;
grant select on public.jva_admin_audit to authenticated;

create policy jva_settings_public_read on public.jva_platform_settings
    for select to anon, authenticated using (id = 1);
create policy jva_games_public_read on public.jva_games
    for select to anon, authenticated using (true);
create policy jva_modules_public_read on public.jva_site_modules
    for select to anon, authenticated using (true);
create policy jva_templates_public_read on public.jva_ticket_templates
    for select to anon, authenticated using (true);
create policy jva_profiles_self_staff_read on public.jva_profiles
    for select to authenticated using (
        user_id = (select auth.uid())
        or public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[])
    );
create policy jva_security_self_admin_read on public.jva_account_security
    for select to authenticated using (
        user_id = (select auth.uid())
        or public.jva_has_role(array['super_admin', 'admin']::text[])
    );
create policy jva_roles_self_admin_read on public.jva_user_roles
    for select to authenticated using (
        user_id = (select auth.uid())
        or public.jva_has_role(array['super_admin', 'admin']::text[])
    );
create policy jva_lottery_draw_public_read on public.jva_lottery_draws
    for select to authenticated using (true);
create policy jva_tickets_buyer_staff_read on public.jva_lottery_tickets
    for select to authenticated using (
        buyer_id = (select auth.uid())
        or public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[])
    );
create policy jva_bets_owner_staff_read on public.jva_game_bets
    for select to authenticated using (
        user_id = (select auth.uid())
        or public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[])
    );
create policy jva_activity_owner_admin_read on public.jva_user_activity
    for select to authenticated using (
        user_id = (select auth.uid())
        or (
            last_active_at >= now() - interval '10 minutes'
            and public.jva_has_role(array['super_admin', 'admin']::text[])
        )
    );
create policy jva_audit_admin_read on public.jva_admin_audit
    for select to authenticated using (
        public.jva_has_role(array['super_admin', 'admin']::text[])
    );

create or replace function public.jva_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_user uuid;
    security_row public.jva_account_security;
    login_limit integer;
begin
    if event is null
       or jsonb_typeof(event) is distinct from 'object'
       or coalesce(event ->> 'user_id', '') = ''
       or coalesce(event ->> 'valid', '') not in ('true', 'false') then
        raise exception 'El evento del Auth Hook no es válido.';
    end if;

    if event ->> 'valid' = 'false' then
        return jsonb_build_object('decision', 'continue');
    end if;

    target_user := (event ->> 'user_id')::uuid;
    select * into security_row
    from public.jva_account_security
    where user_id = target_user
    for update;

    if not found then
        return jsonb_build_object('decision', 'continue');
    end if;
    if security_row.access_blocked_at is not null then
        return jsonb_build_object(
            'decision', 'reject',
            'message', 'JVA_ACCOUNT_BLOCKED',
            'should_logout_user', true
        );
    end if;
    if security_row.manually_verified_at is not null then
        return jsonb_build_object('decision', 'continue');
    end if;

    select unverified_login_limit into login_limit
    from public.jva_platform_settings where id = 1;

    if security_row.successful_signins >= login_limit then
        update public.jva_account_security
        set verification_required = true, updated_at = now()
        where user_id = target_user;
        return jsonb_build_object(
            'decision', 'reject',
            'message', 'JVA_VERIFICATION_REQUIRED',
            'should_logout_user', false
        );
    end if;

    update public.jva_account_security
    set successful_signins = successful_signins + 1, updated_at = now()
    where user_id = target_user;
    return jsonb_build_object('decision', 'continue');
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select on public.jva_platform_settings to supabase_auth_admin;
grant select, update on public.jva_account_security to supabase_auth_admin;
create policy jva_auth_hook_settings_read on public.jva_platform_settings
    for select to supabase_auth_admin using (id = 1);
create policy jva_auth_hook_security_read on public.jva_account_security
    for select to supabase_auth_admin using (true);
create policy jva_auth_hook_security_update on public.jva_account_security
    for update to supabase_auth_admin using (true) with check (true);
revoke all on function public.jva_password_verification_attempt(jsonb)
    from public, anon, authenticated;
grant execute on function public.jva_password_verification_attempt(jsonb)
    to supabase_auth_admin;

create view public.jva_public_profiles
with (security_invoker = false)
as
select user_id, username
from public.jva_profiles;
grant select on public.jva_public_profiles to anon, authenticated;

do $$
declare
    table_name text;
begin
    if exists (
        select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
    ) then
        foreach table_name in array array[
            'jva_profiles',
            'jva_games',
            'jva_lottery_draws',
            'jva_lottery_tickets',
            'jva_game_bets',
            'jva_site_modules',
            'jva_user_activity'
        ]
        loop
            if not exists (
                select 1 from pg_catalog.pg_publication_tables
                where pubname = 'supabase_realtime'
                  and schemaname = 'public'
                  and tablename = table_name
            ) then
                execute format(
                    'alter publication supabase_realtime add table public.%I',
                    table_name
                );
            end if;
        end loop;
    end if;
end;
$$;
