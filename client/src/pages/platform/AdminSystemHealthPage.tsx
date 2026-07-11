import { useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { ReportLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { IntegrationStatus } from "@/lib/domain/types";

function formatConnectionStatus(status: IntegrationStatus) {
  if (status === "connected") return "Ready";
  return status === "mock_mode" ? "Test mode" : status.replace("_", " ");
}

function integrationTone(
  status: IntegrationStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "connected") return "green";
  if (status === "mock_mode") return "amber";
  if (status === "error") return "red";
  return "slate";
}

export default function AdminSystemHealthPage() {
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const integrations = state.integrations;
  const platformEntityTotal =
    state.users.length +
    state.courses.length +
    state.classGroups.length +
    state.enrollments.length +
    state.events.length +
    state.auditLogs.length;

  const healthChecks: Array<{
    id: string;
    label: string;
    detail: string;
    status: IntegrationStatus;
    metric: string;
  }> = [
    {
      id: "app",
      label: "Application shell",
      detail:
        "Role routing, responsive platform shell, and local state are available.",
      status: "connected",
      metric: "Ready",
    },
    {
      id: "data",
      label: "System data",
      detail: `${platformEntityTotal} records across users, courses, classes, enrollments, events, and activity logs.`,
      status: "connected",
      metric: `${platformEntityTotal} records`,
    },
    {
      id: "supabase",
      label: "Supabase boundary",
      detail:
        "Browser code uses publishable credentials only; privileged keys stay protected.",
      status:
        integrations.find(integration => integration.id === "supabase")
          ?.status ?? "not_configured",
      metric: "Auth boundary",
    },
    {
      id: "moodle",
      label: "Moodle",
      detail:
        "Course mapping and activity inspection remain in test/import mode.",
      status:
        integrations.find(integration => integration.id === "moodle")?.status ??
        "not_configured",
      metric: `${state.courses.length} courses`,
    },
    {
      id: "communications",
      label: "Communications",
      detail:
        "Email and WhatsApp remain log-first until delivery providers are connected.",
      status: integrations.some(
        integration =>
          ["email", "whatsapp"].includes(integration.id) &&
          integration.status === "connected"
      )
        ? "connected"
        : "mock_mode",
      metric: `${state.communicationLogs.length} logs`,
    },
  ];
  const healthScore = Math.round(
    (healthChecks.filter(
      check => check.status === "connected" || check.status === "mock_mode"
    ).length /
      healthChecks.length) *
      100
  );
  const runHealthChecks = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    const response = await runPlatformWorkflowActionRequest({
      type: "system.health_check",
      score: healthScore,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      const message = response.error ?? "System health check was not saved.";
      setError(message);
      toast.error("Health check failed", { description: message });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    toast.success("Health checked", {
      description: `System health check scored ${healthScore}%.`,
    });
  };

  return (
    <PlatformShell role="superadmin" title="System health">
      <ReportLayout
        className="admin-system-health-page"
        title="Health"
        description="Review application and connection readiness."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => void runHealthChecks()}
            disabled={saving}
          >
            <RefreshCcw size={15} />
            {saving ? "Checking" : "Run check"}
          </button>
        }
        main={
          <DataTableCard title="Readiness" subtitle={`${healthScore}% ready`}>
            {error ? (
              <div className="platform-empty-state error">
                <strong>Health check was not saved</strong>
                <span>{error}</span>
              </div>
            ) : null}
            <div
              className="admin-record-list admin-health-record-list"
              data-testid="admin-health-list"
            >
              {healthChecks.map(check => (
                <article key={check.id}>
                  <div className="admin-record-list-copy">
                    <span>Readiness check</span>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                  </div>
                  <dl className="admin-record-list-facts">
                    <div>
                      <dt>Summary</dt>
                      <dd>{check.metric}</dd>
                    </div>
                  </dl>
                  <div className="admin-record-list-meta">
                    <StatusBadge tone={integrationTone(check.status)}>
                      {formatConnectionStatus(check.status)}
                    </StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
