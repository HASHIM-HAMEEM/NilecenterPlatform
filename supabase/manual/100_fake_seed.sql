-- Nile Learn local-only Phase 1 authority fixtures.
--
-- These rows are deterministic fake data for migration, scope, and repository
-- tests. They contain no passwords, provider credentials, or real identities.

begin;

insert into auth.users (id)
values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

insert into public.branches (id, code, name, timezone, status)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'online',
    'Online',
    'Africa/Cairo',
    'active'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'cairo-b1',
    'Cairo B1',
    'Africa/Cairo',
    'active'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'alexandria-b2',
    'Alexandria B2',
    'Africa/Cairo',
    'active'
  )
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  timezone = excluded.timezone,
  status = excluded.status;

insert into public.departments (id, code, name, status)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'arabic-quran',
    'Arabic and Quran',
    'active'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'foundations',
    'Foundations',
    'active'
  )
on conflict (id) do update
set code = excluded.code, name = excluded.name, status = excluded.status;

insert into public.department_branches (department_id, branch_id)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003'
  )
on conflict (department_id, branch_id) do nothing;

insert into public.app_users (
  id,
  auth_user_id,
  full_name,
  email,
  status,
  activated_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Local Student',
    'student@nilelearn.local',
    'active',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Local Teacher',
    'teacher@nilelearn.local',
    'active',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'Local Registrar',
    'registrar@nilelearn.local',
    'active',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'Local Head of Department',
    'hod@nilelearn.local',
    'active',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000005',
    'Local Branch Admin',
    'branch@nilelearn.local',
    'active',
    now()
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000006',
    'Local Super Admin',
    'admin@nilelearn.local',
    'active',
    now()
  )
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  status = excluded.status;

insert into public.permissions (code, category, description, sensitive)
values
  ('dashboard.read', 'workspace', 'Read the assigned role dashboard', false),
  ('profile.read', 'identity', 'Read the signed-in profile', false),
  ('classes.read', 'learning', 'Read classes within the active scope', false),
  ('attendance.write', 'learning', 'Save attendance for authorized classes', true),
  ('reports.read', 'governance', 'Read reports within the active scope', false),
  ('users.manage', 'governance', 'Manage authorized user lifecycle records', true)
on conflict (code) do update
set
  category = excluded.category,
  description = excluded.description,
  sensitive = excluded.sensitive;

insert into public.role_permissions (
  role,
  permission_code,
  granted,
  updated_by
)
values
  ('student', 'dashboard.read', true, '40000000-0000-4000-8000-000000000006'),
  ('student', 'profile.read', true, '40000000-0000-4000-8000-000000000006'),
  ('student', 'classes.read', true, '40000000-0000-4000-8000-000000000006'),
  ('teacher', 'dashboard.read', true, '40000000-0000-4000-8000-000000000006'),
  ('teacher', 'profile.read', true, '40000000-0000-4000-8000-000000000006'),
  ('teacher', 'classes.read', true, '40000000-0000-4000-8000-000000000006'),
  ('teacher', 'attendance.write', true, '40000000-0000-4000-8000-000000000006'),
  ('registrar', 'dashboard.read', true, '40000000-0000-4000-8000-000000000006'),
  ('registrar', 'users.manage', true, '40000000-0000-4000-8000-000000000006'),
  ('headofdepartment', 'dashboard.read', true, '40000000-0000-4000-8000-000000000006'),
  ('headofdepartment', 'reports.read', true, '40000000-0000-4000-8000-000000000006'),
  ('branchadmin', 'dashboard.read', true, '40000000-0000-4000-8000-000000000006'),
  ('branchadmin', 'reports.read', true, '40000000-0000-4000-8000-000000000006'),
  ('superadmin', 'dashboard.read', true, '40000000-0000-4000-8000-000000000006'),
  ('superadmin', 'users.manage', true, '40000000-0000-4000-8000-000000000006'),
  ('superadmin', 'reports.read', true, '40000000-0000-4000-8000-000000000006')
on conflict (role, permission_code) do update
set granted = excluded.granted, updated_by = excluded.updated_by;

insert into public.role_grants (
  id,
  user_id,
  role,
  status,
  granted_by,
  granted_reason
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'student',
    'active',
    '40000000-0000-4000-8000-000000000006',
    'Local Phase 1 fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'teacher',
    'active',
    '40000000-0000-4000-8000-000000000006',
    'Local Phase 1 fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000003',
    'registrar',
    'active',
    '40000000-0000-4000-8000-000000000006',
    'Local Phase 1 fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000004',
    'headofdepartment',
    'active',
    '40000000-0000-4000-8000-000000000006',
    'Local Phase 1 fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000005',
    'branchadmin',
    'active',
    '40000000-0000-4000-8000-000000000006',
    'Local Phase 1 fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000006',
    'superadmin',
    'active',
    '40000000-0000-4000-8000-000000000006',
    'Local Phase 1 fixture'
  )
on conflict (id) do nothing;

insert into public.role_grant_branch_scopes (
  id,
  role_grant_id,
  branch_id,
  granted_by
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000006'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000006'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000006'
  ),
  (
    '60000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000006'
  ),
  (
    '60000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000006'
  )
on conflict (id) do nothing;

insert into public.role_grant_department_scopes (
  id,
  role_grant_id,
  department_id,
  granted_by
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000006'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000006'
  )
on conflict (id) do nothing;

insert into public.staff_profiles (
  id,
  user_id,
  title,
  availability_status,
  status
)
values
  (
    '80000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'Teacher',
    'available',
    'active'
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000003',
    'Registrar',
    'not_applicable',
    'active'
  ),
  (
    '80000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000004',
    'Head of Department',
    'not_applicable',
    'active'
  ),
  (
    '80000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000005',
    'Branch Administrator',
    'not_applicable',
    'active'
  ),
  (
    '80000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000006',
    'Super Administrator',
    'not_applicable',
    'active'
  )
on conflict (user_id) do update
set
  title = excluded.title,
  availability_status = excluded.availability_status,
  status = excluded.status;

insert into public.staff_subjects (
  id,
  staff_profile_id,
  subject,
  teaching_level
)
values
  (
    '90000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002',
    'Arabic grammar',
    'Arabic Level 3'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002',
    'Tajweed',
    'Tajweed 1'
  )
on conflict (id) do nothing;

set constraints all immediate;

commit;
