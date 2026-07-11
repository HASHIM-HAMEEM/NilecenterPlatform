-- Nile Learn Phase 2B local/dev rollback.
-- Run only before any dependent migration and never as a production data
-- rollback. Shared environments require an approved forward migration or
-- reviewed backup restore.

begin;

drop function public.revoke_auth_session_with_evidence(text, text, text);
drop function public.create_auth_session_with_evidence(
  text, uuid, uuid, uuid, integer, text, text
);
drop index public.audit_logs_session_lifecycle_uidx;

commit;
