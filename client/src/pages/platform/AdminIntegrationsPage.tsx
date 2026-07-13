import { useMemo, useState } from "react";
import { ChevronRight, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { SettingsLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { IntegrationConfig, IntegrationStatus } from "@/lib/domain/types";

function formatConnectionStatus(status: IntegrationStatus) {
  if (status === "mock_mode") return "Test mode";
  if (status === "connected") return "Configured";
  if (status === "error") return "Needs review";
  return "Not configured";
}

function integrationTone(
  status: IntegrationStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "connected") return "green";
  if (status === "mock_mode") return "amber";
  if (status === "error") return "red";
  return "slate";
}

type ConnectionFilter = "all" | "configured" | "test" | "attention";

const connectionFilters: Array<{
  id: ConnectionFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "configured", label: "Configured" },
  { id: "test", label: "Test mode" },
  { id: "attention", label: "Needs review" },
];

function matchesConnectionFilter(
  status: IntegrationStatus,
  filter: ConnectionFilter
) {
  if (filter === "all") return true;
  if (filter === "configured") return status === "connected";
  if (filter === "test") return status === "mock_mode";
  return status === "error" || status === "not_configured";
}

export default function AdminIntegrationsPage() {
  const [version, setVersion] = useState(0);
  const [selectedIntegrationId, setSelectedIntegrationId] =
    useState<IntegrationConfig["id"]>("moodle");
  const [filter, setFilter] = useState<ConnectionFilter>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [integrationCheck, setIntegrationCheck] = useState<{
    integrationId: IntegrationConfig["id"];
    detail: string;
  } | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const integrations = state.integrations;
  const visibleIntegrations = integrations.filter(integration =>
    matchesConnectionFilter(integration.status, filter)
  );
  const selectedIntegration =
    visibleIntegrations.find(
      integration => integration.id === selectedIntegrationId
    ) ?? visibleIntegrations[0];
  const runIntegrationAction = async (
    action: {
      type: "integration.local_check";
      integrationId: IntegrationConfig["id"];
    },
    successMessage: string
  ) => {
    if (saving) return undefined;
    setSaving(true);
    setError("");
    setIntegrationCheck(null);
    const response = await runPlatformWorkflowActionRequest(action);
    setSaving(false);

    if (!response.ok || !response.data) {
      const message = response.error ?? "Connection action could not be saved.";
      setError(message);
      toast.error("Connection action failed", { description: message });
      return undefined;
    }

    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    toast.success(successMessage);
    return response.data.result.result;
  };

  const recordIntegrationReview = () => {
    if (!selectedIntegration) return;
    void runIntegrationAction(
      {
        type: "integration.local_check",
        integrationId: selectedIntegration.id,
      },
      "Connection review recorded"
    ).then(result => {
      const checkedAt = (result as { checkedAt?: string } | undefined)
        ?.checkedAt;
      setIntegrationCheck({
        integrationId: selectedIntegration.id,
        detail: `Reviewed ${checkedAt ? new Date(checkedAt).toLocaleString() : new Date().toLocaleString()}`,
      });
    });
  };

  return (
    <PlatformShell role="superadmin" title="Connections">
      <SettingsLayout
        className="admin-integrations-page"
        title="Connections"
        description="Review what is ready and what still needs setup."
        context="Admin"
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={recordIntegrationReview}
            disabled={saving || !selectedIntegration}
          >
            <RefreshCcw size={15} />
            {saving ? "Recording" : "Review setup"}
          </button>
        }
        toolbar={
          <div
            className="admin-system-filter-bar"
            data-testid="admin-connections-toolbar"
          >
            <span>Show</span>
            <div role="group" aria-label="Filter connections">
              {connectionFilters.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={filter === item.id ? "active" : ""}
                  aria-pressed={filter === item.id}
                  data-testid={`admin-connections-filter-${item.id}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        }
        main={
          <DataTableCard
            title="Connections"
            subtitle={`${visibleIntegrations.length} of ${integrations.length} services`}
            className="admin-connections-list-card"
          >
            <div
              className="admin-connection-list"
              data-testid="admin-connections-list"
            >
              {visibleIntegrations.map(integration => (
                <button
                  key={integration.id}
                  type="button"
                  className={
                    integration.id === selectedIntegration?.id ? "active" : ""
                  }
                  aria-pressed={integration.id === selectedIntegration?.id}
                  data-testid={`admin-connection-${integration.id}`}
                  onClick={() => {
                    setSelectedIntegrationId(integration.id);
                    setError("");
                  }}
                >
                  <div>
                    <strong>{integration.label}</strong>
                    <small>{integration.notes}</small>
                  </div>
                  <StatusBadge tone={integrationTone(integration.status)}>
                    {formatConnectionStatus(integration.status)}
                  </StatusBadge>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
              {!visibleIntegrations.length ? (
                <div className="platform-empty-state">
                  <strong>No connections in this view</strong>
                  <span>
                    Choose another filter to review the remaining services.
                  </span>
                </div>
              ) : null}
            </div>
          </DataTableCard>
        }
        side={
          selectedIntegration ? (
            <section
              className="admin-connection-inspector"
              data-testid="admin-connection-detail"
            >
              <div className="admin-connection-inspector-heading">
                <span>Selected connection</span>
                <h2>{selectedIntegration.label}</h2>
                <StatusBadge tone={integrationTone(selectedIntegration.status)}>
                  {formatConnectionStatus(selectedIntegration.status)}
                </StatusBadge>
              </div>
              <p>{selectedIntegration.notes}</p>
              <div className="admin-connection-inspector-boundary">
                <span>Setup boundary</span>
                <strong>
                  {selectedIntegration.serverOnly
                    ? "Protected setup"
                    : "No protected setup"}
                </strong>
                <small>
                  {selectedIntegration.serverOnly
                    ? "Credentials and provider settings are handled outside this workspace."
                    : "This connection does not require browser-visible setup fields."}
                </small>
              </div>
              <button
                type="button"
                className="platform-secondary-button"
                onClick={recordIntegrationReview}
                disabled={saving}
              >
                <RefreshCcw size={15} />
                {saving ? "Recording review" : "Record review"}
              </button>
              {error ? (
                <div className="admin-system-result error" role="alert">
                  <strong>Review was not saved</strong>
                  <span>{error}</span>
                </div>
              ) : null}
              {integrationCheck?.integrationId === selectedIntegration.id ? (
                <div className="admin-system-result success" role="status">
                  <strong>Review recorded</strong>
                  <span>{integrationCheck.detail}</span>
                </div>
              ) : null}
              <small className="admin-connection-meta">
                Status is reported by the approved server integration.
              </small>
            </section>
          ) : (
            <div className="platform-empty-state">
              <strong>No connection selected</strong>
              <span>Choose a service to review its readiness.</span>
            </div>
          )
        }
      />
    </PlatformShell>
  );
}
