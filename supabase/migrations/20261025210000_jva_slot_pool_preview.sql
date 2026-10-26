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
    available_prize_pool bigint;
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
    available_prize_pool := public.jva_available_prize_tokens('slots');
    available_after_bet := available_prize_pool + contribution;
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
        'available_prize_pool_tokens', available_prize_pool,
        'prize_pool_after_bet_tokens', available_after_bet,
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
