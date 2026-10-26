alter table public.jva_account_security
    add column account_archived_at timestamptz;

create or replace function public.jva_keep_archived_accounts_blocked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if old.account_archived_at is not null and new.account_archived_at is null then
        raise exception 'No se puede revertir el retiro de una cuenta.';
    end if;
    if new.account_archived_at is not null and new.access_blocked_at is null then
        raise exception 'Una cuenta retirada debe permanecer bloqueada.';
    end if;
    return new;
end;
$$;

create trigger jva_archived_accounts_stay_blocked
    before update on public.jva_account_security
    for each row execute function public.jva_keep_archived_accounts_blocked();

create or replace function public.jva_archive_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := (select auth.uid());
begin
    if not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede retirar cuentas.';
    end if;
    if p_user_id is null then
        raise exception 'La cuenta indicada no es válida.';
    end if;
    if p_user_id = current_user_id then
        raise exception 'No puedes retirar tu propia cuenta.';
    end if;
    if exists (
        select 1 from public.jva_user_roles
        where user_id = p_user_id and role in ('super_admin', 'admin', 'cashier')
    ) then
        raise exception 'No se puede retirar una cuenta del equipo administrativo.';
    end if;

    perform 1 from public.jva_account_security
    where user_id = p_user_id
    for update;
    if not found then
        raise exception 'No existe la cuenta indicada.';
    end if;
    if exists (
        select 1 from public.jva_account_security
        where user_id = p_user_id and account_archived_at is not null
    ) then
        raise exception 'La cuenta ya fue retirada.';
    end if;

    update public.jva_account_security
    set access_blocked_at = coalesce(access_blocked_at, now()),
        access_blocked_by = current_user_id,
        access_block_reason = 'Cuenta retirada por administración.',
        account_archived_at = now(),
        updated_at = now()
    where user_id = p_user_id;

    insert into public.jva_admin_audit (actor_id, action, entity_type, entity_id)
    values (current_user_id, 'account_archived', 'user', p_user_id::text);
end;
$$;

create or replace function public.jva_search_admin_accounts(
    p_search text,
    p_show_archived boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
begin
    if p_show_archived is null then
        raise exception 'El filtro de cuentas retiradas no es válido.';
    end if;
    if not public.jva_has_role(array['super_admin', 'admin', 'cashier']::text[]) then
        raise exception 'No tienes permiso para consultar las cuentas.';
    end if;
    if p_show_archived
       and not public.jva_has_role(array['super_admin', 'admin']::text[]) then
        raise exception 'Solo administración puede consultar cuentas retiradas.';
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
            'account_archived_at', security.account_archived_at,
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
        where (security.account_archived_at is not null) = p_show_archived
          and (
              nullif(trim(p_search), '') is null
              or profile.username ilike '%' || trim(p_search) || '%'
              or profile.phone_e164 ilike '%' || trim(p_search) || '%'
          )
        order by profile.created_at desc
        limit 200
    ) users;

    return result;
end;
$$;

revoke all on function public.jva_archive_account(uuid) from public, anon;
revoke all on function public.jva_search_admin_accounts(text, boolean) from public, anon;
grant execute on function public.jva_archive_account(uuid) to authenticated;
grant execute on function public.jva_search_admin_accounts(text, boolean) to authenticated;
