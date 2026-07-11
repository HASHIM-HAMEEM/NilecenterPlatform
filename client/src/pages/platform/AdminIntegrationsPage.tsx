import { useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
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

export default function AdminIntegrationsPage() {
  const [version, setVersion] = useState(0);
  const [selectedIntegrationId, setSelectedIntegrationId] =
    useState<IntegrationConfig["id"]>("moodle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [integrationCheck, setIntegrationCheck] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const integrations = state.integrations;
  const selectedIntegration =
    integrations.find(
      integration => integration.id === selectedIntegrationId
    ) ?? integrations[0];
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
      setIntegrationCheck(
        `Reviewed ${checkedAt ? new Date(checkedAt).toLocaleString() : new Date().toLocaleString()}`
      );
    });
  };

  return (
    <PlatformShell role="superadmin" title="Connections">
      <SettingsLayout
        className="admin-integrations-page"
        title="Connections"
        description="Review setup readiness without exposing protected connection details."
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
        main={
          <DataTableCard
            title="Connections"
            subtitle={`${integrations.length} services`}
          >
            <div
              className="admin-connection-list"
              data-testid="admin-connections-list"
            >
              {integrations.map(integration => (
                <button
                  key={integration.id}
                  type="button"
                  className={
                    integration.id === selectedIntegration?.id ? "active" : ""
                  }
                  onClick={() => setSelectedIntegrationId(integration.id)}
                >
                  <StatusBadge tone={integrationTone(integration.status)}>
                    {formatConnectionStatus(integration.status)}
                  </StatusBadge>
                  <div>
                    <strong>{integration.label}</strong>
                    <small>{integration.notes}</small>
                  </div>
                </button>
              ))}
            </div>

            {selectedIntegration ? (
              <section
                className="admin-connection-detail"
                data-testid="admin-connection-detail"
              >
                <div>
                  <span>Connection details</span>
                  <h3>{selectedIntegration.label}</h3>
                  <p>{selectedIntegration.notes}</p>
                </div>
                <div className="admin-connection-status">
                  <span>Setup status</span>
                  <StatusBadge tone={integrationTone(selectedIntegration.status)}>
                    {formatConnectionStatus(selectedIntegration.status)}
                  </StatusBadge>
                </div>
                <p className="admin-connection-boundary">
                  {selectedIntegration.serverOnly
                    ? "Protected connection details are managed outside this workspace."
                    : "No protected setup fields are required for this connection."}
                </p>
                <button
                  type="button"
                  className="platform-secondary-button"
                  onClick={recordIntegrationReview}
                  disabled={saving}
                >
                  Record review
                </button>
                {error ? (
                  <div className="platform-empty-state error">
                    <strong>Connection action was not saved</strong>
                    <span>{error}</span>
                  </div>
                ) : null}
                {integrationCheck ? (
                  <small className="admin-connection-meta">
                    {integrationCheck}
                  </small>
                ) : null}
                <small className="admin-connection-meta">
                  Connection state is reported by the approved server integration.
                </small>
              </section>
            ) : (
              <div className="platform-empty-state">
                <strong>No connections configured</strong>
                <span>Connection records will appear here.</span>
              </div>
            )}
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
