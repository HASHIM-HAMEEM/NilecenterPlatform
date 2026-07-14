# Moodle M2B Synthetic Sandbox Write Proof Evidence

## Decision Boundary

This record covers only the dedicated practice sandbox at
`moodle-no-data.enesekremergunesh.com`. It does not enable a Nile Learn runtime
route, Moodle production write, Supabase write, worker, scheduler, or portal
action. All remote records used by the proof were synthetic.

ADR-008 and `docs/MOODLE_INTEGRATION_EXECUTION_PLAN.md` remain the authority for
the allowed mutation surface and cleanup rules.

## Provider Boundary

- Separate M2 read and M2B write services and tokens were used.
- The write service was authorised-users-only and exposed exactly eleven
  functions:
  - `core_webservice_get_site_info`
  - `core_user_get_users`
  - `core_user_create_users`
  - `core_user_update_users`
  - `core_user_delete_users`
  - `enrol_manual_enrol_users`
  - `enrol_manual_unenrol_users`
  - `core_group_create_groups`
  - `core_group_delete_groups`
  - `core_group_add_group_members`
  - `core_group_delete_group_members`
- The proof was restricted to synthetic course ID `2` and Moodle learner role
  ID `5`.
- The client limited user lookup to one exact marker criterion and required the
  returned marker plus deterministic fake username to match. Moodle's function
  remains broader at provider level, so the token was short-lived and revoked
  after the proof.
- The write role temporarily required course access, `moodle/role:assign`, and
  one role-assignment matrix edge from the write role to Student. These
  temporary privileges were removed after the proof.

## Accepted Run

- Started: `2026-07-13T14:55:03.166Z`
- Completed: `2026-07-13T14:55:18.370Z`
- Validator outcome: `completed`
- Ensure passes: `2`
- Redacted workflow evidence rows: `20`
- Read projection before:
  `431e299859d18e836277d9934e962f9a5e8471a0402df1524482158cb91ff908`
- Read projection after:
  `431e299859d18e836277d9934e962f9a5e8471a0402df1524482158cb91ff908`
- Read projection unchanged: `true`

Pass one created and verified one fake user, one manual enrolment, one group,
and one group membership. Pass two adopted the same user, enrolment, group, and
membership without duplicates. Cleanup then removed membership, group,
enrolment, and user in dependency order. Final reconciliation reported all four
targets absent.

An orphaned synthetic learner from an earlier interrupted diagnostic was found
by exact fake username and marker, removed, and verified absent. This incident
is why the validator now accepts an optional canonical
`MOODLE_SANDBOX_WRITE_RUN_MARKER`. For cross-process recovery, the marker must
be set before the first invocation and reused after interruption so the
restarted process can reconcile the same synthetic operation keys instead of
generating unrelated keys.

## Independent Cleanup Checks

- The course group page contained only the pre-existing `Nile QA Group A`; no
  `NILE-M2B-*` group remained.
- The course participant page contained only the pre-existing synthetic QA
  teacher and student; the write-service account and proof learner were absent.
- The user list contained no synthetic proof learner after cleanup.
- The temporary write-service course enrolment was removed.
- The write-role-to-Student assignment edge and `moodle/role:assign`
  capability were revoked.
- The write service was disabled and its authorised-user list was emptied.
- The temporary write-service account was suspended, set to no-login, and then
  deleted.
- A final token probe returned Moodle `invalidtoken`, proving the write token
  was no longer usable.

## Local Verification

The focused M2B client, workflow, and validator suites passed `40/40` tests.
They cover exact request serialization, stale function surfaces, malformed and
warning responses, missing-email provider behavior, mutation
read-after-timeout reconciliation, bounded retry, cleanup unknown outcomes,
and explicit canonical-marker recovery.

The complete local TypeScript check passed, all `562/562` unit tests passed
across 49 files, and the production build passed. The non-browser gates in
`scripts/verify.sh` also passed before its first portal-QA process received an
external `SIGTERM` after 486 seconds. The runner preserved its partial summary
instead of treating the interruption as success.

To avoid repeating that host-process limit while retaining every check, the
protected portal suite was rerun with its existing role filter against four
isolated servers and data directories. Public form workflows and role-denial
checks were run as a separate focused partition because role-filtered runs
intentionally omit public form workflows:

| Partition                          |    Result | Summary artifact                                                                   |
| ---------------------------------- | --------: | ---------------------------------------------------------------------------------- |
| Public Nile Forms and role denials |   `20/20` | `output/playwright/moodle-m2b-forms-sequence-focus/portal-qa-summary.json`         |
| Student                            | `363/363` | `output/playwright/moodle-m2b-20260713-shard-student/portal-qa-summary.json`       |
| Teacher                            | `349/349` | `output/playwright/moodle-m2b-20260713-shard-teacher/portal-qa-summary.json`       |
| Registrar and HOD                  | `591/591` | `output/playwright/moodle-m2b-20260713-shard-registrar-hod/portal-qa-summary.json` |
| Branch Admin and Super Admin       | `696/696` | `output/playwright/moodle-m2b-20260713-shard-branch-admin/portal-qa-summary.json`  |

The partitions executed 2,019 checks with zero failures. That sum includes
deliberate repetition of common public, authentication, and shell checks in
each role shard, so it does not replace the official single-run `1,598/0`
baseline. Together the partitions cover all six role route matrices, deep
workflows, mobile matrices, public form workflows, role denials,
accessibility, responsive overflow, and console checks without removing or
weakening an assertion.

No credential, password, token, raw provider payload, or real identity is
stored in this record or in repository configuration examples.

## Remaining Boundary

This proof validates the sandbox provider contract only. Production Moodle
writes remain blocked on normalized external mappings, durable command/audit
and outbox persistence, worker leases, reconciliation approval, RLS, and a
separate production threat review. Moodle course content, activities, grades,
attempts, submissions, messages, attendance, files, and media were not mutated.
