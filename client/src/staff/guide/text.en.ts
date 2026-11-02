import type { GuideText } from "./text";

export const guideTextEn: GuideText = {
  categories: {
    access: {
      title: "Access and session",
      summary: "Your profile, role view, branch workspace, and notifications.",
    },
    setup: {
      title: "School setup",
      summary:
        "Branches, departments, reasons, custom fields, Moodle, and health.",
    },
    jotform: {
      title: "Jotform intake",
      summary: "Connect Jotform forms and read their submissions.",
    },
    staff: {
      title: "Staff accounts",
      summary: "Add, edit, reset, and set up staff members.",
    },
    leads: {
      title: "Leads",
      summary: "New leads, the journey, the board, groups, and conversion.",
    },
    bookings: {
      title: "Bookings",
      summary:
        "Placement tests and trial lessons, from request to recorded result.",
    },
    students: {
      title: "Students",
      summary: "Student records, owner, documents, and progress.",
    },
    enrolments: {
      title: "Enrolments",
      summary: "Course sales, payments, class placement, and endings.",
    },
    classes: {
      title: "Classes",
      summary: "Classes, sessions, attendance, and the teaching week.",
    },
    rooms: {
      title: "Rooms",
      summary: "Room records and weekly availability.",
    },
    forms: {
      title: "Nile Forms",
      summary:
        "Build, publish, and answer forms, and turn responses into leads.",
    },
    reports: {
      title: "Reports",
      summary: "Read the reports and export their rows.",
    },
  },
  scenarios: {
    "manage-own-profile": {
      title: "Manage your own profile",
      summary:
        "Check your details, change your password, and manage your sessions.",
      steps: [
        {
          title: "Open Profile",
          body: "Open the account menu at the bottom of the sidebar and choose Profile. Your details show your name, email, and assigned role.",
        },
        {
          title: "Change your password",
          body: "Under Change password, enter your current password and the new one twice. Then use Change password.",
        },
        {
          title: "Review your sessions",
          body: "Active sessions lists your sign-ins. Use Sign out session on one you do not recognise, or Sign out everywhere.",
        },
      ],
      notes: [],
    },
    "act-as-a-lower-role": {
      title: "View the app as a lower role",
      summary:
        "See what another role sees without signing out, then return to your own role.",
      steps: [
        {
          title: "Choose View as role",
          body: "Open the account menu at the bottom of the sidebar, choose View as role, and pick the role.",
        },
        {
          title: "Work in the role view",
          body: "A Viewing as chip appears in the header. Open it to change the role or limit branches, departments, or classes, then use Apply.",
        },
        {
          title: "Return to your role",
          body: "Use the X on the chip to return to your own role. You can also pick your own role under View as role.",
        },
      ],
      notes: [
        "While you view as a role, the app uses that role's access and scope, also for changes.",
        "Only roles below yours are offered. Super Admin, Branch Admin, Vice Manager, and Head of Department can use it.",
      ],
    },
    "switch-branch-workspace": {
      title: "Switch your branch workspace",
      summary:
        "Pick the branch your lists and pages work in when your role works in one branch at a time.",
      steps: [
        {
          title: "Choose a branch",
          body: "Branch Admin, Vice Manager, Registrar, and SSA see the Choose a branch screen after signing in.",
        },
        {
          title: "Pick the branch",
          body: "Select the branch to work in. Lists, new records, and the dashboard then use that branch.",
        },
        {
          title: "Switch again later",
          body: "Use the workspace picker at the bottom of the sidebar, above your name, to change branch at any time.",
        },
      ],
      notes: [
        "Super Admin works across all branches and has no workspace picker.",
      ],
    },
    "read-notifications": {
      title: "Read your notifications",
      summary:
        "Open Notifications to see what changed, mark items read, or clear the list.",
      steps: [
        {
          title: "Open Notifications",
          body: "Open Notifications under Home in the sidebar. Unread items carry an Unread badge, and the Unread tab shows only those.",
        },
        {
          title: "Mark all read",
          body: "Use Mark all read to clear the unread state without deleting anything. Mark read does the same for one item.",
        },
        {
          title: "Delete all",
          body: "Use Delete all and confirm. Only your copies are deleted.",
        },
      ],
      notes: [],
    },
    "add-a-branch": {
      title: "Add a branch",
      summary: "Create a branch so it can hold leads, students, and classes.",
      steps: [
        {
          title: "Open Branches",
          body: "Open Branches under People and places and use Add branch.",
        },
        {
          title: "Enter the details",
          body: "Enter the name, code, timezone, and whether it is an online branch. Then use Create branch.",
        },
        {
          title: "Assign staff",
          body: "Add the branch to Branch scope on each staff account that should work in it.",
        },
      ],
      notes: [],
    },
    "add-a-department": {
      title: "Add a department",
      summary: "Create a department for courses and heads of department.",
      steps: [
        {
          title: "Open Departments",
          body: "Open Departments under People and places and use Add department.",
        },
        {
          title: "Name it",
          body: "Enter the name and code, then use Create department.",
        },
        {
          title: "Use it",
          body: "Set Departments on a Head of Department account on the Staff page. Courses take their department in Edit course.",
        },
      ],
      notes: [],
    },
    "manage-action-reasons": {
      title: "Manage action reasons",
      summary:
        "Keep the reason lists used when records are cancelled, left, or disabled.",
      steps: [
        {
          title: "Open Action reasons",
          body: "Open Action reasons under Setup. Use the Kind filter to see one list.",
        },
        {
          title: "Add or rename",
          body: "Use Add action reason, or Edit on a row to rename it. Import CSV adds many reasons at once.",
        },
        {
          title: "Disable unused reasons",
          body: "Use Disable on a row instead of deleting it.",
        },
      ],
      notes: [
        "A disabled reason is hidden from new work. Use Enable to bring it back.",
      ],
    },
    "set-up-areas-of-study": {
      title: "Set up areas of study",
      summary: "Maintain the subjects a student can be placed into.",
      steps: [
        {
          title: "Open Areas of study",
          body: "Open Areas of study under Setup and use Add area of study.",
        },
        {
          title: "Add or edit",
          body: "Enter the name and sort order, and add the Moodle courses that hold its placement tests. Use Edit on a row to change it later.",
        },
        {
          title: "Disable unused areas",
          body: "Use Disable on areas you no longer offer instead of deleting them.",
        },
      ],
      notes: [],
    },
    "add-a-custom-field": {
      title: "Add a custom field",
      summary:
        "Add your own fields to staff, student, lead, branch, and other records.",
      steps: [
        {
          title: "Open Custom fields",
          body: "Open Custom fields under Setup and use Add custom field.",
        },
        {
          title: "Choose where it lives",
          body: "Pick the entity, such as Staff profile, Student, or Branch. Enter a field key, a type, and a name.",
        },
        {
          title: "Set the options",
          body: "For a select field, enter one option per line under Options. Tick Required field if needed, then use Create field.",
        },
      ],
      notes: ["The field key cannot be changed after the field is created."],
    },
    "connect-moodle": {
      title: "Connect the Moodle site",
      summary:
        "Connect the Moodle site that backs courses, groups, and attendance.",
      steps: [
        {
          title: "Open Moodle",
          body: "Open Moodle under System.",
        },
        {
          title: "Enter the site",
          body: "Enter the Site URL and the Web service token, then use Connect Moodle.",
        },
        {
          title: "Test the connection",
          body: "Use Test connection. The Status card shows whether the site is reachable and on the expected version.",
        },
      ],
      notes: [
        "Disconnect removes the stored token. Courses and groups stop syncing until you connect again.",
      ],
    },
    "link-a-course": {
      title: "Link a Moodle course",
      summary: "Add a course by linking one from the Moodle catalog.",
      steps: [
        {
          title: "Open Courses",
          body: "Open Courses under Teaching and use Link Moodle course.",
        },
        {
          title: "Pick the Moodle course",
          body: "Filter by Categories or search, then choose a Moodle course that is not linked yet.",
        },
        {
          title: "Finish the details",
          body: "Set the department and total teaching hours, then use Link course.",
        },
      ],
      notes: [
        "Use Refresh from Moodle when the Moodle list looks out of date.",
      ],
    },
    "check-system-health": {
      title: "Check system health",
      summary: "See whether the backend services are reachable.",
      steps: [
        {
          title: "Open System health",
          body: "Open System health under System.",
        },
        {
          title: "Read the statuses",
          body: "API, Database, Schema check, Migrations, and Moodle each show a status, such as Healthy or Degraded. Use Refresh to check again.",
        },
      ],
      notes: [],
    },
    "register-a-form": {
      title: "Register a Jotform form",
      summary: "Connect a Jotform form so its submissions arrive in EMS.",
      steps: [
        {
          title: "Open Jotform",
          body: "Open Jotform under System and use Connect a form.",
        },
        {
          title: "Enter the form ID",
          body: "Paste the numeric form ID or a Jotform link. The title is checked on Jotform and fills in the name.",
        },
        {
          title: "Choose what it creates",
          body: "Under Creates, pick Lead, Lead + placement test, or Lead + trial lesson, and a fallback branch. Then use Connect form.",
        },
      ],
      notes: [
        "Submissions only arrive after the EMS team points the Jotform webhook at EMS.",
      ],
    },
    "map-form-fields": {
      title: "Map a form's fields",
      summary:
        "Tell EMS which Jotform questions hold the name, email, and other details.",
      steps: [
        {
          title: "Open the form",
          body: "Open the form from the Jotform list to reach its setup page.",
        },
        {
          title: "Match the questions",
          body: "Under Questions, enter each Jotform question's unique name next to the EMS input it fills. Then use Save.",
        },
        {
          title: "Turn on receiving",
          body: "Turn on Receiving submissions once every required input shows Matched.",
        },
      ],
      notes: ["The switch stays off until every required input is matched."],
    },
    "receive-a-submission": {
      title: "Receive a submission",
      summary: "Check that new Jotform submissions arrive and are stored.",
      steps: [
        {
          title: "Open Submissions",
          body: "Use Submissions on the form's row in the Jotform list, or on its setup page.",
        },
        {
          title: "Follow new rows",
          body: "Each submission Jotform sends to EMS appears as a row with its received time.",
        },
      ],
      notes: [
        "If nothing arrives, ask the EMS team to check the Jotform webhook first.",
      ],
    },
    "read-a-submission": {
      title: "Read a submission",
      summary: "Open one submission to see its answers.",
      steps: [
        {
          title: "Pick the row",
          body: "Open a submission row on the form's Submissions page.",
        },
        {
          title: "Read the answers",
          body: "Each question shows with the visitor's answer. Use Find lead to search Leads by the email, or Open on Jotform.",
        },
      ],
      notes: [],
    },
    "invite-staff": {
      title: "Add a staff member",
      summary:
        "Create a staff account with an invitation link or a temporary password.",
      steps: [
        {
          title: "Open Staff",
          body: "Open Staff under People and places and use Add staff member.",
        },
        {
          title: "Fill the account",
          body: "Enter the first name, last name, email, and role. Under Provisioning, choose Invitation link or Manual password.",
        },
        {
          title: "Set scope and create",
          body: "Pick the Branch scope and use Create staff member. Copy the one-time link or password and share it securely.",
        },
      ],
      notes: [
        "Branch Admin adds Vice Manager, HOD, Registrar, SSA, or Teacher. Vice Manager adds HOD, Registrar, SSA, or Teacher.",
      ],
    },
    "edit-staff": {
      title: "Edit a staff member",
      summary: "Change a staff member's details, branch scope, or role.",
      steps: [
        {
          title: "Find the person",
          body: "Open Staff and open the person, then use Edit. The row menu on the list also has Edit.",
        },
        {
          title: "Change the details",
          body: "Update the name, email, contact details, or branch scope, then use Save changes.",
        },
        {
          title: "Check the result",
          body: "The staff detail page shows the saved values.",
        },
      ],
      notes: [
        "Branch Admin manages Vice Manager, HOD, Registrar, SSA, and Teacher. Vice Manager manages HOD, Registrar, SSA, and Teacher.",
        "Only Super Admin can change a role or a Head of Department's departments.",
      ],
    },
    "reset-or-disable-staff": {
      title: "Reset or disable a staff account",
      summary: "Set a new password or turn an account off and back on.",
      steps: [
        {
          title: "Open the account",
          body: "Open the staff member and use More actions.",
        },
        {
          title: "Set a password",
          body: "Set password creates a temporary password. Copy it from One-time credentials and share it securely.",
        },
        {
          title: "Disable or enable",
          body: "Disable asks for a reason and stops sign-in. Enable lets the account sign in again.",
        },
      ],
      notes: ["You cannot reset or disable your own account."],
    },
    "bind-staff-moodle": {
      title: "Link a staff member to Moodle",
      summary: "Connect a staff account to its Moodle account.",
      steps: [
        {
          title: "Open the account",
          body: "Open the staff member, use More actions, and choose Moodle account.",
        },
        {
          title: "Create or link",
          body: "Choose Create Moodle account, or Link Moodle account and search for the existing one. Then confirm.",
        },
      ],
      notes: [],
    },
    "set-up-a-teacher": {
      title: "Set up a teacher",
      summary:
        "Give a teacher account its courses, availability, and placement-test right.",
      steps: [
        {
          title: "Create or open the account",
          body: "Add the staff member with the Teacher role and a branch scope, or open an existing teacher.",
        },
        {
          title: "Set teachable courses",
          body: "On the Courses tab, pick the courses they can teach and use Save changes.",
        },
        {
          title: "Set availability and tests",
          body: "Paint weekly hours on the Availability tab and save. Use Edit to tick Can take placement tests if they should run them.",
        },
      ],
      notes: [
        "The placement-test switch shows for Teacher only. HOD and Vice Manager are always eligible.",
        "A teacher with no teachable courses cannot be assigned to a class.",
      ],
    },
    "add-a-lead": {
      title: "Add a lead",
      summary: "Create a lead with contact details and study preferences.",
      steps: [
        {
          title: "Open Leads",
          body: "Open Leads under Admissions and use Add lead.",
        },
        {
          title: "Fill contact and interest",
          body: "Enter the name, email, phone, study mode, preferred courses, and area of study. Then use Create lead.",
        },
        {
          title: "Land on the journey",
          body: "The lead page opens. The Next step card shows what to do first, usually Book placement test.",
        },
      ],
      notes: [
        "Nile Learn keeps one lead per email. If a lead already uses the email, the form cannot be saved.",
      ],
    },
    "work-a-lead": {
      title: "Work a lead through the journey",
      summary: "Follow the Next step card from first contact to student.",
      steps: [
        {
          title: "Open the lead",
          body: "Open a lead to see its journey: First contact, Placement test, Trial lesson, Registration fee, and Student.",
        },
        {
          title: "Do the next step",
          body: "The Next step card shows one main button, such as Book placement test, Record result, or Record registration fee.",
        },
        {
          title: "Finish at conversion",
          body: "Once the fee is recorded, the Next step card offers Create student.",
        },
      ],
      notes: [
        "A step the lead does not need, such as a placement test, shows as Skipped.",
      ],
    },
    "use-the-pipeline-board": {
      title: "Use the pipeline board",
      summary: "See every lead's stage at once and move them by drag or menu.",
      steps: [
        {
          title: "Open the board",
          body: "Open Leads and choose Board in the view switch.",
        },
        {
          title: "Move a card",
          body: "Drag a card to another stage, or use its Move to menu. Dropping on Placement test or Trial lesson opens the booking sheet.",
        },
        {
          title: "Use bulk actions",
          body: "Select cards and use Move to… in the bar. Bulk moves go to In process, Follow up, Future registration, or Lost.",
        },
      ],
      notes: [
        "Registered is not a drop target. Leads become registered when they become students.",
      ],
    },
    "manage-lead-groups": {
      title: "See lead groups",
      summary: "See which leads belong together in one group.",
      steps: [
        {
          title: "Check the Group column",
          body: "On Leads, the list view shows each lead's group in the Group column.",
        },
        {
          title: "Open a member",
          body: "Open a grouped lead. The Grouped with section lists the other members, and the main contact is tagged Main contact.",
        },
        {
          title: "Move between members",
          body: "Select a name in Grouped with to open that lead.",
        },
      ],
      notes: [],
    },
    "mark-a-lead-lost": {
      title: "Mark a lead lost",
      summary: "Close a lead with a reason, and reopen it if they come back.",
      steps: [
        {
          title: "Open the lead or the board",
          body: "On the lead page, open More actions and choose Mark as lost. On the board, drop the card on Lost.",
        },
        {
          title: "Pick a reason",
          body: "Choose a lost reason and confirm. The reasons come from Lost reasons under Setup.",
        },
        {
          title: "Reopen if needed",
          body: "Open the lead and use Reopen lead in More actions. The Lost stage on the Leads list shows every lost lead.",
        },
      ],
      notes: [
        "Lost leads count in the Admissions report under By lost reason.",
        "Reopening moves the lead back to In process.",
      ],
    },
    "check-for-duplicates": {
      title: "Check for duplicates",
      summary:
        "Use the match warnings before creating a lead or student twice.",
      steps: [
        {
          title: "Type the details",
          body: "In Add lead or Add student, the form checks the email and name as you type.",
        },
        {
          title: "Open the match",
          body: "Matches show under Already in Nile Learn or Someone with the same name. Use Open to go to that record.",
        },
      ],
      notes: [
        "A lead email already used by another lead blocks saving. Other matches only warn, and the button changes to Create anyway.",
      ],
    },
    "convert-a-lead": {
      title: "Convert a lead to a student",
      summary:
        "Turn a lead into a student once the registration fee is recorded.",
      steps: [
        {
          title: "Reach the convert step",
          body: "Record the registration fee. The Next step card then offers Create student.",
        },
        {
          title: "Check identity",
          body: "Fill nationality, address, gender, and date of birth, plus national ID or passport number. Add a guardian for students under 18.",
        },
        {
          title: "Pick the SSA",
          body: "If the Owner field shows, choose the SSA who will follow the student, or leave No owner.",
        },
        {
          title: "Create the student",
          body: "Use Create student. The student page opens, with the sale ready if a result recommended a course.",
        },
      ],
      notes: [
        "The SSA is chosen at conversion, by Super Admin, Branch Admin, or Vice Manager only.",
        "Registrar does not see the Owner field when converting.",
      ],
    },
    "schedule-a-placement-test": {
      title: "Schedule a placement test",
      summary: "Book a placement test for a lead or student.",
      steps: [
        {
          title: "Start from the person",
          body: "Placement tests lists bookings but has no create button. Use Book placement test on the lead's Next step card or the student's Placement and trials tab.",
        },
        {
          title: "Pick time and place",
          body: "Choose the date and start time, and the area of study if known. Onsite branches need a room; online branches need a meeting link.",
        },
        {
          title: "Save the booking",
          body: "Use Book. The booking shows under Upcoming on Placement tests until it has a result.",
        },
      ],
      notes: [
        "Onsite bookings need a room. Online branches use a meeting link instead.",
      ],
    },
    "schedule-review-placement": {
      title: "Schedule a placement request",
      summary: "Turn a placement request into a booked slot.",
      steps: [
        {
          title: "Open To review",
          body: "On Placement tests, open the To review tab to see requests without a time.",
        },
        {
          title: "Schedule it",
          body: "Use Schedule on the row, check the visitor's request, pick the date and room, and use Schedule.",
        },
      ],
      notes: [],
    },
    "record-a-placement-result": {
      title: "Record a placement result",
      summary: "Enter the outcome when the placement test is done.",
      steps: [
        {
          title: "Open the booking",
          body: "Find the booking under Upcoming on Placement tests, or on the lead page, and use Record result.",
        },
        {
          title: "Record the result",
          body: "Enter the score or level and the mentoring teacher, plus a recommended course and notes if needed. Use Save to close the booking as completed.",
        },
      ],
      notes: [],
    },
    "change-a-placement-test": {
      title: "Change or cancel a placement",
      summary: "Reschedule a booking or cancel it with a reason.",
      steps: [
        {
          title: "Open the row menu",
          body: "Open the row menu on an Upcoming placement test.",
        },
        {
          title: "Change or cancel",
          body: "Choose Change to pick a new time or room, then use Save changes. Or choose Cancel booking and pick a reason.",
        },
      ],
      notes: [],
    },
    "schedule-a-trial-lesson": {
      title: "Schedule a trial lesson",
      summary: "Book a trial lesson for a lead or student.",
      steps: [
        {
          title: "Start from the person",
          body: "Trial lessons has no create button. Use Book trial lesson on the lead's Next step card or the student's Placement and trials tab.",
        },
        {
          title: "Pick topic, time, and room",
          body: "Under Lesson topic, choose a course or an area of study. Pick the date, start time, and room or meeting link, then use Book.",
        },
        {
          title: "Wait for the result",
          body: "The trial stays under Upcoming until you record its result. A placement test can run first or be skipped.",
        },
      ],
      notes: [
        "A trial needs a course or an area of study. Onsite branches also need a room.",
      ],
    },
    "schedule-review-trial": {
      title: "Schedule a trial request",
      summary: "Book a trial lesson request into a real slot.",
      steps: [
        {
          title: "Open To review",
          body: "On Trial lessons, open the To review tab.",
        },
        {
          title: "Schedule it",
          body: "Use Schedule on the row, choose the topic, date, and room, and use Schedule.",
        },
      ],
      notes: [],
    },
    "record-a-trial-result": {
      title: "Record a trial result",
      summary: "Enter the trial outcome and the course it recommends.",
      steps: [
        {
          title: "Open the trial",
          body: "Find the trial under Upcoming on Trial lessons, or on the lead page, and use Record result.",
        },
        {
          title: "Record the outcome",
          body: "Enter the score or level, the recommended course, and notes, then use Save.",
        },
        {
          title: "Check the recommendation",
          body: "The student page shows a Recommended next panel with Enrol. On a lead, the Next step card names the recommended course.",
        },
      ],
      notes: [
        "In Sell a course, the recommended course is tagged Recommended.",
      ],
    },
    "work-the-review-queue": {
      title: "Work the review queue",
      summary: "Clear the To review tabs so requests become real bookings.",
      steps: [
        {
          title: "See the queue",
          body: "On the dashboard, Needs attention shows Booking requests to review. It links to the To review tab.",
        },
        {
          title: "Schedule or cancel",
          body: "Use Schedule on a row, or open its row menu and choose Cancel booking with a reason.",
        },
        {
          title: "Keep it clear",
          body: "Scheduled requests move to Upcoming, and the count drops as you clear it.",
        },
      ],
      notes: [
        "Requests arrive from Jotform forms set to Lead + placement test or Lead + trial lesson.",
      ],
    },
    "add-a-student": {
      title: "Add a student",
      summary: "Create a student directly when no lead journey is needed.",
      steps: [
        {
          title: "Open Students",
          body: "Open Students under Admissions and use Add student.",
        },
        {
          title: "Fill identity and guardians",
          body: "Enter the name, email, registration fee, identity details, and guardians. Super Admin also picks the home branch.",
        },
        {
          title: "Enrol them",
          body: "Use Create student. The student page opens, and Sell a course is on its Courses tab.",
        },
      ],
      notes: [
        "Egyptian nationals need a national ID. Students under 18 need at least one guardian.",
      ],
    },
    "assign-an-ssa": {
      title: "Assign an SSA to a student",
      summary: "Pick the SSA who owns the student's record.",
      steps: [
        {
          title: "Open the student",
          body: "Open the student and use Edit.",
        },
        {
          title: "Pick the SSA",
          body: "Choose the SSA in the Owner field, or No owner to clear it. Then use Save changes.",
        },
      ],
      notes: [
        "Only Super Admin, Branch Admin, and Vice Manager can change the owner. Registrar can read students but not edit them.",
      ],
    },
    "read-student-progress": {
      title: "Read a student's progress",
      summary: "Use the Learning and Report tabs on the student page.",
      steps: [
        {
          title: "Open the student",
          body: "Open the student and go to the Learning tab.",
        },
        {
          title: "Check Moodle learning",
          body: "Each class shows its course grade and completion from Moodle.",
        },
        {
          title: "Read the Report tab",
          body: "The Report tab shows the academic report. Use Print report to print it or save it as a file.",
        },
      ],
      notes: [],
    },
    "add-a-document": {
      title: "Add a document to a student",
      summary:
        "Upload passports, national IDs, and attachments on the student page.",
      steps: [
        {
          title: "Open Documents",
          body: "On the student's Overview tab, the Documents section lists existing files.",
        },
        {
          title: "Upload",
          body: "Use Upload, pick the purpose and the file, and use Upload again.",
        },
        {
          title: "Download or archive",
          body: "Each row's menu offers Download and, for staff who can edit the student, Archive.",
        },
      ],
      notes: [
        "Uploads pause with a message while file storage is not connected. Existing documents still show.",
        "Registrar can view and download documents but cannot upload or archive them.",
      ],
    },
    "disable-a-student": {
      title: "Disable a student",
      summary: "Turn a student off, keeping their history.",
      steps: [
        {
          title: "Open the student",
          body: "Open the student, use More actions, and choose Disable student.",
        },
        {
          title: "Confirm with a reason",
          body: "Pick a reason and confirm. The student can no longer get new enrolments.",
        },
        {
          title: "Enable again later",
          body: "Staff who can still view disabled students can use Enable student in the same menu to turn them back on.",
        },
      ],
      notes: [
        "Disabled students keep their history. Registrar and SSA no longer see them once disabled.",
        "Only Super Admin, Branch Admin, Vice Manager, and the student's own SSA see More actions.",
      ],
    },
    "sell-a-course": {
      title: "Sell a course",
      summary: "Open a course sale with its fee for a student.",
      steps: [
        {
          title: "Open Enrolments or the student",
          body: "Use Sell a course on the student's Courses tab, or on Enrolments, where you search for the student first.",
        },
        {
          title: "Pick the course and fee",
          body: "Choose the course, the class type, the total, and what is paid now.",
        },
        {
          title: "Choose a class",
          body: "Pick a class or Choose a class later. Then use Sell a course, or Sell and add to class.",
        },
      ],
      notes: [
        "The student joins a class only once the course is fully paid and they have a Moodle account. Until then the sale waits in Enrolments.",
      ],
    },
    "record-a-payment": {
      title: "Record a payment",
      summary: "Update what was paid on a course sale.",
      steps: [
        {
          title: "Find the sale",
          body: "Find the sale under Waiting on Enrolments, or on the student's Courses tab.",
        },
        {
          title: "Record the amount",
          body: "Use Record payment, update the total or what was paid, and use Save. The balance updates.",
        },
      ],
      notes: [],
    },
    "place-in-a-class": {
      title: "Place a student in a class",
      summary: "Move a paid sale from Enrolments into a class.",
      steps: [
        {
          title: "Find the sale",
          body: "On Enrolments under Waiting, or the student's Courses tab, use Add to class on a paid sale.",
        },
        {
          title: "Pick the class",
          body: "Active classes for that course in the branch show with their seats left. Full classes take no more students.",
        },
        {
          title: "Confirm",
          body: "Use Add to class. The student joins the class.",
        },
      ],
      notes: [
        "Add to class shows only once the sale is fully paid.",
        "The student needs a Moodle account before joining a class.",
      ],
    },
    "mark-left-or-cancel": {
      title: "Mark a sale left or cancelled",
      summary: "Close a course sale with a reason when it ends early.",
      steps: [
        {
          title: "Open the row menu",
          body: "Open the sale's row menu on the student's Courses tab or on Enrolments.",
        },
        {
          title: "Pick left or cancelled",
          body: "Choose Mark as left or Cancel sale, pick a reason, and confirm.",
        },
        {
          title: "Check the state",
          body: "The sale moves to the Left or Cancelled tab on Enrolments and stays on the student's record.",
        },
      ],
      notes: [
        "Mark as left is only for next-level sales. Cancel sale is only for sales still waiting and cannot be undone.",
      ],
    },
    "complete-a-level": {
      title: "Complete a level",
      summary: "Mark an enrolment completed when the course finishes.",
      steps: [
        {
          title: "Open the row menu",
          body: "Open the row menu of an Enrolled sale on the student's Courses tab or on Enrolments.",
        },
        {
          title: "Complete it",
          body: "Choose Mark completed and confirm. The sale moves to Completed.",
        },
      ],
      notes: [
        "Use Mark completed when the student finished the course. Mark as left is for a next level they will not take.",
      ],
    },
    "create-a-class": {
      title: "Create a class",
      summary: "Make a class for a course with teachers, seats, and dates.",
      steps: [
        {
          title: "Open Classes",
          body: "Open Classes under Teaching and use Add class.",
        },
        {
          title: "Fill the details",
          body: "Choose the course, class type, seats, start and end dates, and teachers. Super Admin also picks the branch.",
        },
        {
          title: "Set the usual time",
          body: "Pick the usual days and times, add a meeting link for online classes, and use Create class.",
        },
      ],
      notes: [],
    },
    "bind-moodle-group": {
      title: "Link a class to a Moodle group",
      summary:
        "Link the class to a Moodle group for synced attendance and grades.",
      steps: [
        {
          title: "Open the class",
          body: "Open the class, use More actions, and choose Create Moodle group.",
        },
        {
          title: "Create or link the group",
          body: "Choose Create Moodle group, or Link Moodle group and search for it, then confirm. Use Sync with Moodle to sync it.",
        },
      ],
      notes: [],
    },
    "propose-sessions": {
      title: "Plan and book sessions",
      summary:
        "Find session times from teacher and room availability, then book them.",
      steps: [
        {
          title: "Open the class sessions",
          body: "Open the class. It opens on the Sessions tab, where you use Plan sessions.",
        },
        {
          title: "Find times",
          body: "Add each day with its hours, set the From and To dates, and use Find times.",
        },
        {
          title: "Book",
          body: "Check the proposed times and use Book these sessions.",
        },
      ],
      notes: [
        "Times are proposed only when the teacher and a room are both free.",
      ],
    },
    "change-a-session": {
      title: "Change or cancel a session",
      summary: "Move or cancel a scheduled session.",
      steps: [
        {
          title: "Find the session",
          body: "On the class Sessions tab, find the session under Upcoming.",
        },
        {
          title: "Change or cancel",
          body: "Use Change time to pick a new date, start time, and length, or Cancel session. Past sessions cannot be changed.",
        },
      ],
      notes: [],
    },
    "mark-attendance": {
      title: "Mark attendance",
      summary: "Take attendance on a session once it happens.",
      steps: [
        {
          title: "Open the session",
          body: "Open the class Attendance tab. Teachers can also use My week.",
        },
        {
          title: "Take attendance",
          body: "Use Take attendance, mark each student or use Mark all present, and use Save attendance.",
        },
      ],
      notes: [
        "Attendance is saved in Moodle. The course needs its Moodle attendance activity set first.",
      ],
    },
    "read-roster-and-grades": {
      title: "Read a class roster and grades",
      summary: "See who is in a class and how their grades stand.",
      steps: [
        {
          title: "Open the class",
          body: "Open the class Students tab for the student list.",
        },
        {
          title: "Check grades",
          body: "The Grades tab shows each student's course grade from Moodle.",
        },
      ],
      notes: [],
    },
    "plan-my-week": {
      title: "Plan my week",
      summary: "Use My week to see every session you teach, day by day.",
      steps: [
        {
          title: "Open My week",
          body: "Open My week under Teaching in the sidebar.",
        },
        {
          title: "Scan the days",
          body: "Sessions are grouped by day with their time, class, and room. Days without sessions show Free.",
        },
        {
          title: "Move between weeks",
          body: "Use the Previous week and Next week arrows, or This week to come back.",
        },
      ],
      notes: [],
    },
    "add-a-room": {
      title: "Add a room",
      summary: "Create a room so it can hold onsite bookings and classes.",
      steps: [
        {
          title: "Open Rooms",
          body: "Open Rooms under Teaching and use Add room.",
        },
        {
          title: "Fill the details",
          body: "Enter the room name and seats, then use Create room. Super Admin also picks the branch.",
        },
        {
          title: "Set its hours",
          body: "Open the room and paint its Availability grid. Super Admin, Branch Admin, Vice Manager, and SSA can paint it.",
        },
      ],
      notes: [],
    },
    "set-room-availability": {
      title: "Set room availability",
      summary: "Paint the hours a room can be booked.",
      steps: [
        {
          title: "Open the room",
          body: "Open the room. The Availability grid shows one week; use Previous week, Today, and Next week to move.",
        },
        {
          title: "Paint the hours",
          body: "Pick Available, Unavailable, or Clear, and paint the hour cells. Booked hours stay locked.",
        },
        {
          title: "Save",
          body: "Use Save changes. Session planning uses the saved hours.",
        },
      ],
      notes: ["Sessions can only be planned into hours the room is available."],
    },
    "build-a-form": {
      title: "Build a form",
      summary: "Create a Nile Form with the questions you need.",
      steps: [
        {
          title: "Open Forms",
          body: "Open Forms under Home and use New form.",
        },
        {
          title: "Create the form",
          body: "Enter the English and Arabic titles, category, and branch, pick a template under Start from, and use Create form.",
        },
        {
          title: "Build and save",
          body: "On the Build tab, use Add a question, then Save draft. Nothing is public until you publish.",
        },
      ],
      notes: [],
    },
    "publish-a-form": {
      title: "Publish a form",
      summary: "Give the form a link or assign it to people.",
      steps: [
        {
          title: "Open the Share tab",
          body: "Open the form, go to the Share tab, and use Publish.",
        },
        {
          title: "Set the link and audience",
          body: "Enter the link name and choose who can answer: anyone with the link, any signed-in staff, or only people you assign. Then use Publish.",
        },
        {
          title: "Assign people",
          body: "On a link, use Assign and pick a role, branch, department, or people. People can be a staff member or a class's teachers.",
        },
      ],
      notes: [
        "Assigned people find the form on the To fill tab of their Forms page.",
      ],
    },
    "review-a-response": {
      title: "Review a response",
      summary: "Read what a respondent sent and record a decision.",
      steps: [
        {
          title: "Open Responses",
          body: "Open the form's Responses tab, or the Responses tab on Forms.",
        },
        {
          title: "Read and decide",
          body: "Open a response to read its answers. Use Accept, Mark in review, or Reject, with an optional note.",
        },
      ],
      notes: [],
    },
    "create-a-lead-from-a-response": {
      title: "Create a lead from a response",
      summary: "Turn a form answer into a lead.",
      steps: [
        {
          title: "Open the response",
          body: "Open a response from an admissions form.",
        },
        {
          title: "Use Create lead",
          body: "Use Create lead. The Add lead form opens with the name, email, phone, and answers filled in.",
        },
        {
          title: "Save the lead",
          body: "Check the details and use Create lead. The response is accepted and shows Open lead.",
        },
      ],
      notes: [
        "Create lead shows only on admissions forms, for admissions staff, and not on rejected responses.",
      ],
    },
    "import-from-jotform": {
      title: "Import Jotform responses",
      summary: "Bring past Jotform responses into a live Nile Form.",
      steps: [
        {
          title: "Open the importer",
          body: "On Forms, use Import from Jotform. Only Super Admin sees it.",
        },
        {
          title: "Match and import",
          body: "Choose the Jotform form and the live form to import into, and match the questions. Use Check rows, then Import ready rows.",
        },
      ],
      notes: [],
    },
    "read-reports": {
      title: "Read the reports",
      summary:
        "Open Reports for admissions, bookings, enrolments, and classes numbers.",
      steps: [
        {
          title: "Open Reports",
          body: "Open Reports under Home and pick Admissions, Bookings, Enrolments, or Classes. Your role decides which ones show.",
        },
        {
          title: "Set the window",
          body: "Pick a period. Super Admin can also pick a branch. Classes always shows as of today.",
        },
        {
          title: "Read the breakdowns",
          body: "Tiles, tables, and charts break the totals down by stage, status, or owner.",
        },
      ],
      notes: [
        "A report link your role cannot open shows your first allowed report instead.",
      ],
    },
    "export-a-report": {
      title: "Export a report",
      summary: "Download the current report's rows as CSV.",
      steps: [
        {
          title: "Set the report",
          body: "Choose the report, period, and branch you want to export.",
        },
        {
          title: "Export CSV",
          body: "Use Export CSV at the top of the page. The file keeps Arabic names readable in Excel.",
        },
      ],
      notes: [
        "The CSV uses the same report, period, and branch as the screen.",
      ],
    },
  },
};
