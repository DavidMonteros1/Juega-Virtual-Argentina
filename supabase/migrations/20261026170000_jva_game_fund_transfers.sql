create or replace function public.jva_fund_game_from_house_earnings(
    p_game_key text,
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
    existing_entry_id uuid;
    entry_id uuid;
    game_title text;
begin
    if current_user_id is null
       or not public.jva_has_role(array['super_admin']::text[]) then
        raise exception 'Solo el administrador maestro puede transferir fondos a un juego.';
    end if;
    if p_game_key is null
       or p_game_key not in ('slots', 'lottery', 'dice', 'mines', 'crash', 'wheel', 'jackpot')
       or p_amount is null or p_amount <= 0 or p_amount > 1000000000
       or p_reason is null or length(trim(p_reason)) not between 3 and 200
       or p_request_id is null then
        raise exception 'Los datos de la transferencia no son válidos.';
    end if;

    select game.title into game_title
    from public.jva_games game
    join public.jva_financial_accounts account
      on account.account_key = 'game:' || game.game_key
     and account.account_type = 'game_prize_liability'
    where game.game_key = p_game_key;
    if not found then
        raise exception 'El juego de destino no tiene un fondo contable disponible.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_request_id::text, 0)
    );
    select id into existing_entry_id
    from public.jva_journal_entries
    where request_id = p_request_id;

    entry_id := public.jva_post_journal(
        p_request_id,
        'game_fund_transfer',
        current_user_id,
        jsonb_build_object(
            'game_key', p_game_key,
            'source_account', 'house_earnings',
            'amount', p_amount,
            'reason', trim(p_reason)
        ),
        trim(p_reason),
        jsonb_build_array(
            jsonb_build_object('account', 'house_earnings', 'side', 'debit', 'amount', p_amount),
            jsonb_build_object('account', 'game:' || p_game_key, 'side', 'credit', 'amount', p_amount)
        )
    );

    if existing_entry_id is null then
        insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id, details)
        values (
            current_user_id,
            'game_fund_transfer',
            'game',
            p_game_key,
            jsonb_build_object(
                'game_title', game_title,
                'source_account', 'house_earnings',
                'amount_tokens', p_amount,
                'reason', trim(p_reason),
                'journal_entry_id', entry_id
            )
        );
    end if;
    return entry_id;
end;
$$;

revoke all on function public.jva_fund_game_from_house_earnings(text, bigint, text, uuid)
    from public, anon;
grant execute on function public.jva_fund_game_from_house_earnings(text, bigint, text, uuid)
    to authenticated;
