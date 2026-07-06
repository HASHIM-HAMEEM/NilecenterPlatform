import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/platform/ProtectedRoute";
import LegacyRouteRedirect from "./components/platform/LegacyRouteRedirect";
import type { Role } from "./lib/platformData";

// Public
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const PublicSitePage = lazy(() => import("./pages/public/PublicSitePage"));
const RoleDashboard = lazy(() => import("./pages/platform/RoleDashboard"));
const AuthFlowPage = lazy(() => import("./pages/platform/AuthFlowPage"));
const PlatformBlueprintPage = lazy(
  () => import("./pages/platform/PlatformBlueprintPage")
);
const AdminUsersPage = lazy(() => import("./pages/platform/AdminUsersPage"));
const AdminUserDetailPage = lazy(
  () => import("./pages/platform/AdminUserDetailPage")
);
const AdminSchedulePage = lazy(
  () => import("./pages/platform/AdminSchedulePage")
);
const AdminReportsPage = lazy(
  () => import("./pages/platform/AdminReportsPage")
);
const AdminCoursesPage = lazy(
  () => import("./pages/platform/AdminCoursesPage")
);
const TeacherAssessmentPage = lazy(
  () => import("./pages/platform/TeacherAssessmentPage")
);
const TeacherClassesPage = lazy(
  () => import("./pages/platform/TeacherClassesPage")
);
const TeacherClassDetailPage = lazy(
  () => import("./pages/platform/TeacherClassDetailPage")
);
const TeacherClassWorkspacePage = lazy(
  () => import("./pages/platform/TeacherClassWorkspacePage")
);
const MoodleSourcePage = lazy(
  () => import("./pages/platform/MoodleSourcePage")
);
const PortalReportsPage = lazy(
  () => import("./pages/platform/PortalReportsPage")
);
const PortalSettingsPage = lazy(
  () => import("./pages/platform/PortalSettingsPage")
);
const ProfileWorkspace = lazy(
  () => import("./pages/platform/ProfileWorkspace")
);
const FeaturePage = lazy(() => import("./components/platform/FeaturePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const dashboardRoutes: { path: string; role: Role }[] = [
  { path: "/app/student/dashboard", role: "student" },
  { path: "/app/teacher/dashboard", role: "teacher" },
  { path: "/app/registrar/dashboard", role: "registrar" },
  { path: "/app/hod/dashboard", role: "headofdepartment" },
  { path: "/app/branch/dashboard", role: "branchadmin" },
  { path: "/app/admin/dashboard", role: "superadmin" },
];

const featureRoutes: { path: string; role: Role; pageId: string }[] = [
  {
    path: "/app/student/courses/:courseId/learn/:lessonId",
    role: "student",
    pageId: "lesson",
  },
  {
    path: "/app/student/courses/:courseId/live",
    role: "student",
    pageId: "live",
  },
  {
    path: "/app/student/courses/:courseId",
    role: "student",
    pageId: "course-detail",
  },
  {
    path: "/app/student/assignments/:assignmentId",
    role: "student",
    pageId: "assignment-detail",
  },
  {
    path: "/app/student/quizzes/:quizId",
    role: "student",
    pageId: "quiz-detail",
  },
  { path: "/app/student/courses", role: "student", pageId: "courses" },
  { path: "/app/student/assignments", role: "student", pageId: "assignments" },
  { path: "/app/student/quizzes", role: "student", pageId: "quizzes" },
  { path: "/app/student/grades", role: "student", pageId: "grades" },
  { path: "/app/student/attendance", role: "student", pageId: "attendance" },
  { path: "/app/student/calendar", role: "student", pageId: "calendar" },
  { path: "/app/student/messages", role: "student", pageId: "messages" },
  {
    path: "/app/student/certificates",
    role: "student",
    pageId: "certificates",
  },
  { path: "/app/student/reports", role: "student", pageId: "reports" },
  { path: "/app/student/support", role: "student", pageId: "support" },
  {
    path: "/app/student/quran-progress",
    role: "student",
    pageId: "quran-progress",
  },

  {
    path: "/app/teacher/assignments/:assignmentId",
    role: "teacher",
    pageId: "assignment-detail",
  },
  { path: "/app/teacher/assignments", role: "teacher", pageId: "assignments" },
  { path: "/app/teacher/grading", role: "teacher", pageId: "grading" },
  { path: "/app/teacher/quizzes", role: "teacher", pageId: "quizzes" },
  {
    path: "/app/teacher/question-bank",
    role: "teacher",
    pageId: "question-bank",
  },
  { path: "/app/teacher/calendar", role: "teacher", pageId: "calendar" },
  { path: "/app/teacher/messages", role: "teacher", pageId: "messages" },
  {
    path: "/app/teacher/quran-review",
    role: "teacher",
    pageId: "quran-review",
  },

  {
    path: "/app/registrar/leads/:leadId",
    role: "registrar",
    pageId: "lead-detail",
  },
  {
    path: "/app/registrar/applications/:applicationId",
    role: "registrar",
    pageId: "application-detail",
  },
  {
    path: "/app/registrar/students/:studentId",
    role: "registrar",
    pageId: "student-detail",
  },
  {
    path: "/app/registrar/placement-tests/:bookingId",
    role: "registrar",
    pageId: "placement-detail",
  },
  { path: "/app/registrar/leads", role: "registrar", pageId: "leads" },
  {
    path: "/app/registrar/applications",
    role: "registrar",
    pageId: "applications",
  },
  { path: "/app/registrar/students", role: "registrar", pageId: "students" },
  {
    path: "/app/registrar/placement-tests",
    role: "registrar",
    pageId: "placement-tests",
  },
  {
    path: "/app/registrar/enrollments",
    role: "registrar",
    pageId: "enrollments",
  },
  { path: "/app/registrar/classes", role: "registrar", pageId: "classes" },
  { path: "/app/registrar/schedule", role: "registrar", pageId: "schedule" },
  { path: "/app/registrar/payments", role: "registrar", pageId: "payments" },
  { path: "/app/registrar/messages", role: "registrar", pageId: "messages" },

  {
    path: "/app/hod/departments",
    role: "headofdepartment",
    pageId: "departments",
  },
  { path: "/app/hod/programs", role: "headofdepartment", pageId: "programs" },
  { path: "/app/hod/courses", role: "headofdepartment", pageId: "courses" },
  { path: "/app/hod/levels", role: "headofdepartment", pageId: "levels" },
  {
    path: "/app/hod/curriculum",
    role: "headofdepartment",
    pageId: "curriculum",
  },
  { path: "/app/hod/teachers", role: "headofdepartment", pageId: "teachers" },
  { path: "/app/hod/classes", role: "headofdepartment", pageId: "classes" },
  { path: "/app/hod/schedule", role: "headofdepartment", pageId: "schedule" },
  {
    path: "/app/hod/assessments",
    role: "headofdepartment",
    pageId: "assessments",
  },
  {
    path: "/app/hod/certificates",
    role: "headofdepartment",
    pageId: "certificates",
  },
  { path: "/app/hod/reports", role: "headofdepartment", pageId: "reports" },
  { path: "/app/hod/messages", role: "headofdepartment", pageId: "messages" },

  { path: "/app/branch/students", role: "branchadmin", pageId: "students" },
  { path: "/app/branch/teachers", role: "branchadmin", pageId: "teachers" },
  { path: "/app/branch/classes", role: "branchadmin", pageId: "classes" },
  { path: "/app/branch/rooms", role: "branchadmin", pageId: "rooms" },
  { path: "/app/branch/schedule", role: "branchadmin", pageId: "schedule" },
  { path: "/app/branch/attendance", role: "branchadmin", pageId: "attendance" },
  { path: "/app/branch/payments", role: "branchadmin", pageId: "payments" },
  { path: "/app/branch/reports", role: "branchadmin", pageId: "reports" },
  { path: "/app/branch/messages", role: "branchadmin", pageId: "messages" },

  {
    path: "/app/admin/users/:userId",
    role: "superadmin",
    pageId: "user-detail",
  },
  { path: "/app/admin/users", role: "superadmin", pageId: "users" },
  { path: "/app/admin/roles", role: "superadmin", pageId: "roles" },
  { path: "/app/admin/permissions", role: "superadmin", pageId: "permissions" },
  { path: "/app/admin/branches", role: "superadmin", pageId: "branches" },
  { path: "/app/admin/departments", role: "superadmin", pageId: "departments" },
  { path: "/app/admin/programs", role: "superadmin", pageId: "programs" },
  { path: "/app/admin/courses", role: "superadmin", pageId: "courses" },
  { path: "/app/admin/messages", role: "superadmin", pageId: "messages" },
  {
    path: "/app/admin/certificates",
    role: "superadmin",
    pageId: "certificates",
  },
  { path: "/app/admin/schedule", role: "superadmin", pageId: "schedule" },
  { path: "/app/admin/settings", role: "superadmin", pageId: "settings" },
  {
    path: "/app/admin/integrations",
    role: "superadmin",
    pageId: "integrations",
  },
  { path: "/app/admin/audit-logs", role: "superadmin", pageId: "audit-logs" },
  { path: "/app/admin/reports", role: "superadmin", pageId: "reports" },
  {
    path: "/app/admin/system-health",
    role: "superadmin",
    pageId: "system-health",
  },
];

function RouteLoading() {
  return (
    <main className="platform-route-loading" aria-live="polite">
      <span />
      <strong>Loading workspace</strong>
    </main>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        {/* Public */}
        <Route path="/" component={Home} />
        <Route path="/login">
          <Login />
        </Route>
        <Route path="/auth/login">
          <Login />
        </Route>
        <Route path="/auth/student-login">
          <Login audience="student" />
        </Route>
        <Route path="/auth/administration-login">
          <Login audience="administration" />
        </Route>
        <Route path="/auth/admin-login">
          <Login audience="administration" />
        </Route>
        <Route path="/auth/forgot-password">
          <AuthFlowPage mode="forgot-password" />
        </Route>
        <Route path="/auth/reset-password">
          <AuthFlowPage mode="reset-password" />
        </Route>
        <Route path="/auth/select-role">
          <AuthFlowPage mode="select-role" />
        </Route>
        <Route path="/auth/logout">
          <AuthFlowPage mode="logout" />
        </Route>

        <Route path="/courses">
          <PublicSitePage mode="catalog" />
        </Route>
        <Route path="/courses/arabic">
          <PublicSitePage mode="catalog" slug="arabic" />
        </Route>
        <Route path="/courses/quran">
          <PublicSitePage mode="catalog" slug="quran" />
        </Route>
        <Route path="/courses/islamic-studies">
          <PublicSitePage mode="catalog" slug="islamic-studies" />
        </Route>
        <Route path="/courses/turkish">
          <PublicSitePage mode="catalog" slug="turkish" />
        </Route>
        <Route path="/courses/english">
          <PublicSitePage mode="catalog" slug="english" />
        </Route>
        <Route path="/courses/teacher-training">
          <PublicSitePage mode="catalog" slug="teacher-training" />
        </Route>
        <Route path="/courses/kids">
          <PublicSitePage mode="catalog" slug="kids" />
        </Route>
        <Route path="/courses/enterprise">
          <PublicSitePage mode="catalog" slug="enterprise" />
        </Route>
        <Route path="/courses/:slug">
          {params => <PublicSitePage mode="course" slug={params.slug} />}
        </Route>
        <Route path="/book-free-trial">
          <PublicSitePage mode="trial" />
        </Route>
        <Route path="/book-placement-test">
          <PublicSitePage mode="placement" />
        </Route>
        <Route path="/verify-certificate">
          <PublicSitePage mode="verify" />
        </Route>
        <Route path="/faq">
          <PublicSitePage mode="faq" />
        </Route>
        <Route path="/contact">
          <PublicSitePage mode="contact" />
        </Route>
        <Route path="/about">
          <PublicSitePage mode="about" />
        </Route>
        <Route path="/privacy">
          <PublicSitePage mode="privacy" />
        </Route>
        <Route path="/terms">
          <PublicSitePage mode="terms" />
        </Route>

        <Route path="/app">
          <AuthFlowPage mode="select-role" />
        </Route>

        {dashboardRoutes.map(route => (
          <Route key={route.path} path={route.path}>
            <ProtectedRoute role={route.role} pageId="dashboard">
              <RoleDashboard role={route.role} />
            </ProtectedRoute>
          </Route>
        ))}

        <Route path="/app/admin/platform-blueprint">
          <ProtectedRoute role="superadmin" pageId="platform-blueprint">
            <PlatformBlueprintPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/users/new">
          <ProtectedRoute role="superadmin" pageId="users">
            <AdminUsersPage mode="create" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/users/:userId">
          {params => (
            <ProtectedRoute role="superadmin" pageId="user-detail">
              <AdminUserDetailPage userId={params.userId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/admin/users">
          <ProtectedRoute role="superadmin" pageId="users">
            <AdminUsersPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/conflicts">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="conflicts" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/sessions">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="sessions" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/rooms">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="rooms" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/activity">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="activity" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule/calendar">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="calendar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/schedule">
          <ProtectedRoute role="superadmin" pageId="schedule">
            <AdminSchedulePage view="calendar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports/attendance">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="attendance" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/reports">
          <ProtectedRoute role="superadmin" pageId="reports">
            <AdminReportsPage view="overview" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/programs">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="programs" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/levels">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="levels" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/curriculum">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="curriculum" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/teachers">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="teachers" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses/resources">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="resources" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/courses">
          <ProtectedRoute role="superadmin" pageId="courses">
            <AdminCoursesPage view="catalog" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quizzes/new">
          <ProtectedRoute role="teacher" pageId="quizzes">
            <TeacherAssessmentPage view="new-quiz" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quizzes/review">
          <ProtectedRoute role="teacher" pageId="quizzes">
            <TeacherAssessmentPage view="review" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/quizzes">
          <ProtectedRoute role="teacher" pageId="quizzes">
            <TeacherAssessmentPage view="quizzes" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/question-bank/new">
          <ProtectedRoute role="teacher" pageId="question-bank">
            <TeacherAssessmentPage view="new-question" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/question-bank">
          <ProtectedRoute role="teacher" pageId="question-bank">
            <TeacherAssessmentPage view="question-bank" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/classes">
          <ProtectedRoute role="teacher" pageId="classes">
            <TeacherClassesPage />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/classes/:classId">
          {params => (
            <ProtectedRoute role="teacher" pageId="class-detail">
              <TeacherClassDetailPage classId={params.classId} />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/sessions">
          {params => (
            <ProtectedRoute role="teacher" pageId="sessions">
              <TeacherClassWorkspacePage classId={params.classId} view="sessions" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/attendance">
          {params => (
            <ProtectedRoute role="teacher" pageId="attendance">
              <TeacherClassWorkspacePage classId={params.classId} view="attendance" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/students">
          {params => (
            <ProtectedRoute role="teacher" pageId="students">
              <TeacherClassWorkspacePage classId={params.classId} view="students" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/teacher/classes/:classId/materials">
          {params => (
            <ProtectedRoute role="teacher" pageId="materials">
              <TeacherClassWorkspacePage classId={params.classId} view="materials" />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/app/student/moodle-source">
          <ProtectedRoute role="student" pageId="moodle-source">
            <MoodleSourcePage role="student" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/moodle-source">
          <ProtectedRoute role="teacher" pageId="moodle-source">
            <MoodleSourcePage role="teacher" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/moodle-source">
          <ProtectedRoute role="headofdepartment" pageId="moodle-source">
            <MoodleSourcePage role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/moodle-source">
          <ProtectedRoute role="superadmin" pageId="moodle-source">
            <MoodleSourcePage role="superadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/student/profile">
          <ProtectedRoute role="student" pageId="profile">
            <ProfileWorkspace role="student" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/profile">
          <ProtectedRoute role="teacher" pageId="profile">
            <ProfileWorkspace role="teacher" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/profile">
          <ProtectedRoute role="registrar" pageId="profile">
            <ProfileWorkspace role="registrar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/profile">
          <ProtectedRoute role="headofdepartment" pageId="profile">
            <ProfileWorkspace role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/profile">
          <ProtectedRoute role="branchadmin" pageId="profile">
            <ProfileWorkspace role="branchadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/admin/profile">
          <ProtectedRoute role="superadmin" pageId="profile">
            <ProfileWorkspace role="superadmin" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/reports/attendance">
          <ProtectedRoute role="teacher" pageId="reports">
            <PortalReportsPage role="teacher" view="attendance" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/reports/grades">
          <ProtectedRoute role="teacher" pageId="reports">
            <PortalReportsPage role="teacher" view="grades" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/teacher/reports">
          <ProtectedRoute role="teacher" pageId="reports">
            <PortalReportsPage role="teacher" view="overview" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/reports/admissions">
          <ProtectedRoute role="registrar" pageId="reports">
            <PortalReportsPage role="registrar" view="admissions" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/reports/payments">
          <ProtectedRoute role="registrar" pageId="reports">
            <PortalReportsPage role="registrar" view="payments" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/reports">
          <ProtectedRoute role="registrar" pageId="reports">
            <PortalReportsPage role="registrar" view="overview" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/registrar/settings">
          <ProtectedRoute role="registrar" pageId="settings">
            <PortalSettingsPage role="registrar" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/hod/settings">
          <ProtectedRoute role="headofdepartment" pageId="settings">
            <PortalSettingsPage role="headofdepartment" />
          </ProtectedRoute>
        </Route>

        <Route path="/app/branch/settings">
          <ProtectedRoute role="branchadmin" pageId="settings">
            <PortalSettingsPage role="branchadmin" />
          </ProtectedRoute>
        </Route>

        {featureRoutes.map(route => (
          <Route key={route.path} path={route.path}>
            {params => (
              <ProtectedRoute role={route.role} pageId={route.pageId}>
                <FeaturePage
                  role={route.role}
                  pageId={route.pageId}
                  params={params}
                />
              </ProtectedRoute>
            )}
          </Route>
        ))}

        {/* Legacy prototype routes now land in the maintained /app platform. */}
        {[
          "/dashboard",
          "/students",
          "/classes",
          "/users",
          "/messages",
          "/payments",
          "/reports",
          "/schedule",
          "/profile",
          "/notifications",
          "/settings",
          "/student",
          "/student/courses",
          "/student/grades",
          "/student/attendance",
          "/student/schedule",
          "/teacher",
          "/teacher/classes",
          "/teacher/attendance",
          "/teacher/scores",
          "/teacher/schedule",
          "/registrar",
          "/registrar/register",
          "/registrar/pending",
          "/registrar/payments",
        ].map(path => (
          <Route key={path} path={path}>
            <LegacyRouteRedirect legacyPath={path} />
          </Route>
        ))}

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
