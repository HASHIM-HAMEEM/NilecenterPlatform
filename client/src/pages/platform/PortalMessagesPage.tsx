import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, Send } from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { getStoredAuthSession } from "@/lib/auth/session";
import { getMessageRecipientScope } from "@/lib/domain/messageScope";
import { platformStore } from "@/lib/domain/store";
import type { User } from "@/lib/domain/types";
import { roleMeta, type Role } from "@/lib/platformData";

type PortalMessagesPageProps = {
  role: Role;
  mode?: "inbox" | "compose";
};

const fallbackUserIdByRole: Record<Role, string> = {
  student: "usr_student_demo",
  teacher: "usr_teacher_demo",
  registrar: "usr_registrar_demo",
  headofdepartment: "usr_hod_demo",
  branchadmin: "usr_branch_demo",
  superadmin: "usr_admin_demo",
};

const titleByRole: Record<Role, string> = {
  student: "Messages",
  teacher: "Messages",
  registrar: "Messages",
  headofdepartment: "Department messages",
  branchadmin: "Branch messages",
  superadmin: "Platform messages",
};

const descriptionByRole: Record<Role, string> = {
  student: "Send and read learning messages.",
  teacher: "Send class updates and read student messages.",
  registrar: "Send admissions follow-ups and read replies.",
  headofdepartment: "Send academic updates within your department.",
  branchadmin: "Send branch updates and read local messages.",
  superadmin: "Send platform updates and review message activity.",
};

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function userLabel(user?: User) {
  if (!user) return "Unknown";
  return `${user.name} · ${roleMeta[user.activeRole].label}`;
}

function messagesHref(role: Role) {
  if (role === "headofdepartment") return "/app/hod/messages";
  if (role === "branchadmin") return "/app/branch/messages";
  if (role === "superadmin") return "/app/admin/messages";
  return `/app/${role}/messages`;
}

export default function PortalMessagesPage({
  role,
  mode = "inbox",
}: PortalMessagesPageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const state = useMemo(() => platformStore.getState(), [version]);
  const session = getStoredAuthSession();
  const actor =
    state.users.find(
      user => user.id === session?.userId && user.activeRole === role
    ) ?? state.users.find(user => user.id === fallbackUserIdByRole[role]);
  const actorId = actor?.id ?? fallbackUserIdByRole[role];
  const inboxHref = messagesHref(role);

  const recipientScope = useMemo(
    () => getMessageRecipientScope(state, role, actorId),
    [actorId, role, state]
  );
  const recipients = state.users.filter(user =>
    recipientScope.sendableUserIds.has(user.id)
  );
  const selectedRecipientId = recipientId || recipients[0]?.id || "";
  const visibleMessageIds = new Set([
    actorId,
    ...Array.from(recipientScope.visibleUserIds),
  ]);
  const messages = state.messages
    .filter(
      message =>
        visibleMessageIds.has(message.fromUserId) ||
        visibleMessageIds.has(message.toUserId)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const filteredMessages = messages.filter(message => {
    const from = state.users.find(user => user.id === message.fromUserId);
    const to = state.users.find(user => user.id === message.toUserId);
    const text = [message.subject, message.body, from?.name, to?.name]
      .join(" ")
      .toLowerCase();
    return text.includes(query.toLowerCase());
  });

  useEffect(() => {
    if (!recipientId && recipients[0]?.id) {
      setRecipientId(recipients[0].id);
    }
  }, [recipientId, recipients]);

  const sendLabel =
    role === "branchadmin"
      ? "Send branch message"
      : role === "headofdepartment"
        ? "Send academic message"
        : "Send message";

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    if (!selectedRecipientId || !subject.trim() || !body.trim()) {
      setResult({
        tone: "error",
        text: "Recipient, subject, and message are required.",
      });
      return;
    }
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: selectedRecipientId,
      subject: subject.trim(),
      body: body.trim(),
      channel: "in_app",
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setResult({
        tone: "error",
        text: response.error ?? "Message could not be sent.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(current => current + 1);
    setSubject("");
    setBody("");
    setResult({ tone: "success", text: "Message sent." });
  };

  if (mode === "compose") {
    return (
      <PlatformShell role={role} title="New message">
        <FormFlowLayout
          className="portal-messages-page portal-message-compose-page"
          title="New message"
          description="Write one clear update for someone in your workspace."
          context={roleMeta[role].label}
          actions={
            result?.tone === "success" ? (
              <Link className="platform-primary-button" href={inboxHref}>
                View messages
              </Link>
            ) : (
              <>
                <Link className="platform-secondary-button" href={inboxHref}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  form="portal-message-compose-form"
                  className="platform-primary-button"
                  disabled={!recipients.length || saving}
                >
                  <Send size={15} />
                  {saving ? "Sending" : sendLabel}
                </button>
              </>
            )
          }
          main={
            <section
              className="portal-message-compose-surface"
              data-testid={`portal-message-compose-${role}`}
            >
              {result?.tone === "success" ? (
                <div className="portal-message-compose-success" role="status">
                  <MessageSquare size={20} />
                  <div>
                    <strong>Message sent</strong>
                    <span>{result.text}</span>
                  </div>
                </div>
              ) : (
                <form
                  id="portal-message-compose-form"
                  className="portal-message-compose-form"
                  onSubmit={sendMessage}
                >
                  <div className="portal-message-compose-flow-heading">
                    <span>Step 1 of 1</span>
                    <h2>Choose a recipient and write the update</h2>
                    <p>
                      Keep the subject short so the recipient can scan it quickly.
                    </p>
                  </div>
                  <label>
                    Recipient
                    <select
                      value={selectedRecipientId}
                      onChange={event => setRecipientId(event.target.value)}
                    >
                      {recipients.map(user => (
                        <option key={user.id} value={user.id}>
                          {userLabel(user)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Subject
                    <input
                      autoFocus
                      value={subject}
                      onChange={event => setSubject(event.target.value)}
                      placeholder={`${roleMeta[role].shortLabel} update`}
                    />
                  </label>
                  <label className="portal-message-compose-body">
                    Message
                    <textarea
                      value={body}
                      onChange={event => setBody(event.target.value)}
                      placeholder="Write a short update"
                    />
                  </label>
                  {!recipients.length ? (
                    <p className="platform-attendance-error">
                      There is no one in your current workspace to message yet.
                    </p>
                  ) : null}
                  {result ? (
                    <p
                      aria-live="polite"
                      className="platform-attendance-error"
                    >
                      {result.text}
                    </p>
                  ) : null}
                </form>
              )}
            </section>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role={role} title={titleByRole[role]}>
      <WorkspaceLayout
        className="portal-messages-page"
        title={titleByRole[role]}
        description={descriptionByRole[role]}
        context={roleMeta[role].label}
        actions={
          <Link
            className="platform-primary-button"
            href={`${inboxHref}/new`}
          >
            <MessageSquare size={15} />
            New message
          </Link>
        }
        toolbar={
          <div
            className="portal-message-toolbar-v3"
            data-testid={`portal-messages-toolbar-${role}`}
          >
            <label>
              <span className="sr-only">Search messages</span>
              <Search size={15} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search messages"
              />
            </label>
          </div>
        }
        main={
          <section
            className="portal-message-inbox-v3"
            data-testid={`portal-messages-inbox-${role}`}
          >
            <div className="portal-message-inbox-heading">
              <div>
                <span>Inbox</span>
                <h2>{filteredMessages.length} message(s)</h2>
              </div>
              {filteredMessages.some(message => !message.read) ? (
                <small>
                  {filteredMessages.filter(message => !message.read).length}{" "}
                  unread
                </small>
              ) : null}
            </div>
            <div className="portal-message-inbox-list">
              {filteredMessages.map(message => {
                const from = state.users.find(
                  user => user.id === message.fromUserId
                );
                const to = state.users.find(
                  user => user.id === message.toUserId
                );
                const outgoing = message.fromUserId === actorId;
                const counterpart = outgoing ? to : from;
                return (
                  <article
                    key={message.id}
                    className={message.read ? "" : "unread"}
                  >
                    <span
                      aria-hidden="true"
                      className="portal-message-read-dot"
                    />
                    <div>
                      <span>
                        {outgoing ? "To" : "From"}{" "}
                        {counterpart?.name ?? "Nile Learn"}
                      </span>
                      <strong>{message.subject}</strong>
                      <p>{message.body}</p>
                    </div>
                    <time dateTime={message.createdAt}>
                      {formatDate(message.createdAt)}
                    </time>
                  </article>
                );
              })}
              {!filteredMessages.length ? (
                <div className="portal-message-empty-v3">
                  <strong>No messages found</strong>
                  <p>Send a message or try a different search.</p>
                </div>
              ) : null}
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
