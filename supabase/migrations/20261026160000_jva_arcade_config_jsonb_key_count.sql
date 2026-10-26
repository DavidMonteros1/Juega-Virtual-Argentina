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
    settings_key_count integer;
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
    select count(*)::integer into settings_key_count
    from pg_catalog.jsonb_object_keys(p_settings);
    if settings_key_count <> cardinality(expected_keys)
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

revoke all on function public.jva_update_arcade_game_config(text, boolean, numeric, jsonb)
    from public, anon;
grant execute on function public.jva_update_arcade_game_config(text, boolean, numeric, jsonb)
    to authenticated;
