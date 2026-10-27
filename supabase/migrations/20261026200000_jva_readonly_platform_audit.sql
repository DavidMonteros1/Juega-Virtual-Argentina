alter table public.jva_user_roles
    drop constraint jva_user_roles_role_check,
    add constraint jva_user_roles_role_check
        check (role in ('super_admin', 'admin', 'cashier', 'ai_auditor'));

create or replace function public.jva_get_platform_audit()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
begin
    if (select auth.uid()) is null
       or not public.jva_has_role(
           array['super_admin', 'admin', 'ai_auditor']::text[]
       ) then
        raise exception 'Se requiere un rol autorizado para consultar la auditoría.';
    end if;

    select jsonb_build_object(
        'generated_at', pg_catalog.statement_timestamp(),
        'database', pg_catalog.current_database(),
        'relations', (
            select coalesce(jsonb_agg(relation_row.value order by relation_row.relation_name), '[]'::jsonb)
            from (
                select
                    relation.relname as relation_name,
                    jsonb_build_object(
                        'name', relation.relname,
                        'kind', case relation.relkind
                            when 'r' then 'table'
                            when 'p' then 'partitioned_table'
                            when 'v' then 'view'
                            when 'm' then 'materialized_view'
                            when 'f' then 'foreign_table'
                            else relation.relkind::text
                        end,
                        'owner', pg_catalog.pg_get_userbyid(relation.relowner),
                        'rls_enabled', relation.relrowsecurity,
                        'rls_forced', relation.relforcerowsecurity,
                        'columns', (
                            select coalesce(jsonb_agg(jsonb_build_object(
                                'name', attribute.attname,
                                'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                                'nullable', not attribute.attnotnull,
                                'identity', attribute.attidentity <> '',
                                'generated', attribute.attgenerated <> ''
                            ) order by attribute.attnum), '[]'::jsonb)
                            from pg_catalog.pg_attribute attribute
                            where attribute.attrelid = relation.oid
                              and attribute.attnum > 0
                              and not attribute.attisdropped
                        ),
                        'constraints', (
                            select coalesce(jsonb_agg(jsonb_build_object(
                                'name', constraint_row.conname,
                                'type', constraint_row.contype,
                                'definition', pg_catalog.pg_get_constraintdef(constraint_row.oid, true),
                                'validated', constraint_row.convalidated
                            ) order by constraint_row.conname), '[]'::jsonb)
                            from pg_catalog.pg_constraint constraint_row
                            where constraint_row.conrelid = relation.oid
                        ),
                        'indexes', (
                            select coalesce(jsonb_agg(jsonb_build_object(
                                'name', index_relation.relname,
                                'valid', index_data.indisvalid,
                                'unique', index_data.indisunique,
                                'definition', pg_catalog.pg_get_indexdef(index_data.indexrelid)
                            ) order by index_relation.relname), '[]'::jsonb)
                            from pg_catalog.pg_index index_data
                            join pg_catalog.pg_class index_relation
                              on index_relation.oid = index_data.indexrelid
                            where index_data.indrelid = relation.oid
                        ),
                        'policies', (
                            select coalesce(jsonb_agg(jsonb_build_object(
                                'name', policy.polname,
                                'command', case policy.polcmd
                                    when 'r' then 'SELECT'
                                    when 'a' then 'INSERT'
                                    when 'w' then 'UPDATE'
                                    when 'd' then 'DELETE'
                                    when '*' then 'ALL'
                                    else policy.polcmd::text
                                end,
                                'permissive', policy.polpermissive,
                                'roles', (
                                    select coalesce(jsonb_agg(
                                        case
                                            when policy_role.role_oid = 0 then 'PUBLIC'
                                            else pg_catalog.pg_get_userbyid(policy_role.role_oid)
                                        end
                                        order by policy_role.role_oid
                                    ), '[]'::jsonb)
                                    from pg_catalog.unnest(policy.polroles) as policy_role(role_oid)
                                ),
                                'using', pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
                                'with_check', pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
                            ) order by policy.polname), '[]'::jsonb)
                            from pg_catalog.pg_policy policy
                            where policy.polrelid = relation.oid
                        )
                    ) as value
                from pg_catalog.pg_class relation
                join pg_catalog.pg_namespace schema_row
                  on schema_row.oid = relation.relnamespace
                where schema_row.nspname = 'public'
                  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
            ) relation_row
        ),
        'functions', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'name', routine.proname,
                'identity_arguments', pg_catalog.pg_get_function_identity_arguments(routine.oid),
                'return_type', pg_catalog.pg_get_function_result(routine.oid),
                'owner', pg_catalog.pg_get_userbyid(routine.proowner),
                'security_definer', routine.prosecdef,
                'volatility', case routine.provolatile
                    when 'i' then 'immutable'
                    when 's' then 'stable'
                    else 'volatile'
                end,
                'execute_acl', coalesce(
                    routine.proacl,
                    pg_catalog.acldefault('f', routine.proowner)
                )::text
            ) order by routine.proname, pg_catalog.pg_get_function_identity_arguments(routine.oid)), '[]'::jsonb)
            from pg_catalog.pg_proc routine
            join pg_catalog.pg_namespace schema_row
              on schema_row.oid = routine.pronamespace
            where schema_row.nspname = 'public'
              and routine.prokind in ('f', 'p')
        ),
        'table_privileges', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'table', relation.relname,
                'grantee', case
                    when privilege.grantee = 0 then 'PUBLIC'
                    else pg_catalog.pg_get_userbyid(privilege.grantee)
                end,
                'privilege', privilege.privilege_type,
                'grantable', privilege.is_grantable
            ) order by relation.relname, privilege.grantee, privilege.privilege_type), '[]'::jsonb)
            from pg_catalog.pg_class relation
            join pg_catalog.pg_namespace schema_row
              on schema_row.oid = relation.relnamespace
            cross join lateral pg_catalog.aclexplode(coalesce(
                relation.relacl,
                pg_catalog.acldefault('r', relation.relowner)
            )) privilege
            where schema_row.nspname = 'public'
              and relation.relkind in ('r', 'p', 'v', 'm', 'f')
        ),
        'triggers', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'name', trigger_row.tgname,
                'table', relation.relname,
                'enabled', trigger_row.tgenabled <> 'D',
                'definition', pg_catalog.pg_get_triggerdef(trigger_row.oid, true)
            ) order by relation.relname, trigger_row.tgname), '[]'::jsonb)
            from pg_catalog.pg_trigger trigger_row
            join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
            join pg_catalog.pg_namespace schema_row on schema_row.oid = relation.relnamespace
            where schema_row.nspname = 'public'
              and not trigger_row.tgisinternal
        ),
        'extensions', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'name', extension.extname,
                'version', extension.extversion,
                'schema', schema_row.nspname
            ) order by extension.extname), '[]'::jsonb)
            from pg_catalog.pg_extension extension
            join pg_catalog.pg_namespace schema_row
              on schema_row.oid = extension.extnamespace
        ),
        'economy', (
            select jsonb_build_object(
                'accounts', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'account_key', ledger.account_key,
                        'account_type', ledger.account_type,
                        'current_balance', ledger.current_balance,
                        'ledger_balance', ledger.ledger_balance,
                        'matches_ledger', ledger.current_balance = ledger.ledger_balance
                    ) order by ledger.account_key), '[]'::jsonb)
                    from (
                        select
                            account.account_key,
                            account.account_type,
                            account.balance_tokens as current_balance,
                            coalesce(sum(
                                case
                                    when line.side = account.normal_side then line.amount_tokens
                                    else -line.amount_tokens
                                end
                            ), 0) as ledger_balance
                        from public.jva_financial_accounts account
                        left join public.jva_journal_lines line
                          on line.account_key = account.account_key
                        group by account.account_key, account.account_type,
                            account.balance_tokens, account.normal_side
                    ) ledger
                ),
                'journal', (
                    select jsonb_build_object(
                        'entry_count', count(distinct entry.id),
                        'debit_total', coalesce(sum(line.amount_tokens)
                            filter (where line.side = 'debit'), 0),
                        'credit_total', coalesce(sum(line.amount_tokens)
                            filter (where line.side = 'credit'), 0),
                        'unbalanced_entries', (
                            select count(*)
                            from (
                                select entry_check.id
                                from public.jva_journal_entries entry_check
                                left join public.jva_journal_lines line_check
                                  on line_check.entry_id = entry_check.id
                                group by entry_check.id
                                having count(line_check.entry_id) = 0
                                    or coalesce(sum(line_check.amount_tokens)
                                        filter (where line_check.side = 'debit'), 0)
                                      <> coalesce(sum(line_check.amount_tokens)
                                        filter (where line_check.side = 'credit'), 0)
                            ) unbalanced
                        )
                    )
                    from public.jva_journal_entries entry
                    left join public.jva_journal_lines line on line.entry_id = entry.id
                ),
                'reservations', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'game_key', reservation.game_key,
                        'status', reservation.status,
                        'count', reservation.reservation_count,
                        'amount_tokens', reservation.amount_tokens
                    ) order by reservation.game_key, reservation.status), '[]'::jsonb)
                    from (
                        select game_key, status, count(*) as reservation_count,
                            coalesce(sum(amount_tokens), 0) as amount_tokens
                        from public.jva_game_reservations
                        group by game_key, status
                    ) reservation
                ),
                'games', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'game_key', game.game_key,
                        'enabled', game.enabled,
                        'house_share_percent', game.house_share_percent,
                        'fund_tokens', coalesce(fund.balance_tokens, 0),
                        'reserved_tokens', coalesce(reservations.reserved_tokens, 0),
                        'available_tokens', coalesce(fund.balance_tokens, 0)
                            - coalesce(reservations.reserved_tokens, 0)
                    ) order by game.game_key), '[]'::jsonb)
                    from public.jva_games game
                    left join public.jva_financial_accounts fund
                      on fund.account_key = 'game:' || game.game_key
                    left join lateral (
                        select sum(amount_tokens) as reserved_tokens
                        from public.jva_game_reservations reservation
                        where reservation.game_key = game.game_key
                          and reservation.status in ('held', 'claimable')
                    ) reservations on true
                )
            )
        )
    )
    into result;

    return result;
end;
$$;

revoke all on function public.jva_get_platform_audit()
    from public, anon;
grant execute on function public.jva_get_platform_audit()
    to authenticated;
