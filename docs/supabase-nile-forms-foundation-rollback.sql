-- Roll back only the local Phase 13A Nile Forms foundation.
-- Phase 1 identity, scope, session, audit, and outbox tables remain intact.

begin;

delete from public.role_permissions
where permission_code in (
  'forms.read',
  'forms.write',
  'forms.publish',
  'forms.assign',
  'forms.respond',
  'form_submissions.read',
  'form_submissions.review',
  'form_submissions.export'
);

delete from public.permissions
where code in (
  'forms.read',
  'forms.write',
  'forms.publish',
  'forms.assign',
  'forms.respond',
  'form_submissions.read',
  'form_submissions.review',
  'form_submissions.export'
);

drop table public.form_attachments;
drop table public.form_sync_receipts;
drop table public.form_offline_devices;
drop table public.form_promotions;
drop table public.form_reviews;
drop table public.form_submission_index_values;
drop table public.form_submissions;
drop table public.form_drafts;
drop table public.form_assignments;
drop table public.form_publications;

alter table public.form_definitions
  drop column current_draft_version_id,
  drop column current_published_version_id;

drop table public.form_versions;
drop table public.form_definitions;

drop function nile_private.preserve_form_submission_evidence();
drop function nile_private.preserve_published_form_version();

commit;
