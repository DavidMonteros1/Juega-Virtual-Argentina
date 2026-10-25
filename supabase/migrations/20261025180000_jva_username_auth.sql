do $$
begin
    if exists (
        select 1
        from public.jva_profiles profile
        join auth.users auth_user on auth_user.id = profile.user_id
        where auth_user.email is distinct from
            lower(profile.username) || '@accounts.jva.invalid'
    ) then
        raise exception
            'Hay cuentas creadas con el método anterior de teléfono. Detén esta migración y coordina la migración segura de esas cuentas antes de continuar.';
    end if;
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
    requested_whatsapp text;
    expected_auth_email text;
begin
    requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
    requested_whatsapp := nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), '');

    if requested_username is null
       or length(requested_username) not between 3 and 24
       or requested_username !~ '^[A-Za-z0-9_]+$'
       or requested_whatsapp is null
       or requested_whatsapp !~ '^\+[1-9][0-9]{7,14}$' then
        raise exception 'El registro requiere usuario válido y WhatsApp internacional.';
    end if;

    expected_auth_email := lower(requested_username) || '@accounts.jva.invalid';
    if new.email is distinct from expected_auth_email then
        raise exception 'El identificador interno de autenticación no coincide.';
    end if;

    insert into public.jva_profiles (user_id, username, phone_e164)
    values (new.id, requested_username, requested_whatsapp);

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
