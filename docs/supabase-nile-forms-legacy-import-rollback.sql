-- Roll back only the local Phase 13E finite legacy form migration evidence.

begin;

drop table public.form_legacy_import_records;

alter table public.form_submissions
  drop constraint form_submissions_legacy_import_run_id_fkey,
  add constraint form_submissions_legacy_import_run_id_fkey
    foreign key (legacy_import_run_id)
    references public.migration_runs(id) on delete restrict;

drop table public.form_legacy_import_runs;

drop function nile_private.preserve_form_legacy_import_record();
drop function nile_private.preserve_form_legacy_import_run();

commit;
