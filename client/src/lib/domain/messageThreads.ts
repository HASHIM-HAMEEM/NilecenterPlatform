import type { Message } from "./types";

export type MessageConversation = {
  id: string;
  participantUserIds: string[];
  counterpartUserId?: string;
  messages: Message[];
  subject: string;
  latestMessage: Message;
  unreadCount: number;
};

export function messageSubject(subject: string) {
  const normalized = subject.trim().replace(/\s+/g, " ");
  const withoutReplyPrefix = normalized.replace(/^(?:re:\s*)+/i, "").trim();
  return withoutReplyPrefix || "Message";
}

export function replyMessageSubject(subject: string) {
  return `Re: ${messageSubject(subject)}`;
}

export function messageConversationId(message: Message) {
  if (message.threadId) return message.threadId;

  const participants = [message.fromUserId, message.toUserId].sort().join(":");
  return `legacy:${participants}:${messageSubject(message.subject).toLowerCase()}`;
}

function messageTime(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildMessageConversations(
  messages: Message[],
  actorId: string
): MessageConversation[] {
  const byConversation = new Map<string, Message[]>();

  messages.forEach(message => {
    const id = messageConversationId(message);
    byConversation.set(id, [...(byConversation.get(id) ?? []), message]);
  });

  return Array.from(byConversation, ([id, conversationMessages]) => {
    const ordered = [...conversationMessages].sort(
      (left, right) => messageTime(left.createdAt) - messageTime(right.createdAt)
    );
    const latestMessage = ordered.at(-1)!;
    const participantUserIds = Array.from(
      new Set(
        ordered.flatMap(message => [message.fromUserId, message.toUserId])
      )
    );
    const counterpartUserId = participantUserIds.find(
      userId => userId !== actorId
    );

    return {
      id,
      participantUserIds,
      counterpartUserId,
      messages: ordered,
      subject: messageSubject(latestMessage.subject),
      latestMessage,
      unreadCount: ordered.filter(
        message => message.toUserId === actorId && !message.read
      ).length,
    };
  }).sort(
    (left, right) =>
      messageTime(right.latestMessage.createdAt) -
      messageTime(left.latestMessage.createdAt)
  );
}
