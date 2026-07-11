import PlatformShell from "@/components/platform/PlatformShell";
import {
  ReportLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import StudentRecordWorkspace, {
  type StudentRecordView,
} from "./StudentRecordWorkspace";

type StudentRecordPageId = StudentRecordView;

const pageCopy: Record<
  StudentRecordPageId,
  { title: string; description: string; context: string }
> = {
  grades: {
    title: "Grades",
    description: "Review scores and teacher feedback.",
    context: "Student",
  },
  attendance: {
    title: "Attendance",
    description: "Review saved attendance and request a teacher check.",
    context: "Student",
  },
  certificates: {
    title: "Certificates",
    description: "View issued and pending certificates.",
    context: "Student",
  },
  reports: {
    title: "Reports",
    description: "Export your learning progress.",
    context: "Student",
  },
  "quran-progress": {
    title: "Quran progress",
    description: "Submit recitations and review memorization progress.",
    context: "Student",
  },
};

export default function StudentRecordsPage({
  pageId,
}: {
  pageId: StudentRecordPageId;
}) {
  const copy = pageCopy[pageId];
  const Layout = pageId === "reports" ? ReportLayout : WorkspaceLayout;

  return (
    <PlatformShell role="student" title={copy.title}>
      <Layout
        className={`student-records-page student-records-${pageId}`}
        title={copy.title}
        description={copy.description}
        context={copy.context}
        main={<StudentRecordWorkspace view={pageId} />}
      />
    </PlatformShell>
  );
}
