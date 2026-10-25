create or replace function public.jva_post_journal(
    p_request_id uuid,
    p_operation text,
    p_actor_id uuid,
    p_payload jsonb,
    p_description text,
    p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_entry public.jva_journal_entries;
    entry_id uuid;
    line_item jsonb;
    account_row public.jva_financial_accounts;
    debit_total numeric := 0;
    credit_total numeric := 0;
    line_count integer;
    distinct_account_count integer;
    line_number smallint := 0;
    line_amount bigint;
    line_side text;
    line_account text;
    balance_delta bigint;
    changed_rows integer;
begin
    if p_request_id is null
       or p_operation is null
       or length(trim(p_operation)) not between 1 and 80
       or p_payload is null
       or jsonb_typeof(p_payload) <> 'object'
       or p_description is null
       or length(trim(p_description)) not between 1 and 300
       or p_lines is null
       or jsonb_typeof(p_lines) <> 'array'
       or jsonb_array_length(p_lines) < 2
       or jsonb_array_length(p_lines) > 8 then
        raise exception 'El movimiento contable no es válido.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    select * into existing_entry
    from public.jva_journal_entries
    where request_id = p_request_id;
    if found then
        if existing_entry.operation <> p_operation
           or existing_entry.actor_id is distinct from p_actor_id
           or existing_entry.request_payload <> p_payload then
            raise exception 'El identificador de solicitud ya fue utilizado.';
        end if;
        return existing_entry.id;
    end if;

    select
        count(*),
        count(distinct value ->> 'account'),
        coalesce(sum(case when value ->> 'side' = 'debit'
            then (value ->> 'amount')::numeric else 0 end), 0),
        coalesce(sum(case when value ->> 'side' = 'credit'
            then (value ->> 'amount')::numeric else 0 end), 0)
    into line_count, distinct_account_count, debit_total, credit_total
    from jsonb_array_elements(p_lines);

    if line_count <> distinct_account_count
       or debit_total <= 0
       or debit_total <> credit_total then
        raise exception 'El asiento no está balanceado.';
    end if;

    for line_item in
        select value from jsonb_array_elements(p_lines)
        order by value ->> 'account'
    loop
        line_account := line_item ->> 'account';
        line_side := line_item ->> 'side';
        if line_account is null
           or line_side is null
           or line_side not in ('debit', 'credit')
           or coalesce(line_item ->> 'amount', '') !~ '^[1-9][0-9]{0,17}$' then
            raise exception 'El asiento contiene una línea inválida.';
        end if;
        line_amount := (line_item ->> 'amount')::bigint;
        select * into account_row
        from public.jva_financial_accounts
        where account_key = line_account
        for update;
        if not found then
            raise exception 'La cuenta contable indicada no existe.';
        end if;

        balance_delta := case
            when account_row.normal_side = line_side then line_amount
            else -line_amount
        end;
        update public.jva_financial_accounts
        set balance_tokens = balance_tokens + balance_delta
        where account_key = line_account
          and balance_tokens + balance_delta >= 0;
        get diagnostics changed_rows = row_count;
        if changed_rows <> 1 then
            raise exception 'Fondos insuficientes en la cuenta %.', line_account;
        end if;
    end loop;

    insert into public.jva_journal_entries (
        request_id, operation, actor_id, request_payload, description
    )
    values (p_request_id, p_operation, p_actor_id, p_payload, trim(p_description))
    returning id into entry_id;

    for line_item in select value from jsonb_array_elements(p_lines)
    loop
        line_number := line_number + 1;
        insert into public.jva_journal_lines (
            entry_id, line_number, account_key, side, amount_tokens
        )
        values (
            entry_id,
            line_number,
            line_item ->> 'account',
            line_item ->> 'side',
            (line_item ->> 'amount')::bigint
        );
    end loop;

    return entry_id;
end;
$$;

create or replace function public.jva_available_prize_tokens(p_game_key text)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    pool_balance bigint;
    reserved_balance numeric;
begin
    select balance_tokens into pool_balance
    from public.jva_financial_accounts
    where account_key = 'game:' || p_game_key;
    if not found then
        raise exception 'No existe el fondo del juego.';
    end if;

    select coalesce(sum(amount_tokens), 0) into reserved_balance
    from public.jva_game_reservations
    where game_key = p_game_key and status in ('held', 'claimable');

    if reserved_balance > pool_balance then
        raise exception 'El fondo del juego presenta una inconsistencia contable.';
    end if;
    return pool_balance - reserved_balance::bigint;
end;
$$;

create or replace function public.jva_require_active_user(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if p_user_id is null then
        raise exception 'La cuenta requiere verificación presencial.';
    end if;
    if exists (
        select 1 from public.jva_account_security security
        where security.user_id = p_user_id
          and security.access_blocked_at is not null
    ) then
        raise exception 'La cuenta fue bloqueada por administración. Contacta al organizador.';
    end if;
    if not exists (
        select 1 from public.jva_account_security security
        where security.user_id = p_user_id
          and (
              security.manually_verified_at is not null
              or not security.verification_required
          )
    ) then
        raise exception 'La cuenta requiere verificación presencial.';
    end if;
end;
$$;

create or replace function public.jva_get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    result jsonb;
begin
    if current_user_id is null then
        raise exception 'Debes iniciar sesión.';
    end if;
    perform public.jva_require_active_user(current_user_id);

    select jsonb_build_object(
        'user_id', profile.user_id,
        'username', profile.username,
        'balance_tokens', wallet.balance_tokens,
        'manually_verified', security.manually_verified_at is not null
    )
    into result
    from public.jva_profiles profile
    join public.jva_financial_accounts wallet
      on wallet.owner_user_id = profile.user_id
     and wallet.account_type = 'player_liability'
    join public.jva_account_security security on security.user_id = profile.user_id
    where profile.user_id = current_user_id;

    if result is null then
        raise exception 'No se encontró el perfil de la cuenta.';
    end if;
    return result;
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
                'prize_shares', game.prize_shares
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
        )
    )
    from public.jva_platform_settings settings
    where settings.id = 1;
$$;

create or replace function public.jva_get_admin_users(p_search text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
begin
    if not public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[]) then
        raise exception 'No tienes permiso para consultar las cuentas.';
    end if;
    if p_search is not null and length(trim(p_search)) > 100 then
        raise exception 'El término de búsqueda es demasiado largo.';
    end if;

    select coalesce(jsonb_agg(users.value order by users.created_at desc), '[]'::jsonb)
    into result
    from (
        select jsonb_build_object(
            'user_id', profile.user_id,
            'username', profile.username,
            'phone_e164', profile.phone_e164,
            'balance_tokens', wallet.balance_tokens,
            'successful_signins', security.successful_signins,
            'verification_required', security.verification_required,
            'manually_verified_at', security.manually_verified_at,
            'access_blocked_at', security.access_blocked_at,
            'access_block_reason', security.access_block_reason,
            'is_staff', exists (
                select 1 from public.jva_user_roles role_row
                where role_row.user_id = profile.user_id
                  and role_row.role in ('super_admin', 'admin', 'cashier')
            ),
            'created_at', profile.created_at
        ) as value, profile.created_at
        from public.jva_profiles profile
        join public.jva_financial_accounts wallet
          on wallet.owner_user_id = profile.user_id
         and wallet.account_type = 'player_liability'
        join public.jva_account_security security on security.user_id = profile.user_id
        where nullif(trim(p_search), '') is null
           or profile.username ilike '%' || trim(p_search) || '%'
           or profile.phone_e164 ilike '%' || trim(p_search) || '%'
        order by profile.created_at desc
        limit 200
    ) users;

    return result;
end;
$$;

create or replace function public.jva_get_wallet_history(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    result jsonb;
begin
    if current_user_id is null then
        raise exception 'Debes iniciar sesión.';
    end if;
    if p_limit is null or p_limit not between 1 and 100 then
        raise exception 'El límite de historial no es válido.';
    end if;

    select coalesce(jsonb_agg(item.value order by item.created_at desc), '[]'::jsonb)
    into result
    from (
        select entry.created_at, jsonb_build_object(
            'id', entry.id,
            'operation', entry.operation,
            'description', entry.description,
            'created_at', entry.created_at,
            'amount_tokens', case
                when line.side = wallet.normal_side then line.amount_tokens
                else -line.amount_tokens
            end
        ) as value
        from public.jva_financial_accounts wallet
        join public.jva_journal_lines line on line.account_key = wallet.account_key
        join public.jva_journal_entries entry on entry.id = line.entry_id
        where wallet.owner_user_id = current_user_id
          and wallet.account_type = 'player_liability'
        order by entry.created_at desc
        limit p_limit
    ) item;
    return result;
end;
$$;

create or replace function public.jva_get_admin_financial_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo un administrador puede consultar la contabilidad.';
    end if;

    select jsonb_build_object(
        'physical_tokens', (
            select balance_tokens from public.jva_financial_accounts
            where account_key = 'physical_tokens'
        ),
        'house_earnings', (
            select balance_tokens from public.jva_financial_accounts
            where account_key = 'house_earnings'
        ),
        'player_wallet_liabilities', (
            select coalesce(sum(balance_tokens), 0)
            from public.jva_financial_accounts
            where account_type = 'player_liability'
        ),
        'games', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'game_key', game.game_key,
                'enabled', game.enabled,
                'house_share_percent', game.house_share_percent,
                'fund_tokens', account.balance_tokens,
                'reserved_tokens', coalesce(reservations.amount_tokens, 0),
                'available_tokens', account.balance_tokens - coalesce(reservations.amount_tokens, 0)
            ) order by game.game_key), '[]'::jsonb)
            from public.jva_games game
            join public.jva_financial_accounts account
              on account.account_key = 'game:' || game.game_key
            left join lateral (
                select sum(amount_tokens) as amount_tokens
                from public.jva_game_reservations
                where game_key = game.game_key and status in ('held', 'claimable')
            ) reservations on true
        ),
        'journal_entries', (select count(*) from public.jva_journal_entries),
        'bets', (select count(*) from public.jva_game_bets),
        'tickets', (select count(*) from public.jva_lottery_tickets)
    )
    into result;
    return result;
end;
$$;

create or replace function public.jva_ping_activity(p_current_page text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
begin
    if current_user_id is null then
        raise exception 'Debes iniciar sesión.';
    end if;
    perform public.jva_require_active_user(current_user_id);
    if p_current_page not in (
        'lobby', 'mesa', 'tragamonedas', 'loteria', 'perfil', 'administracion'
    ) then
        raise exception 'La sección indicada no es válida.';
    end if;

    insert into public.jva_user_activity (user_id, current_page, last_active_at)
    values (current_user_id, p_current_page, now())
    on conflict (user_id) do update
    set current_page = excluded.current_page,
        last_active_at = excluded.last_active_at;
end;
$$;

create or replace function public.jva_deposit_tokens(
    p_user_id uuid,
    p_amount bigint,
    p_reason text,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    wallet_key text;
    entry_id uuid;
begin
    if current_user_id is null
       or not public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[]) then
        raise exception 'Solo caja o administración puede acreditar fichas físicas.';
    end if;
    if p_user_id is null or p_amount is null or p_amount <= 0
       or p_amount > 1000000000
       or p_reason is null or length(trim(p_reason)) not between 3 and 200
       or p_request_id is null then
        raise exception 'Los datos de la acreditación no son válidos.';
    end if;
    perform public.jva_require_active_user(p_user_id);
    wallet_key := 'player:' || p_user_id::text;

    entry_id := public.jva_post_journal(
        p_request_id,
        'physical_deposit',
        current_user_id,
        jsonb_build_object(
            'user_id', p_user_id,
            'amount', p_amount,
            'reason', trim(p_reason)
        ),
        trim(p_reason),
        jsonb_build_array(
            jsonb_build_object('account', 'physical_tokens', 'side', 'debit', 'amount', p_amount),
            jsonb_build_object('account', wallet_key, 'side', 'credit', 'amount', p_amount)
        )
    );
    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        current_user_id, 'physical_deposit', 'user', p_user_id::text,
        jsonb_build_object('amount_tokens', p_amount, 'journal_entry_id', entry_id)
    );
    return jsonb_build_object('journal_entry_id', entry_id, 'user_id', p_user_id);
end;
$$;

create or replace function public.jva_redeem_tokens(
    p_user_id uuid,
    p_amount bigint,
    p_reason text,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    wallet_key text;
    entry_id uuid;
begin
    if current_user_id is null
       or not public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[]) then
        raise exception 'Solo caja o administración puede registrar un canje físico.';
    end if;
    if p_user_id is null or p_amount is null or p_amount <= 0 or p_amount > 1000000000
       or p_reason is null or length(trim(p_reason)) not between 3 and 200
       or p_request_id is null then
        raise exception 'Los datos del canje no son válidos.';
    end if;
    if p_user_id = current_user_id then
        perform public.jva_require_active_user(p_user_id);
    end if;
    wallet_key := 'player:' || p_user_id::text;

    entry_id := public.jva_post_journal(
        p_request_id,
        'physical_redemption',
        current_user_id,
        jsonb_build_object(
            'user_id', p_user_id,
            'amount', p_amount,
            'reason', trim(p_reason)
        ),
        trim(p_reason),
        jsonb_build_array(
            jsonb_build_object('account', wallet_key, 'side', 'debit', 'amount', p_amount),
            jsonb_build_object('account', 'physical_tokens', 'side', 'credit', 'amount', p_amount)
        )
    );
    if current_user_id <> p_user_id then
        insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
        values (
            current_user_id, 'physical_redemption', 'user', p_user_id::text,
            jsonb_build_object('amount_tokens', p_amount, 'journal_entry_id', entry_id)
        );
    end if;
    return jsonb_build_object('journal_entry_id', entry_id, 'user_id', p_user_id);
end;
$$;

create or replace function public.jva_withdraw_house_earnings(
    p_amount bigint,
    p_reason text,
    p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    entry_id uuid;
begin
    if current_user_id is null
       or not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Solo el administrador maestro puede retirar ganancias de la casa.';
    end if;
    if p_amount is null or p_amount <= 0 or p_reason is null
       or length(trim(p_reason)) not between 3 and 200 or p_request_id is null then
        raise exception 'Los datos del retiro no son válidos.';
    end if;

    entry_id := public.jva_post_journal(
        p_request_id,
        'house_earnings_withdrawal',
        current_user_id,
        jsonb_build_object('amount', p_amount, 'reason', trim(p_reason)),
        trim(p_reason),
        jsonb_build_array(
            jsonb_build_object('account', 'house_earnings', 'side', 'debit', 'amount', p_amount),
            jsonb_build_object('account', 'physical_tokens', 'side', 'credit', 'amount', p_amount)
        )
    );
    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        current_user_id, 'house_earnings_withdrawal', 'account', 'house_earnings',
        jsonb_build_object('amount_tokens', p_amount, 'journal_entry_id', entry_id)
    );
    return entry_id;
end;
$$;

create or replace function public.jva_activate_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede activar cuentas.';
    end if;
    if p_user_id is null then
        raise exception 'La cuenta indicada no es válida.';
    end if;

    update public.jva_account_security
    set manually_verified_at = coalesce(manually_verified_at, now()),
        verification_required = false,
        updated_at = now()
    where user_id = p_user_id;
    if not found then
        raise exception 'No existe la cuenta indicada.';
    end if;

    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id)
    values ((select auth.uid()), 'account_activated', 'user', p_user_id::text);
end;
$$;

create or replace function public.jva_set_account_blocked(
    p_user_id uuid,
    p_blocked boolean,
    p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede bloquear o desbloquear cuentas.';
    end if;
    if p_user_id is null or p_blocked is null
       or p_reason is null or length(trim(p_reason)) not between 3 and 200 then
        raise exception 'Los datos del bloqueo no son válidos.';
    end if;
    if p_user_id = (select auth.uid()) then
        raise exception 'No puedes bloquear tu propia cuenta.';
    end if;
    if exists (
        select 1 from public.jva_user_roles
        where user_id = p_user_id and role in ('super_admin', 'admin', 'cashier')
    ) then
        raise exception 'No se puede bloquear una cuenta del equipo administrativo.';
    end if;

    perform 1 from public.jva_account_security
    where user_id = p_user_id
    for update;
    if not found then
        raise exception 'No existe la cuenta indicada.';
    end if;

    update public.jva_account_security
    set access_blocked_at = case when p_blocked then coalesce(access_blocked_at, now()) else null end,
        access_blocked_by = case when p_blocked then (select auth.uid()) else null end,
        access_block_reason = case when p_blocked then trim(p_reason) else null end,
        updated_at = now()
    where user_id = p_user_id;

    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        (select auth.uid()),
        case when p_blocked then 'account_blocked' else 'account_unblocked' end,
        'user',
        p_user_id::text,
        jsonb_build_object('reason', trim(p_reason))
    );
end;
$$;

create or replace function public.jva_update_platform_settings(
    p_unverified_login_limit integer,
    p_organizer_whatsapp text,
    p_lottery_ticket_price bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Se requiere el rol de administrador maestro.';
    end if;
    if p_unverified_login_limit is null
       or p_unverified_login_limit not between 1 and 100
       or p_organizer_whatsapp is null
       or p_organizer_whatsapp !~ '^[1-9][0-9]{7,14}$'
       or p_lottery_ticket_price is null
       or p_lottery_ticket_price <= 0 then
        raise exception 'La configuración contiene valores inválidos.';
    end if;

    update public.jva_platform_settings
    set unverified_login_limit = p_unverified_login_limit,
        organizer_whatsapp = p_organizer_whatsapp,
        lottery_ticket_price = p_lottery_ticket_price,
        updated_at = now()
    where id = 1;
    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        (select auth.uid()), 'platform_settings_updated', 'platform', 'settings',
        jsonb_build_object(
            'unverified_login_limit', p_unverified_login_limit,
            'organizer_whatsapp', p_organizer_whatsapp,
            'lottery_ticket_price', p_lottery_ticket_price
        )
    );
end;
$$;

create or replace function public.jva_update_game_config(
    p_game_key text,
    p_enabled boolean,
    p_house_share_percent numeric,
    p_payout_includes_stake boolean,
    p_max_jackpot_multiplier numeric,
    p_max_pair_multiplier numeric,
    p_jackpot_probability_bps integer,
    p_pair_probability_bps integer,
    p_prize_shares jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_config public.jva_games;
    share_total numeric;
begin
    if not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Se requiere el rol de administrador maestro.';
    end if;
    if p_game_key is null
       or p_game_key not in ('slots', 'lottery', 'tables')
       or p_enabled is null
       or p_house_share_percent is null
       or p_house_share_percent <= 0 or p_house_share_percent >= 100
       or p_payout_includes_stake is null
       or p_max_jackpot_multiplier is null
       or p_max_jackpot_multiplier < 1 or p_max_jackpot_multiplier > 1000
       or p_max_pair_multiplier is null
       or p_max_pair_multiplier < 0 or p_max_pair_multiplier > 1000
       or p_jackpot_probability_bps is null
       or p_jackpot_probability_bps not between 0 and 10000
       or p_pair_probability_bps is null
       or p_pair_probability_bps not between 0 and 10000
       or p_jackpot_probability_bps + p_pair_probability_bps > 10000 then
        raise exception 'La configuración del juego no es válida.';
    end if;
    if p_game_key = 'tables' and p_enabled then
        raise exception 'Las mesas siguen en migración y no se pueden habilitar.';
    end if;

    if p_game_key = 'lottery' then
        if p_prize_shares is null
           or jsonb_typeof(p_prize_shares) is distinct from 'object'
           or jsonb_typeof(p_prize_shares -> '15') is distinct from 'number'
           or jsonb_typeof(p_prize_shares -> '14') is distinct from 'number'
           or jsonb_typeof(p_prize_shares -> '13') is distinct from 'number'
           or jsonb_typeof(p_prize_shares -> '12') is distinct from 'number'
           or jsonb_typeof(p_prize_shares -> '11') is distinct from 'number' then
            raise exception 'El reparto de premios de lotería no es válido.';
        end if;
        share_total :=
            (p_prize_shares ->> '15')::numeric +
            (p_prize_shares ->> '14')::numeric +
            (p_prize_shares ->> '13')::numeric +
            (p_prize_shares ->> '12')::numeric +
            (p_prize_shares ->> '11')::numeric;
        if share_total <> 100
           or (p_prize_shares ->> '15')::numeric not between 0 and 100
           or (p_prize_shares ->> '14')::numeric not between 0 and 100
           or (p_prize_shares ->> '13')::numeric not between 0 and 100
           or (p_prize_shares ->> '12')::numeric not between 0 and 100
           or (p_prize_shares ->> '11')::numeric not between 0 and 100 then
            raise exception 'Las categorías de premios deben sumar 100%%.';
        end if;
    end if;

    select * into current_config from public.jva_games where game_key = p_game_key for update;
    if not found then
        raise exception 'No existe el juego indicado.';
    end if;

    update public.jva_games
    set enabled = p_enabled,
        house_share_percent = p_house_share_percent,
        payout_includes_stake = p_payout_includes_stake,
        max_jackpot_multiplier = p_max_jackpot_multiplier,
        max_pair_multiplier = p_max_pair_multiplier,
        jackpot_probability_bps = p_jackpot_probability_bps,
        pair_probability_bps = p_pair_probability_bps,
        prize_shares = case when p_game_key = 'lottery' then p_prize_shares else prize_shares end,
        updated_by = (select auth.uid()),
        updated_at = now()
    where game_key = p_game_key;

    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        (select auth.uid()), 'game_config_updated', 'game', p_game_key,
        jsonb_build_object(
            'enabled', p_enabled,
            'house_share_percent', p_house_share_percent,
            'payout_includes_stake', p_payout_includes_stake,
            'max_jackpot_multiplier', p_max_jackpot_multiplier,
            'max_pair_multiplier', p_max_pair_multiplier,
            'jackpot_probability_bps', p_jackpot_probability_bps,
            'pair_probability_bps', p_pair_probability_bps,
            'prize_shares', p_prize_shares
        )
    );
end;
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
    if p_modules is null or jsonb_typeof(p_modules) <> 'array' then
        raise exception 'La lista de módulos no es válida.';
    end if;
    if jsonb_array_length(p_modules) > 20 then
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
           or requested_module_key not in ('home', 'lottery', 'slots', 'tables', 'chat', 'winners')
           or desired_order < 0 then
            raise exception 'El módulo contiene una opción no permitida.';
        end if;
        if requested_module_key = 'home' and not visible_value then
            raise exception 'La sección Inicio debe permanecer visible.';
        end if;
        if visible_value and requested_module_key in ('lottery', 'slots', 'tables') then
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
        where jva_site_modules.module_key = requested_module_key;
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

create or replace function public.jva_update_ticket_template(
    p_template_kind text,
    p_definition jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    template_width integer;
    template_height integer;
begin
    if not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Se requiere el rol de administrador maestro.';
    end if;
    if p_template_kind is null
       or p_template_kind not in ('web', 'thermal')
       or p_definition is null
       or jsonb_typeof(p_definition) <> 'object'
       or octet_length(p_definition::text) > 32768
       or coalesce(p_definition ->> 'width', '') !~ '^[0-9]{1,4}$'
       or coalesce(p_definition ->> 'height', '') !~ '^[0-9]{1,4}$' then
        raise exception 'La plantilla gráfica no es válida.';
    end if;
    template_width := (p_definition ->> 'width')::integer;
    template_height := (p_definition ->> 'height')::integer;
    if template_width not between 1 and 2048
       or template_height not between 1 and 4096
       or jsonb_typeof(p_definition -> 'elements') is distinct from 'array' then
        raise exception 'La plantilla gráfica no es válida.';
    end if;
    if jsonb_array_length(p_definition -> 'elements') > 100 then
        raise exception 'La plantilla gráfica no es válida.';
    end if;

    insert into public.jva_ticket_templates (
        template_kind, definition, updated_by, updated_at
    )
    values (p_template_kind, p_definition, (select auth.uid()), now())
    on conflict (template_kind) do update
    set definition = excluded.definition,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.jva_preview_slot_bet(p_stake_tokens bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    game public.jva_games;
    player_balance bigint;
    contribution bigint;
    available_after_bet bigint;
    maximum_payout bigint;
begin
    if current_user_id is null then
        raise exception 'Debes iniciar sesión para jugar.';
    end if;
    perform public.jva_require_active_user(current_user_id);
    if p_stake_tokens is null or p_stake_tokens <= 0 or p_stake_tokens > 1000000 then
        raise exception 'La apuesta no es válida.';
    end if;

    select * into game from public.jva_games where game_key = 'slots';
    if not game.enabled then
        raise exception 'La tragamonedas está pausada.';
    end if;
    select balance_tokens into player_balance
    from public.jva_financial_accounts
    where owner_user_id = current_user_id and account_type = 'player_liability';
    if player_balance < p_stake_tokens then
        raise exception 'No tienes suficientes fichas.';
    end if;

    contribution := p_stake_tokens - floor(
        p_stake_tokens * game.house_share_percent / 100
    )::bigint;
    if p_stake_tokens - contribution <= 0 then
        raise exception 'La apuesta es demasiado baja para aplicar la comisión de la casa.';
    end if;
    available_after_bet := public.jva_available_prize_tokens('slots') + contribution;
    maximum_payout := least(
        floor(p_stake_tokens * (
            game.max_jackpot_multiplier
            + case when game.payout_includes_stake then 0 else 1 end
        ))::bigint,
        available_after_bet
    );
    if maximum_payout <= 0 then
        raise exception 'El fondo de premios no puede respaldar esta jugada.';
    end if;

    return jsonb_build_object(
        'game_key', 'slots',
        'stake_tokens', p_stake_tokens,
        'house_share_tokens', p_stake_tokens - contribution,
        'prize_contribution_tokens', contribution,
        'maximum_total_payout_tokens', maximum_payout,
        'jackpot_payout_tokens', maximum_payout,
        'pair_payout_tokens', least(
            floor(p_stake_tokens * (
                game.max_pair_multiplier
                + case when game.payout_includes_stake then 0 else 1 end
            ))::bigint,
            maximum_payout
        ),
        'payout_includes_stake', game.payout_includes_stake,
        'reservation_required', maximum_payout
    );
end;
$$;

create or replace function public.jva_play_slots(
    p_stake_tokens bigint,
    p_request_id uuid,
    p_expected_maximum_payout bigint
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
    contribution bigint;
    house_amount bigint;
    maximum_payout bigint;
    available_after_bet bigint;
    odds_roll bigint;
    outcome_value text;
    payout_value bigint := 0;
    random_value bigint;
    bet_id uuid := extensions.gen_random_uuid();
    reservation_id uuid := extensions.gen_random_uuid();
    entry_id uuid;
    payout_request_id uuid;
    random_bytes bytea;
begin
    if current_user_id is null or p_request_id is null
       or p_stake_tokens is null or p_expected_maximum_payout is null then
        raise exception 'Debes iniciar sesión para jugar.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );

    select * into existing_bet from public.jva_game_bets
    where request_id = p_request_id;
    if found then
        if existing_bet.user_id <> current_user_id
           or existing_bet.stake_tokens <> p_stake_tokens
           or existing_bet.maximum_payout_tokens <> p_expected_maximum_payout then
            raise exception 'La solicitud ya se usó con otros datos.';
        end if;
        return jsonb_build_object(
            'bet_id', existing_bet.id,
            'outcome', existing_bet.outcome,
            'payout_tokens', existing_bet.payout_tokens,
            'maximum_total_payout_tokens', existing_bet.maximum_payout_tokens,
            'payout_snapshot', existing_bet.payout_snapshot
        );
    end if;

    perform public.jva_require_active_user(current_user_id);
    if p_stake_tokens is null or p_stake_tokens <= 0 or p_stake_tokens > 1000000
       or p_expected_maximum_payout is null or p_expected_maximum_payout <= 0 then
        raise exception 'Los datos de la jugada no son válidos.';
    end if;

    select * into game from public.jva_games where game_key = 'slots' for update;
    if not game.enabled then
        raise exception 'La tragamonedas está pausada.';
    end if;
    wallet_key := 'player:' || current_user_id::text;
    perform 1 from public.jva_financial_accounts
    where account_key in ('game:slots', wallet_key)
    order by account_key
    for update;
    select balance_tokens into player_balance
    from public.jva_financial_accounts where account_key = wallet_key;
    if player_balance < p_stake_tokens then
        raise exception 'No tienes suficientes fichas.';
    end if;

    house_amount := floor(
        p_stake_tokens * game.house_share_percent / 100
    )::bigint;
    if house_amount <= 0 then
        raise exception 'La apuesta es demasiado baja para aplicar la comisión de la casa.';
    end if;
    contribution := p_stake_tokens - house_amount;
    available_after_bet := public.jva_available_prize_tokens('slots') + contribution;
    maximum_payout := least(
        floor(p_stake_tokens * (
            game.max_jackpot_multiplier
            + case when game.payout_includes_stake then 0 else 1 end
        ))::bigint,
        available_after_bet
    );
    if maximum_payout <> p_expected_maximum_payout then
        raise exception 'Cambió el máximo disponible. Actualiza el premio antes de confirmar.';
    end if;

    entry_id := public.jva_post_journal(
        p_request_id,
        'slot_bet',
        current_user_id,
        jsonb_build_object(
            'game_key', 'slots',
            'user_id', current_user_id,
            'stake_tokens', p_stake_tokens,
            'maximum_payout_tokens', maximum_payout
        ),
        'Apuesta en tragamonedas',
        jsonb_build_array(
            jsonb_build_object('account', wallet_key, 'side', 'debit', 'amount', p_stake_tokens)
        )
        || case when house_amount > 0 then jsonb_build_array(
            jsonb_build_object('account', 'house_earnings', 'side', 'credit', 'amount', house_amount)
        ) else '[]'::jsonb end
        || jsonb_build_array(
            jsonb_build_object('account', 'game:slots', 'side', 'credit', 'amount', contribution)
        )
    );

    insert into public.jva_game_bets (
        id, request_id, game_key, user_id, stake_tokens,
        maximum_payout_tokens, outcome, payout_snapshot
    )
    values (
        bet_id, p_request_id, 'slots', current_user_id, p_stake_tokens,
        maximum_payout, 'loss',
        jsonb_build_object(
            'house_share_percent', game.house_share_percent,
            'jackpot_probability_bps', game.jackpot_probability_bps,
            'pair_probability_bps', game.pair_probability_bps,
            'jackpot_multiplier', game.max_jackpot_multiplier,
            'pair_multiplier', game.max_pair_multiplier,
            'payout_includes_stake', game.payout_includes_stake
        )
    );
    insert into public.jva_game_reservations (
        id, game_key, source_type, source_id, owner_user_id, amount_tokens, status
    )
    values (
        reservation_id, 'slots', 'slot_bet', bet_id, current_user_id,
        maximum_payout, 'held'
    );

    loop
        random_bytes := extensions.gen_random_bytes(4);
        random_value :=
            get_byte(random_bytes, 0)::bigint * 16777216 +
            get_byte(random_bytes, 1)::bigint * 65536 +
            get_byte(random_bytes, 2)::bigint * 256 +
            get_byte(random_bytes, 3)::bigint;
        exit when random_value < 4294960000;
    end loop;
    odds_roll := mod(random_value, 10000);
    if odds_roll < game.jackpot_probability_bps then
        outcome_value := 'jackpot';
        payout_value := least(
            floor(p_stake_tokens * (
                game.max_jackpot_multiplier
                + case when game.payout_includes_stake then 0 else 1 end
            ))::bigint,
            maximum_payout
        );
    elsif odds_roll < game.jackpot_probability_bps + game.pair_probability_bps then
        outcome_value := 'pair';
        payout_value := least(
            floor(p_stake_tokens * (
                game.max_pair_multiplier
                + case when game.payout_includes_stake then 0 else 1 end
            ))::bigint,
            maximum_payout
        );
    else
        outcome_value := 'loss';
    end if;

    update public.jva_game_bets
    set outcome = outcome_value, payout_tokens = payout_value,
        payout_snapshot = payout_snapshot || jsonb_build_object(
            'maximum_total_payout_tokens', maximum_payout,
            'actual_payout_tokens', payout_value,
            'odds_roll_basis_points', odds_roll
        )
    where id = bet_id;

    if payout_value > 0 then
        payout_request_id := (md5(p_request_id::text || ':payout'))::uuid;
        perform public.jva_post_journal(
            payout_request_id,
            'slot_payout',
            current_user_id,
            jsonb_build_object('bet_id', bet_id, 'payout_tokens', payout_value),
            'Premio de tragamonedas',
            jsonb_build_array(
                jsonb_build_object('account', 'game:slots', 'side', 'debit', 'amount', payout_value),
                jsonb_build_object('account', wallet_key, 'side', 'credit', 'amount', payout_value)
            )
        );
        update public.jva_game_reservations
        set amount_tokens = 0, status = 'paid', updated_at = now()
        where id = reservation_id;
    else
        update public.jva_game_reservations
        set amount_tokens = 0, status = 'released', updated_at = now()
        where id = reservation_id;
    end if;

    return jsonb_build_object(
        'bet_id', bet_id,
        'outcome', outcome_value,
        'payout_tokens', payout_value,
        'maximum_total_payout_tokens', maximum_payout,
        'payout_snapshot', (
            select payout_snapshot from public.jva_game_bets where id = bet_id
        )
    );
end;
$$;

create or replace function public.jva_preview_lottery_ticket()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    game public.jva_games;
    settings public.jva_platform_settings;
    pool_available bigint;
    prize_contribution bigint;
    next_available bigint;
    preview jsonb;
    open_draw public.jva_lottery_draws;
begin
    select * into game from public.jva_games where game_key = 'lottery';
    if not game.enabled then
        raise exception 'La lotería está pausada.';
    end if;
    select * into settings from public.jva_platform_settings where id = 1;
    select * into open_draw from public.jva_lottery_draws
    where game_key = 'lottery' and status = 'open';
    if not found then
        raise exception 'No hay un sorteo abierto.';
    end if;

    pool_available := public.jva_available_prize_tokens('lottery');
    prize_contribution := settings.lottery_ticket_price - floor(
        settings.lottery_ticket_price * game.house_share_percent / 100
    )::bigint;
    if settings.lottery_ticket_price - prize_contribution <= 0 then
        raise exception 'El precio del cartón es demasiado bajo para aplicar la comisión de la casa.';
    end if;
    next_available := pool_available + prize_contribution;
    preview := jsonb_build_object(
        '15', floor(next_available * (game.prize_shares ->> '15')::numeric / 100)::bigint,
        '14', floor(next_available * (game.prize_shares ->> '14')::numeric / 100)::bigint,
        '13', floor(next_available * (game.prize_shares ->> '13')::numeric / 100)::bigint,
        '12', floor(next_available * (game.prize_shares ->> '12')::numeric / 100)::bigint,
        '11', next_available
            - floor(next_available * (game.prize_shares ->> '15')::numeric / 100)::bigint
            - floor(next_available * (game.prize_shares ->> '14')::numeric / 100)::bigint
            - floor(next_available * (game.prize_shares ->> '13')::numeric / 100)::bigint
            - floor(next_available * (game.prize_shares ->> '12')::numeric / 100)::bigint
    );
    return jsonb_build_object(
        'draw_id', open_draw.id,
        'draw_number', open_draw.draw_number,
        'price_tokens', settings.lottery_ticket_price,
        'house_share_tokens', settings.lottery_ticket_price - prize_contribution,
        'prize_contribution_tokens', prize_contribution,
        'prize_preview_tokens', preview,
        'maximum_reservation_tokens', greatest(
            (preview ->> '15')::bigint,
            (preview ->> '14')::bigint,
            (preview ->> '13')::bigint,
            (preview ->> '12')::bigint,
            (preview ->> '11')::bigint
        )
    );
end;
$$;

create or replace function public.jva_open_lottery_draw()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    new_draw public.jva_lottery_draws;
begin
    if current_user_id is null
       or not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede abrir un sorteo.';
    end if;
    if not exists (
        select 1 from public.jva_games where game_key = 'lottery' and enabled
    ) then
        raise exception 'Configura y habilita la lotería antes de abrir sorteos.';
    end if;

    insert into public.jva_lottery_draws (game_key, opened_by)
    values ('lottery', current_user_id)
    returning * into new_draw;
    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
    values (
        current_user_id, 'lottery_draw_opened', 'lottery_draw', new_draw.id::text,
        jsonb_build_object('draw_number', new_draw.draw_number)
    );
    return jsonb_build_object('id', new_draw.id, 'draw_number', new_draw.draw_number);
end;
$$;

create or replace function public.jva_issue_lottery_ticket(
    p_buyer_id uuid,
    p_request_id uuid,
    p_payment_method text,
    p_expected_draw_id uuid,
    p_expected_prize_preview jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    settings public.jva_platform_settings;
    game public.jva_games;
    draw_row public.jva_lottery_draws;
    existing_ticket public.jva_lottery_tickets;
    ticket_id uuid := extensions.gen_random_uuid();
    reservation_id uuid := extensions.gen_random_uuid();
    wallet_key text;
    player_balance bigint;
    house_amount bigint;
    contribution bigint;
    available_after_bet bigint;
    prize_preview jsonb;
    maximum_reservation bigint;
    ticket_numbers integer[];
    journal_entry_id uuid;
    index_value integer;
begin
    if current_user_id is null or p_request_id is null then
        raise exception 'Debes iniciar sesión para comprar un cartón.';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    if p_payment_method is null or p_payment_method not in ('digital', 'physical')
       or p_buyer_id is null or p_expected_draw_id is null then
        raise exception 'Los datos de venta no son válidos.';
    end if;
    if p_payment_method = 'physical' then
        if not public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[]) then
            raise exception 'Solo caja puede registrar un pago físico.';
        end if;
    elsif p_buyer_id <> current_user_id then
        raise exception 'Solo puedes comprar para tu propia cuenta.';
    end if;
    perform public.jva_require_active_user(p_buyer_id);

    select * into existing_ticket
    from public.jva_lottery_tickets where request_id = p_request_id;
    if found then
        if existing_ticket.buyer_id <> p_buyer_id
           or existing_ticket.sold_by <> current_user_id
           or existing_ticket.payment_method <> p_payment_method
           or existing_ticket.draw_id <> p_expected_draw_id then
            raise exception 'La solicitud de venta ya fue utilizada.';
        end if;
        return jsonb_build_object(
            'id', existing_ticket.id,
            'ticket_number', existing_ticket.ticket_number,
            'draw_number', (
                select existing_draw.draw_number
                from public.jva_lottery_draws existing_draw
                where existing_draw.id = existing_ticket.draw_id
            ),
            'buyer_id', existing_ticket.buyer_id,
            'payment_method', existing_ticket.payment_method,
            'price_tokens', existing_ticket.price_tokens,
            'numbers', existing_ticket.numbers,
            'prize_preview_tokens', existing_ticket.prize_preview_tokens,
            'prize_tokens', existing_ticket.prize_tokens
        );
    end if;

    select * into game from public.jva_games where game_key = 'lottery' for update;
    if not game.enabled then
        raise exception 'La lotería está pausada.';
    end if;
    select * into settings from public.jva_platform_settings where id = 1;
    select * into draw_row from public.jva_lottery_draws
    where game_key = 'lottery' and status = 'open'
    for update;
    if not found then
        raise exception 'No hay un sorteo abierto.';
    end if;
    if draw_row.id <> p_expected_draw_id then
        raise exception 'El sorteo cambió. Actualiza el cartón antes de confirmar.';
    end if;

    wallet_key := 'player:' || p_buyer_id::text;
    if p_payment_method = 'digital' then
        perform 1 from public.jva_financial_accounts
        where account_key in ('game:lottery', wallet_key)
        order by account_key
        for update;
        select balance_tokens into player_balance
        from public.jva_financial_accounts where account_key = wallet_key;
        if player_balance < settings.lottery_ticket_price then
            raise exception 'No tienes suficientes fichas.';
        end if;
    else
        perform 1 from public.jva_financial_accounts
        where account_key in ('game:lottery', 'physical_tokens')
        order by account_key
        for update;
    end if;

    house_amount := floor(
        settings.lottery_ticket_price * game.house_share_percent / 100
    )::bigint;
    if house_amount <= 0 then
        raise exception 'El precio del cartón es demasiado bajo para aplicar la comisión de la casa.';
    end if;
    contribution := settings.lottery_ticket_price - house_amount;
    available_after_bet := public.jva_available_prize_tokens('lottery') + contribution;
    prize_preview := jsonb_build_object(
        '15', floor(available_after_bet * (game.prize_shares ->> '15')::numeric / 100)::bigint,
        '14', floor(available_after_bet * (game.prize_shares ->> '14')::numeric / 100)::bigint,
        '13', floor(available_after_bet * (game.prize_shares ->> '13')::numeric / 100)::bigint,
        '12', floor(available_after_bet * (game.prize_shares ->> '12')::numeric / 100)::bigint,
        '11', available_after_bet
            - floor(available_after_bet * (game.prize_shares ->> '15')::numeric / 100)::bigint
            - floor(available_after_bet * (game.prize_shares ->> '14')::numeric / 100)::bigint
            - floor(available_after_bet * (game.prize_shares ->> '13')::numeric / 100)::bigint
            - floor(available_after_bet * (game.prize_shares ->> '12')::numeric / 100)::bigint
    );
    maximum_reservation := greatest(
        (prize_preview ->> '15')::bigint,
        (prize_preview ->> '14')::bigint,
        (prize_preview ->> '13')::bigint,
        (prize_preview ->> '12')::bigint,
        (prize_preview ->> '11')::bigint
    );
    if p_expected_prize_preview is null
       or p_expected_prize_preview <> prize_preview then
        raise exception 'Cambió el pozo. Actualiza la escala de premios antes de confirmar.';
    end if;
    if maximum_reservation <= 0 or maximum_reservation > available_after_bet then
        raise exception 'El fondo de premios no puede respaldar el cartón.';
    end if;

    if p_payment_method = 'digital' then
        journal_entry_id := public.jva_post_journal(
            p_request_id,
            'lottery_ticket_sale',
            current_user_id,
            jsonb_build_object(
                'buyer_id', p_buyer_id,
                'payment_method', p_payment_method,
                'price_tokens', settings.lottery_ticket_price,
                'draw_id', draw_row.id
            ),
            'Compra de cartón de lotería',
            jsonb_build_array(
                jsonb_build_object('account', wallet_key, 'side', 'debit', 'amount', settings.lottery_ticket_price)
            )
            || case when house_amount > 0 then jsonb_build_array(
                jsonb_build_object('account', 'house_earnings', 'side', 'credit', 'amount', house_amount)
            ) else '[]'::jsonb end
            || jsonb_build_array(
                jsonb_build_object('account', 'game:lottery', 'side', 'credit', 'amount', contribution)
            )
        );
    else
        journal_entry_id := public.jva_post_journal(
            p_request_id,
            'lottery_ticket_sale_physical',
            current_user_id,
            jsonb_build_object(
                'buyer_id', p_buyer_id,
                'payment_method', p_payment_method,
                'price_tokens', settings.lottery_ticket_price,
                'draw_id', draw_row.id
            ),
            'Venta física de cartón de lotería',
            jsonb_build_array(
                jsonb_build_object('account', 'physical_tokens', 'side', 'debit', 'amount', settings.lottery_ticket_price)
            )
            || case when house_amount > 0 then jsonb_build_array(
                jsonb_build_object('account', 'house_earnings', 'side', 'credit', 'amount', house_amount)
            ) else '[]'::jsonb end
            || jsonb_build_array(
                jsonb_build_object('account', 'game:lottery', 'side', 'credit', 'amount', contribution)
            )
        );
    end if;

    select array_agg(candidate.number order by candidate.random_order)
    into ticket_numbers
    from (
        select number, encode(extensions.gen_random_bytes(16), 'hex') as random_order
        from generate_series(1, 25) as candidate_numbers(number)
        order by random_order, number
        limit 15
    ) candidate;

    insert into public.jva_game_reservations (
        id, game_key, source_type, source_id, owner_user_id, amount_tokens, status
    )
    values (
        reservation_id, 'lottery', 'lottery_ticket', ticket_id, p_buyer_id,
        maximum_reservation, 'held'
    );
    insert into public.jva_lottery_tickets (
        id, draw_id, buyer_id, sold_by, payment_method, price_tokens, numbers,
        prize_preview_tokens, reservation_id, request_id
    )
    values (
        ticket_id, draw_row.id, p_buyer_id, current_user_id, p_payment_method,
        settings.lottery_ticket_price, ticket_numbers, prize_preview,
        reservation_id, p_request_id
    );

    if p_payment_method = 'physical' then
        insert into public.jva_admin_audit (
            actor_id, action, entity_type, entity_id, details
        )
        values (
            current_user_id, 'lottery_ticket_sold_physical',
            'lottery_ticket', ticket_id::text,
            jsonb_build_object(
                'buyer_id', p_buyer_id,
                'price_tokens', settings.lottery_ticket_price,
                'journal_entry_id', journal_entry_id
            )
        );
    end if;

    return jsonb_build_object(
        'id', ticket_id,
        'ticket_number', (select ticket_number from public.jva_lottery_tickets where id = ticket_id),
        'draw_number', draw_row.draw_number,
        'buyer_id', p_buyer_id,
        'payment_method', p_payment_method,
        'price_tokens', settings.lottery_ticket_price,
        'numbers', ticket_numbers,
        'prize_preview_tokens', prize_preview,
        'maximum_reservation_tokens', maximum_reservation
    );
end;
$$;

create or replace function public.jva_settle_lottery_draw(p_draw_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    draw_row public.jva_lottery_draws;
    ticket_row public.jva_lottery_tickets;
    drawn_numbers_value integer[];
    matched_count integer;
    category_key text;
    award_tokens bigint;
    random_order text;
    ticket_count integer := 0;
    winners_count integer := 0;
begin
    if current_user_id is null
       or not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede realizar el sorteo.';
    end if;
    if p_draw_id is null then
        raise exception 'El sorteo indicado no es válido.';
    end if;

    select * into draw_row
    from public.jva_lottery_draws where id = p_draw_id for update;
    if not found then
        raise exception 'No existe el sorteo indicado.';
    end if;
    if draw_row.status = 'settled' then
        return jsonb_build_object(
            'draw_id', draw_row.id,
            'draw_number', draw_row.draw_number,
            'drawn_numbers', draw_row.drawn_numbers,
            'already_settled', true
        );
    end if;
    perform 1 from public.jva_financial_accounts
    where account_key = 'game:lottery'
    for update;

    select array_agg(candidate.number order by candidate.random_order)
    into drawn_numbers_value
    from (
        select number, encode(extensions.gen_random_bytes(16), 'hex') as random_order
        from generate_series(1, 25) as candidate_numbers(number)
        order by random_order, number
        limit 15
    ) candidate;

    for ticket_row in
        select * from public.jva_lottery_tickets
        where draw_id = p_draw_id
        order by id
        for update
    loop
        ticket_count := ticket_count + 1;
        select count(*)::integer into matched_count
        from unnest(ticket_row.numbers) as chosen(number)
        where chosen.number = any(drawn_numbers_value);

        category_key := case matched_count
            when 15 then '15'
            when 14 then '14'
            when 13 then '13'
            when 12 then '12'
            when 11 then '11'
            else null
        end;
        award_tokens := case
            when category_key is null then 0
            else coalesce((ticket_row.prize_preview_tokens ->> category_key)::bigint, 0)
        end;

        update public.jva_lottery_tickets
        set prize_tokens = award_tokens
        where id = ticket_row.id;
        update public.jva_game_reservations
        set amount_tokens = award_tokens,
            status = case when award_tokens > 0 then 'claimable' else 'released' end,
            updated_at = now()
        where id = ticket_row.reservation_id and status = 'held';

        if award_tokens > 0 then
            winners_count := winners_count + 1;
        end if;
    end loop;

    update public.jva_lottery_draws
    set status = 'settled',
        drawn_numbers = drawn_numbers_value,
        settled_by = current_user_id,
        settled_at = now()
    where id = p_draw_id;
    insert into public.jva_admin_audit (
        actor_id, action, entity_type, entity_id, details
    )
    values (
        current_user_id, 'lottery_draw_settled', 'lottery_draw', p_draw_id::text,
        jsonb_build_object(
            'drawn_numbers', drawn_numbers_value,
            'tickets', ticket_count,
            'winning_tickets', winners_count
        )
    );

    return jsonb_build_object(
        'draw_id', p_draw_id,
        'draw_number', draw_row.draw_number,
        'drawn_numbers', drawn_numbers_value,
        'tickets', ticket_count,
        'winning_tickets', winners_count
    );
end;
$$;

create or replace function public.jva_claim_lottery_prize(
    p_ticket_id uuid,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    ticket_row public.jva_lottery_tickets;
    wallet_key text;
    entry_id uuid;
begin
    if current_user_id is null or p_request_id is null then
        raise exception 'Debes iniciar sesión para cobrar el premio.';
    end if;
    select * into ticket_row
    from public.jva_lottery_tickets where id = p_ticket_id for update;
    if not found then
        raise exception 'No existe el cartón indicado.';
    end if;
    if ticket_row.buyer_id <> current_user_id
       and not public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[]) then
        raise exception 'No tienes permiso para cobrar ese premio.';
    end if;
    if ticket_row.prize_claimed_at is not null then
        return jsonb_build_object(
            'ticket_id', ticket_row.id,
            'prize_tokens', ticket_row.prize_tokens,
            'already_claimed', true
        );
    end if;
    if ticket_row.prize_tokens <= 0 then
        raise exception 'Este cartón no tiene un premio pendiente.';
    end if;
    perform public.jva_require_active_user(ticket_row.buyer_id);
    perform 1 from public.jva_game_reservations
    where id = ticket_row.reservation_id and status = 'claimable'
    for update;
    if not found then
        raise exception 'El premio no está disponible o ya fue cobrado.';
    end if;

    wallet_key := 'player:' || ticket_row.buyer_id::text;
    entry_id := public.jva_post_journal(
        p_request_id,
        'lottery_prize_claim',
        current_user_id,
        jsonb_build_object('ticket_id', ticket_row.id, 'prize_tokens', ticket_row.prize_tokens),
        'Premio de lotería',
        jsonb_build_array(
            jsonb_build_object('account', 'game:lottery', 'side', 'debit', 'amount', ticket_row.prize_tokens),
            jsonb_build_object('account', wallet_key, 'side', 'credit', 'amount', ticket_row.prize_tokens)
        )
    );
    update public.jva_game_reservations
    set status = 'paid', amount_tokens = 0, updated_at = now()
    where id = ticket_row.reservation_id;
    update public.jva_lottery_tickets
    set prize_claimed_at = now()
    where id = ticket_row.id;

    return jsonb_build_object(
        'ticket_id', ticket_row.id,
        'prize_tokens', ticket_row.prize_tokens,
        'journal_entry_id', entry_id
    );
end;
$$;

create or replace function public.jva_get_my_lottery_tickets(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
    result jsonb;
begin
    if current_user_id is null then
        raise exception 'Debes iniciar sesión.';
    end if;
    if p_limit is null or p_limit not between 1 and 100 then
        raise exception 'El límite del historial no es válido.';
    end if;

    select coalesce(jsonb_agg(item.value order by item.created_at desc), '[]'::jsonb)
    into result
    from (
        select ticket.created_at, jsonb_build_object(
            'id', ticket.id,
            'ticket_number', ticket.ticket_number,
            'draw_number', draw.draw_number,
            'draw_status', draw.status,
            'drawn_numbers', draw.drawn_numbers,
            'numbers', ticket.numbers,
            'price_tokens', ticket.price_tokens,
            'prize_preview_tokens', ticket.prize_preview_tokens,
            'prize_tokens', ticket.prize_tokens,
            'prize_claimed_at', ticket.prize_claimed_at,
            'created_at', ticket.created_at
        ) as value
        from public.jva_lottery_tickets ticket
        join public.jva_lottery_draws draw on draw.id = ticket.draw_id
        where ticket.buyer_id = current_user_id
        order by ticket.created_at desc
        limit p_limit
    ) item;
    return result;
end;
$$;

revoke all on function public.jva_post_journal(uuid, text, uuid, jsonb, text, jsonb)
    from public, anon, authenticated;
revoke all on function public.jva_available_prize_tokens(text)
    from public, anon, authenticated;
revoke all on function public.jva_require_active_user(uuid)
    from public, anon, authenticated;

revoke all on function public.jva_has_role(text[]) from public, anon;
revoke all on function public.jva_is_platform_access_allowed(uuid) from public, anon;
revoke all on function public.jva_ticket_numbers_are_unique(integer[]) from public, anon;
grant execute on function public.jva_has_role(text[]) to authenticated;
grant execute on function public.jva_is_platform_access_allowed(uuid) to authenticated;
grant execute on function public.jva_ticket_numbers_are_unique(integer[]) to authenticated;

revoke all on function public.jva_get_my_profile() from public, anon;
revoke all on function public.jva_get_public_config() from public;
revoke all on function public.jva_get_admin_users(text) from public, anon;
revoke all on function public.jva_get_wallet_history(integer) from public, anon;
revoke all on function public.jva_get_admin_financial_summary() from public, anon;
revoke all on function public.jva_ping_activity(text) from public, anon;
revoke all on function public.jva_deposit_tokens(uuid, bigint, text, uuid) from public, anon;
revoke all on function public.jva_redeem_tokens(uuid, bigint, text, uuid) from public, anon;
revoke all on function public.jva_withdraw_house_earnings(bigint, text, uuid) from public, anon;
revoke all on function public.jva_activate_user(uuid) from public, anon;
revoke all on function public.jva_set_account_blocked(uuid, boolean, text) from public, anon;
revoke all on function public.jva_update_platform_settings(integer, text, bigint) from public, anon;
revoke all on function public.jva_update_game_config(
    text, boolean, numeric, boolean, numeric, numeric, integer, integer, jsonb
) from public, anon;
revoke all on function public.jva_update_site_modules(jsonb) from public, anon;
revoke all on function public.jva_update_ticket_template(text, jsonb) from public, anon;
revoke all on function public.jva_preview_slot_bet(bigint) from public, anon;
revoke all on function public.jva_play_slots(bigint, uuid, bigint) from public, anon;
revoke all on function public.jva_preview_lottery_ticket() from public, anon;
revoke all on function public.jva_open_lottery_draw() from public, anon;
revoke all on function public.jva_issue_lottery_ticket(uuid, uuid, text, uuid, jsonb) from public, anon;
revoke all on function public.jva_settle_lottery_draw(uuid) from public, anon;
revoke all on function public.jva_claim_lottery_prize(uuid, uuid) from public, anon;
revoke all on function public.jva_get_my_lottery_tickets(integer) from public, anon;

grant execute on function public.jva_get_my_profile() to authenticated;
grant execute on function public.jva_get_public_config() to anon, authenticated;
grant execute on function public.jva_get_admin_users(text) to authenticated;
grant execute on function public.jva_get_wallet_history(integer) to authenticated;
grant execute on function public.jva_get_admin_financial_summary() to authenticated;
grant execute on function public.jva_ping_activity(text) to authenticated;
grant execute on function public.jva_deposit_tokens(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.jva_redeem_tokens(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.jva_withdraw_house_earnings(bigint, text, uuid) to authenticated;
grant execute on function public.jva_activate_user(uuid) to authenticated;
grant execute on function public.jva_set_account_blocked(uuid, boolean, text) to authenticated;
grant execute on function public.jva_update_platform_settings(integer, text, bigint) to authenticated;
grant execute on function public.jva_update_game_config(
    text, boolean, numeric, boolean, numeric, numeric, integer, integer, jsonb
) to authenticated;
grant execute on function public.jva_update_site_modules(jsonb) to authenticated;
grant execute on function public.jva_update_ticket_template(text, jsonb) to authenticated;
grant execute on function public.jva_preview_slot_bet(bigint) to authenticated;
grant execute on function public.jva_play_slots(bigint, uuid, bigint) to authenticated;
grant execute on function public.jva_preview_lottery_ticket() to authenticated;
grant execute on function public.jva_open_lottery_draw() to authenticated;
grant execute on function public.jva_issue_lottery_ticket(uuid, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.jva_settle_lottery_draw(uuid) to authenticated;
grant execute on function public.jva_claim_lottery_prize(uuid, uuid) to authenticated;
grant execute on function public.jva_get_my_lottery_tickets(integer) to authenticated;
