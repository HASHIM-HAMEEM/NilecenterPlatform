import { describe, expect, it } from "vitest";
import {
  buildMessageConversations,
  messageConversationId,
  messageSubject,
  replyMessageSubject,
} from "./messageThreads";

describe("message conversations", () => {
  it("groups legacy subject replies into one ordered direct conversation", () => {
    const conversations = buildMessageConversations(
      [
        {
          id: "msg_reply",
          fromUserId: "usr_student_demo",
          toUserId: "usr_teacher_demo",
          subject: "Re: Arabic L3 reminder",
          body: "Thank you.",
          read: false,
          createdAt: "2026-07-12T10:05:00.000Z",
        },
        {
          id: "msg_root",
          fromUserId: "usr_teacher_demo",
          toUserId: "usr_student_demo",
          subject: "Arabic L3 reminder",
          body: "Class starts at 09:00.",
          read: true,
          createdAt: "2026-07-12T10:00:00.000Z",
        },
      ],
      "usr_teacher_demo"
    );

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      subject: "Arabic L3 reminder",
      counterpartUserId: "usr_student_demo",
      unreadCount: 1,
    });
    expect(conversations[0].messages.map(message => message.id)).toEqual([
      "msg_root",
      "msg_reply",
    ]);
  });

  it("keeps separately started conversations distinct and normalizes reply labels", () => {
    const first = {
      id: "msg_one",
      threadId: "thread_one",
      fromUserId: "usr_teacher_demo",
      toUserId: "usr_student_demo",
      subject: "Class update",
      body: "First update.",
      read: false,
      createdAt: "2026-07-12T10:00:00.000Z",
    };
    const second = {
      ...first,
      id: "msg_two",
      threadId: "thread_two",
      createdAt: "2026-07-12T11:00:00.000Z",
    };

    expect(messageSubject("Re: Re: Class update")).toBe("Class update");
    expect(replyMessageSubject("Re: Class update")).toBe("Re: Class update");
    expect(messageConversationId(first)).toBe("thread_one");
    expect(
      buildMessageConversations([first, second], "usr_teacher_demo")
    ).toHaveLength(2);
  });
});
