create index if not exists jva_journal_entries_created_id
    on public.jva_journal_entries (created_at desc, id desc);

create or replace function public.jva_get_admin_ledger(
    p_account_key text default null,
    p_before_created_at timestamptz default null,
    p_before_id uuid default null,
    p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
    entries_result jsonb;
    account_result jsonb;
    has_more boolean;
    debit_total numeric;
    credit_total numeric;
    unbalanced_entry_count bigint;
    account_mismatch_count bigint;
    mismatches jsonb;
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede consultar la auditoría contable.';
    end if;
    if p_limit is null or p_limit not between 1 and 100
       or (p_before_created_at is null) <> (p_before_id is null) then
        raise exception 'Los parámetros de paginación no son válidos.';
    end if;
    if p_account_key is not null and not exists (
        select 1 from public.jva_financial_accounts
        where account_key = p_account_key
    ) then
        raise exception 'La cuenta contable seleccionada no existe.';
    end if;

    select
        coalesce(sum(case when line.side = 'debit' then line.amount_tokens else 0 end), 0),
        coalesce(sum(case when line.side = 'credit' then line.amount_tokens else 0 end), 0)
    into debit_total, credit_total
    from public.jva_journal_lines line;

    select count(*) into unbalanced_entry_count
    from (
        select entry.id
        from public.jva_journal_entries entry
        left join public.jva_journal_lines line on line.entry_id = entry.id
        group by entry.id
        having count(line.entry_id) = 0
            or sum(case when line.side = 'debit' then line.amount_tokens else 0 end)
                <> sum(case when line.side = 'credit' then line.amount_tokens else 0 end)
    ) unbalanced;

    with account_ledger as materialized (
        select
            account.account_key,
            case
                when account.account_type = 'asset' then 'Caja física'
                when account.account_type = 'house_income' then 'Ganancias de la casa'
                when account.account_type = 'game_prize_liability' then
                    'Fondo: ' || coalesce(game.title, account.game_key)
                when account.account_type = 'player_liability' then
                    'Billetera: ' || coalesce(profile.username, account.owner_user_id::text)
                else account.account_key
            end as account_label,
            account.balance_tokens as current_balance,
            coalesce(sum(
                case
                    when line.side = account.normal_side then line.amount_tokens
                    else -line.amount_tokens
                end
            ), 0) as ledger_balance
        from public.jva_financial_accounts account
        left join public.jva_journal_lines line on line.account_key = account.account_key
        left join public.jva_profiles profile on profile.user_id = account.owner_user_id
        left join public.jva_games game on game.game_key = account.game_key
        group by
            account.account_key, account.account_type, account.game_key,
            account.owner_user_id, account.normal_side, account.balance_tokens,
            profile.username, game.title
    ),
    mismatch_rows as (
        select coalesce(jsonb_agg(jsonb_build_object(
            'account_key', mismatch.account_key,
            'account_label', mismatch.account_label,
            'current_balance', mismatch.current_balance,
            'ledger_balance', mismatch.ledger_balance,
            'balance_matches_ledger', false
        ) order by mismatch.account_key), '[]'::jsonb) as value
        from (
            select *
            from account_ledger
            where current_balance <> ledger_balance
            order by account_key
            limit 20
        ) mismatch
    ),
    selected_account as (
        select jsonb_build_object(
            'account_key', account_key,
            'account_label', account_label,
            'current_balance', current_balance,
            'ledger_balance', ledger_balance,
            'balance_matches_ledger', current_balance = ledger_balance
        ) as value
        from account_ledger
        where account_key = p_account_key
    )
    select
        count(*) filter (where account_ledger.current_balance <> account_ledger.ledger_balance),
        mismatch_rows.value,
        (select value from selected_account)
    into account_mismatch_count, mismatches, account_result
    from account_ledger
    cross join mismatch_rows
    group by mismatch_rows.value;

    select count(*) > p_limit into has_more
    from (
        select entry.id
        from public.jva_journal_entries entry
        where (p_account_key is null or exists (
            select 1 from public.jva_journal_lines line
            where line.entry_id = entry.id and line.account_key = p_account_key
        ))
          and (
              p_before_created_at is null
              or (entry.created_at, entry.id) < (p_before_created_at, p_before_id)
          )
        order by entry.created_at desc, entry.id desc
        limit p_limit + 1
    ) page;

    select coalesce(jsonb_agg(item.value order by item.created_at desc, item.id desc), '[]'::jsonb)
    into entries_result
    from (
        select
            entry.id,
            entry.created_at,
            jsonb_build_object(
                'id', entry.id,
                'request_id', entry.request_id,
                'operation', entry.operation,
                'description', entry.description,
                'created_at', entry.created_at,
                'actor_username', actor.username,
                'debit_total', entry_totals.debit_total,
                'lines', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'account_key', line.account_key,
                        'account_label', case
                            when account.account_type = 'asset' then 'Caja física'
                            when account.account_type = 'house_income' then 'Ganancias de la casa'
                            when account.account_type = 'game_prize_liability' then
                                'Fondo: ' || coalesce(game.title, account.game_key)
                            when account.account_type = 'player_liability' then
                                'Billetera: ' || coalesce(profile.username, account.owner_user_id::text)
                            else line.account_key
                        end,
                        'side', line.side,
                        'amount_tokens', line.amount_tokens,
                        'balance_effect', case
                            when line.side = account.normal_side then line.amount_tokens
                            else -line.amount_tokens
                        end
                    ) order by line.line_number), '[]'::jsonb)
                    from public.jva_journal_lines line
                    join public.jva_financial_accounts account
                      on account.account_key = line.account_key
                    left join public.jva_profiles profile
                      on profile.user_id = account.owner_user_id
                    left join public.jva_games game
                      on game.game_key = account.game_key
                    where line.entry_id = entry.id
                ),
                'related', nullif(concat_ws(
                    ' · ',
                    game_bet.reference,
                    ticket.reference,
                    jackpot_entry.reference,
                    jackpot_draw.reference
                ), '')
            ) as value
        from (
            select entry.*
            from public.jva_journal_entries entry
            where (p_account_key is null or exists (
                select 1 from public.jva_journal_lines line
                where line.entry_id = entry.id and line.account_key = p_account_key
            ))
              and (
                  p_before_created_at is null
                  or (entry.created_at, entry.id) < (p_before_created_at, p_before_id)
              )
            order by entry.created_at desc, entry.id desc
            limit p_limit
        ) entry
        left join public.jva_profiles actor on actor.user_id = entry.actor_id
        cross join lateral (
            select coalesce(sum(line.amount_tokens) filter (where line.side = 'debit'), 0) as debit_total
            from public.jva_journal_lines line
            where line.entry_id = entry.id
        ) entry_totals
        left join lateral (
            select 'Apuesta ' || bet.game_key || ' · ' || bet.outcome ||
                ' · costo ' || bet.stake_tokens::text ||
                ' · premio ' || bet.payout_tokens::text as reference
            from public.jva_game_bets bet
            where bet.request_id = entry.request_id
            limit 1
        ) game_bet on true
        left join lateral (
            select 'Cartón #' || ticket.ticket_number::text ||
                ' · sorteo #' || draw.draw_number::text as reference
            from public.jva_lottery_tickets ticket
            join public.jva_lottery_draws draw on draw.id = ticket.draw_id
            where ticket.request_id = entry.request_id
            limit 1
        ) ticket on true
        left join lateral (
            select 'Entrada Jackpot · sorteo #' || draw.draw_number::text as reference
            from public.jva_jackpot_entries jackpot
            join public.jva_jackpot_draws draw on draw.id = jackpot.draw_id
            where jackpot.request_id = entry.request_id
            limit 1
        ) jackpot_entry on true
        left join lateral (
            select 'Liquidación Jackpot · sorteo #' || draw.draw_number::text as reference
            from public.jva_admin_audit audit
            join public.jva_jackpot_draws draw
              on draw.id::text = audit.entity_id
            where audit.action = 'jackpot_draw_settled'
              and audit.details ->> 'journal_entry_id' = entry.id::text
            limit 1
        ) jackpot_draw on true
    ) item;

    result := jsonb_build_object(
        'entries', entries_result,
        'has_more', has_more,
        'account_summary', account_result,
        'reconciliation', jsonb_build_object(
            'debit_total', debit_total,
            'credit_total', credit_total,
            'unbalanced_entry_count', unbalanced_entry_count,
            'account_mismatch_count', account_mismatch_count,
            'mismatches', mismatches
        )
    );
    return result;
end;
$$;

revoke all on function public.jva_get_admin_ledger(text, timestamptz, uuid, integer)
    from public, anon;
grant execute on function public.jva_get_admin_ledger(text, timestamptz, uuid, integer)
    to authenticated;
