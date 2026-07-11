-- Nile Learn Phase 1 local/dev rollback draft.
--
-- Planning artifact only. Run only against a disposable database immediately
-- after the matching Phase 1 migration and before any dependent migration.
-- Never use this as a production data rollback. Production rollback restores a
-- reviewed backup or uses an approved forward/compensating migration.

begin;

drop function public.resolve_auth_session_authority(text);
drop function public.resolve_login_authority(uuid, text);

drop table public.migration_evidence;
drop table public.migration_run_items;
drop table public.migration_runs;
drop table public.reconciliation_cases;
drop table public.sync_run_items;
drop table public.sync_runs;
drop table public.sync_cursors;
drop table public.external_records;
drop table public.integration_env_requirements;
drop table public.integration_connections;
drop table public.outbox_events;
drop table public.audit_logs;
drop table public.command_executions;
drop table public.auth_sessions;
drop table public.staff_subjects;
drop table public.staff_profiles;
drop table public.role_grant_department_scopes;
drop table public.role_grant_branch_scopes;
drop table public.role_grants;
drop table public.role_permissions;
drop table public.permissions;
drop table public.department_branches;
drop table public.departments;
drop table public.app_users;
drop table public.branches;

-- The private schema is owned by this phase. CASCADE removes only its helper
-- functions after all Phase 1 tables and their triggers have been removed.
drop schema nile_private cascade;

-- Shared extensions are intentionally retained.

commit;
