import type {
  FormAssignment,
  FormDefinition,
  FormField,
  FormLogicRule,
  FormPublication,
  FormVersion,
  FormVersionContent,
  LocalizedText,
  NileFormsState,
} from "./nileForms.js";

const seededAt = "2026-07-11T12:00:00.000Z";

function text(en: string, ar: string): LocalizedText {
  return { en, ar };
}

function field(
  id: string,
  type: FormField["type"],
  en: string,
  ar: string,
  input: Partial<FormField> = {}
): FormField {
  return { id, type, label: text(en, ar), dataClass: "standard", ...input };
}

function content(
  titleEn: string,
  titleAr: string,
  descriptionEn: string,
  descriptionAr: string,
  pages: FormVersionContent["pages"],
  logic: FormLogicRule[] = []
): FormVersionContent {
  return {
    title: text(titleEn, titleAr),
    description: text(descriptionEn, descriptionAr),
    defaultLanguage: "en",
    languages: ["en", "ar"],
    submitLabel: text("Submit", "إرسال"),
    confirmationMessage: text(
      "Your response has been received.",
      "تم استلام ردك."
    ),
    pages,
    logic,
  };
}

const templateContent: Record<string, FormVersionContent> = {
  enquiry: content(
    "Free trial enquiry",
    "طلب حصة تجريبية",
    "Tell the admissions team how to contact you and what you want to study.",
    "أخبر فريق القبول بكيفية التواصل معك وما الذي ترغب في دراسته.",
    [
      {
        id: "contact",
        title: text("Contact and course", "التواصل والدورة"),
        fields: [
          field("full_name", "short_text", "Full name", "الاسم الكامل", {
            required: true,
            searchable: true,
            validation: { minLength: 2, maxLength: 120 },
          }),
          field("email", "email", "Email", "البريد الإلكتروني", {
            required: true,
            searchable: true,
            validation: { maxLength: 180 },
          }),
          field("phone", "phone", "Phone", "رقم الهاتف", {
            required: true,
            searchable: true,
          }),
          field(
            "preferred_branch",
            "entity_reference",
            "Preferred branch",
            "الفرع المفضل",
            {
              required: true,
              entityType: "branch",
              searchable: true,
              reportable: true,
            }
          ),
          field(
            "course_interest",
            "single_choice",
            "Course interest",
            "الدورة المطلوبة",
            {
              required: true,
              searchable: true,
              reportable: true,
              options: [
                { id: "arabic", label: text("Arabic", "اللغة العربية") },
                { id: "quran", label: text("Quran", "القرآن الكريم") },
                {
                  id: "islamic_studies",
                  label: text("Islamic studies", "الدراسات الإسلامية"),
                },
                { id: "english", label: text("English", "اللغة الإنجليزية") },
              ],
            }
          ),
          field(
            "preferred_contact",
            "single_choice",
            "Preferred contact",
            "وسيلة التواصل المفضلة",
            {
              required: true,
              options: [
                { id: "email", label: text("Email", "البريد الإلكتروني") },
                { id: "phone", label: text("Phone", "الهاتف") },
                { id: "whatsapp", label: text("WhatsApp", "واتساب") },
              ],
            }
          ),
          field("notes", "long_text", "Anything else?", "ملاحظات إضافية", {
            validation: { maxLength: 1_500 },
          }),
        ],
      },
    ]
  ),
  application: content(
    "Course application",
    "طلب الالتحاق بدورة",
    "Provide the information the registrar needs to review your application.",
    "قدّم المعلومات التي يحتاجها مسؤول التسجيل لمراجعة طلبك.",
    [
      {
        id: "applicant",
        title: text("Applicant", "بيانات المتقدم"),
        fields: [
          field("full_name", "short_text", "Full name", "الاسم الكامل", {
            required: true,
            searchable: true,
            validation: { minLength: 2, maxLength: 120 },
          }),
          field("email", "email", "Email", "البريد الإلكتروني", {
            required: true,
            searchable: true,
          }),
          field("phone", "phone", "Phone", "رقم الهاتف", {
            required: true,
            searchable: true,
          }),
          field("date_of_birth", "date", "Date of birth", "تاريخ الميلاد", {
            required: true,
          }),
          field(
            "preferred_branch",
            "entity_reference",
            "Preferred branch",
            "الفرع المفضل",
            {
              required: true,
              entityType: "branch",
              searchable: true,
              reportable: true,
            }
          ),
        ],
      },
      {
        id: "study",
        title: text("Study goals", "أهداف الدراسة"),
        fields: [
          field("course_interest", "single_choice", "Course", "الدورة", {
            required: true,
            reportable: true,
            options: [
              { id: "arabic", label: text("Arabic", "اللغة العربية") },
              { id: "quran", label: text("Quran", "القرآن الكريم") },
              {
                id: "teacher_training",
                label: text("Teacher training", "تدريب المعلمين"),
              },
            ],
          }),
          field(
            "schedule_preference",
            "short_text",
            "Schedule preference",
            "الوقت المفضل للدراسة",
            {
              required: true,
              validation: { minLength: 3, maxLength: 160 },
            }
          ),
          field(
            "current_level",
            "single_choice",
            "Current level",
            "المستوى الحالي",
            {
              required: true,
              reportable: true,
              options: [
                { id: "beginner", label: text("Beginner", "مبتدئ") },
                { id: "intermediate", label: text("Intermediate", "متوسط") },
                { id: "advanced", label: text("Advanced", "متقدم") },
                { id: "unknown", label: text("Not sure", "غير متأكد") },
              ],
            }
          ),
          field("goals", "long_text", "Learning goals", "أهداف التعلم", {
            required: true,
            validation: { minLength: 20, maxLength: 2_000 },
          }),
          field(
            "consent",
            "consent",
            "I confirm this information is accurate",
            "أؤكد أن هذه المعلومات صحيحة",
            {
              required: true,
            }
          ),
        ],
      },
    ]
  ),
  placement: content(
    "Placement request",
    "طلب اختبار تحديد المستوى",
    "Request a placement appointment before enrollment.",
    "اطلب موعدًا لاختبار تحديد المستوى قبل التسجيل.",
    [
      {
        id: "request",
        title: text("Placement details", "تفاصيل تحديد المستوى"),
        fields: [
          field("full_name", "short_text", "Full name", "الاسم الكامل", {
            required: true,
            searchable: true,
          }),
          field("email", "email", "Email", "البريد الإلكتروني", {
            required: true,
            searchable: true,
          }),
          field("phone", "phone", "Phone", "رقم الهاتف", {
            required: true,
            searchable: true,
          }),
          field(
            "preferred_branch",
            "entity_reference",
            "Preferred branch",
            "الفرع المفضل",
            {
              required: true,
              entityType: "branch",
              searchable: true,
              reportable: true,
            }
          ),
          field("course_interest", "single_choice", "Course", "الدورة", {
            required: true,
            reportable: true,
            options: [
              { id: "arabic", label: text("Arabic", "اللغة العربية") },
              { id: "quran", label: text("Quran", "القرآن الكريم") },
              { id: "english", label: text("English", "اللغة الإنجليزية") },
            ],
          }),
          field("preferred_date", "date", "Preferred date", "التاريخ المفضل", {
            required: true,
          }),
          field("preferred_time", "time", "Preferred time", "الوقت المفضل", {
            required: true,
          }),
          field(
            "current_level",
            "single_choice",
            "Current level",
            "المستوى الحالي",
            {
              required: true,
              options: [
                { id: "beginner", label: text("Beginner", "مبتدئ") },
                { id: "intermediate", label: text("Intermediate", "متوسط") },
                { id: "advanced", label: text("Advanced", "متقدم") },
                { id: "unknown", label: text("Not sure", "غير متأكد") },
              ],
            }
          ),
          field("online", "yes_no", "Online appointment", "موعد عبر الإنترنت", {
            required: true,
            reportable: true,
          }),
        ],
      },
    ]
  ),
  support: content(
    "Student support request",
    "طلب دعم للطالب",
    "Send one support request to the correct Nile Learn team.",
    "أرسل طلب دعم واحد إلى الفريق المختص في نايل ليرن.",
    [
      {
        id: "support",
        title: text("Request", "الطلب"),
        fields: [
          field("category", "single_choice", "Category", "الفئة", {
            required: true,
            searchable: true,
            reportable: true,
            options: [
              {
                id: "course",
                label: text("Course access", "الوصول إلى الدورة"),
              },
              { id: "schedule", label: text("Schedule", "الجدول") },
              { id: "technical", label: text("Technical", "تقني") },
              { id: "other", label: text("Other", "أخرى") },
            ],
          }),
          field("subject", "short_text", "Subject", "الموضوع", {
            required: true,
            validation: { minLength: 4, maxLength: 160 },
          }),
          field("details", "long_text", "Details", "التفاصيل", {
            required: true,
            validation: { minLength: 20, maxLength: 3_000 },
          }),
          field(
            "urgent",
            "yes_no",
            "Is this blocking your next class?",
            "هل يمنعك هذا من حضور الحصة القادمة؟",
            {
              required: true,
              reportable: true,
            }
          ),
        ],
      },
    ]
  ),
  attendance_exception: content(
    "Attendance exception request",
    "طلب استثناء للحضور",
    "Ask for review of one absent or late attendance record.",
    "اطلب مراجعة سجل غياب أو تأخر واحد.",
    [
      {
        id: "exception",
        title: text("Attendance record", "سجل الحضور"),
        fields: [
          field(
            "attendance_record",
            "entity_reference",
            "Attendance record",
            "سجل الحضور",
            {
              required: true,
              entityType: "attendance_record",
              searchable: true,
            }
          ),
          field("reason", "long_text", "Reason", "السبب", {
            required: true,
            validation: { minLength: 20, maxLength: 2_000 },
          }),
          field(
            "confirmation",
            "consent",
            "I confirm this request is accurate",
            "أؤكد أن هذا الطلب صحيح",
            {
              required: true,
            }
          ),
        ],
      },
    ]
  ),
  consent: content(
    "Learning consent acknowledgment",
    "إقرار الموافقة على التعلم",
    "Read and acknowledge the current consent text.",
    "اقرأ نص الموافقة الحالي وأقر به.",
    [
      {
        id: "consent",
        title: text("Acknowledgment", "الإقرار"),
        fields: [
          field(
            "consent_text",
            "instructions",
            "Consent terms",
            "شروط الموافقة",
            {
              description: text(
                "I understand the learning, attendance, and communication expectations for this course.",
                "أفهم متطلبات التعلم والحضور والتواصل الخاصة بهذه الدورة."
              ),
            }
          ),
          field(
            "accepted",
            "consent",
            "I agree to the consent text above",
            "أوافق على نص الموافقة أعلاه",
            {
              required: true,
            }
          ),
          field(
            "typed_name",
            "short_text",
            "Type your full name",
            "اكتب اسمك الكامل",
            {
              required: true,
              validation: { minLength: 2, maxLength: 120 },
            }
          ),
        ],
      },
    ]
  ),
  incident: content(
    "Branch incident or maintenance request",
    "بلاغ حادث أو صيانة في الفرع",
    "Record one branch issue for scoped operational review.",
    "سجّل مشكلة واحدة في الفرع للمراجعة التشغيلية.",
    [
      {
        id: "incident",
        title: text("Issue", "المشكلة"),
        fields: [
          field("location", "short_text", "Location", "الموقع", {
            required: true,
            searchable: true,
            validation: { maxLength: 160 },
          }),
          field("issue_type", "single_choice", "Issue type", "نوع المشكلة", {
            required: true,
            reportable: true,
            options: [
              { id: "maintenance", label: text("Maintenance", "صيانة") },
              { id: "safety", label: text("Safety", "سلامة") },
              { id: "equipment", label: text("Equipment", "معدات") },
              { id: "other", label: text("Other", "أخرى") },
            ],
          }),
          field("severity", "rating", "Severity", "درجة الخطورة", {
            required: true,
            reportable: true,
            validation: { min: 1, max: 5 },
          }),
          field("details", "long_text", "What happened?", "ماذا حدث؟", {
            required: true,
            validation: { minLength: 20, maxLength: 3_000 },
          }),
        ],
      },
    ]
  ),
};

const definitionSeed: Array<
  Omit<
    FormDefinition,
    "createdAt" | "updatedAt" | "currentPublishedVersionId"
  > & {
    audience: FormPublication["audience"];
    slug: string;
    offlineEligible: boolean;
  }
> = [
  {
    id: "form_enquiry",
    key: "public_enquiry",
    title: "Free trial enquiry",
    category: "admissions",
    ownerUserId: "usr_admin_demo",
    ownerRole: "superadmin",
    status: "active",
    audience: "public",
    slug: "free-trial-enquiry",
    offlineEligible: false,
  },
  {
    id: "form_application",
    key: "application_intake",
    title: "Course application",
    category: "admissions",
    ownerUserId: "usr_admin_demo",
    ownerRole: "superadmin",
    status: "active",
    audience: "public",
    slug: "course-application",
    offlineEligible: false,
  },
  {
    id: "form_placement",
    key: "placement_request",
    title: "Placement request",
    category: "admissions",
    ownerUserId: "usr_admin_demo",
    ownerRole: "superadmin",
    status: "active",
    audience: "public",
    slug: "placement-request",
    offlineEligible: false,
  },
  {
    id: "form_support",
    key: "student_support",
    title: "Student support request",
    category: "student_support",
    ownerUserId: "usr_admin_demo",
    ownerRole: "superadmin",
    status: "active",
    audience: "assigned",
    slug: "student-support-request",
    offlineEligible: false,
  },
  {
    id: "form_attendance_exception",
    key: "attendance_exception",
    title: "Attendance exception request",
    category: "attendance",
    ownerUserId: "usr_admin_demo",
    ownerRole: "superadmin",
    status: "active",
    audience: "assigned",
    slug: "attendance-exception-request",
    offlineEligible: false,
  },
  {
    id: "form_consent",
    key: "learning_consent",
    title: "Learning consent acknowledgment",
    category: "consent",
    ownerUserId: "usr_hod_demo",
    ownerRole: "headofdepartment",
    departmentId: "dep_arabic",
    status: "active",
    audience: "assigned",
    slug: "learning-consent",
    offlineEligible: true,
  },
  {
    id: "form_incident",
    key: "branch_incident",
    title: "Branch incident or maintenance request",
    category: "branch_operations",
    ownerUserId: "usr_branch_demo",
    ownerRole: "branchadmin",
    branchId: "br_cairo",
    status: "active",
    audience: "assigned",
    slug: "branch-incident",
    offlineEligible: true,
  },
];

export function createNileFormsSeedState(): NileFormsState {
  const definitions: FormDefinition[] = definitionSeed.map(item => ({
    id: item.id,
    key: item.key,
    title: item.title,
    category: item.category,
    ownerUserId: item.ownerUserId,
    ownerRole: item.ownerRole,
    branchId: item.branchId,
    departmentId: item.departmentId,
    status: item.status,
    currentPublishedVersionId: `version_${item.id}_1`,
    createdAt: seededAt,
    updatedAt: seededAt,
  }));
  const versions: FormVersion[] = definitionSeed.map(item => ({
    id: `version_${item.id}_1`,
    definitionId: item.id,
    versionNumber: 1,
    status: "published",
    revision: 1,
    content: templateContent[item.id.replace(/^form_/, "")],
    contentHash: `fixture:${item.id}:1`,
    authoredBy: item.ownerUserId,
    publishedBy: item.ownerUserId,
    publishedAt: seededAt,
    createdAt: seededAt,
    updatedAt: seededAt,
  }));
  const publications: FormPublication[] = definitionSeed.map(item => ({
    id: `publication_${item.id}_1`,
    definitionId: item.id,
    versionId: `version_${item.id}_1`,
    slug: item.slug,
    audience: item.audience,
    status: "open",
    allowMultiple:
      item.id === "form_support" ||
      item.id === "form_attendance_exception" ||
      item.id === "form_incident",
    allowDrafts: true,
    offlineEligible: item.offlineEligible,
    createdBy: item.ownerUserId,
    createdAt: seededAt,
  }));
  const assignmentRows: Array<
    Pick<FormAssignment, "publicationId" | "target">
  > = [
    {
      publicationId: "publication_form_support_1",
      target: { type: "role", role: "student" },
    },
    {
      publicationId: "publication_form_attendance_exception_1",
      target: { type: "role", role: "student" },
    },
    {
      publicationId: "publication_form_consent_1",
      target: { type: "department", departmentId: "dep_arabic" },
    },
    {
      publicationId: "publication_form_incident_1",
      target: { type: "branch", branchId: "br_cairo" },
    },
  ];
  const assignments: FormAssignment[] = assignmentRows.map((item, index) => ({
    id: `assignment_fixture_${index + 1}`,
    publicationId: item.publicationId,
    target: item.target,
    assignedBy: "usr_admin_demo",
    assignedAt: seededAt,
  }));

  return {
    definitions,
    versions,
    publications,
    assignments,
    drafts: [],
    submissions: [],
    reviews: [],
    promotions: [],
    auditEvents: [],
    outboxEvents: [],
    offlineDevices: [],
    syncReceipts: [],
    legacyImportRuns: [],
    legacyImportRecords: [],
  };
}

export const nileFormsTemplateContent = templateContent;
