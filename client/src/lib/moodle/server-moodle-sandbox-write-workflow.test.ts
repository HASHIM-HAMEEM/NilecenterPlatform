import { describe, expect, it } from "vitest";

import { MOODLE_READ_FUNCTIONS } from "../../../../server/moodleClient";
import {
  MOODLE_SANDBOX_WRITE_FUNCTIONS,
  type MoodleSandboxSyntheticUserInput,
} from "../../../../server/moodleSandboxWriteClient";
import {
  runMoodleSandboxWriteWorkflow,
  type MoodleSandboxWriteWorkflowOptions,
  type MoodleSandboxWriteWorkflowReadClient,
  type MoodleSandboxWriteWorkflowWriteClient,
} from "../../../../server/moodleSandboxWriteWorkflow";

const marker = "NILE-M2B-20260713T120000Z-a1b2c3d4";
const courseId = 42;
const roleId = 5;
const groupName = `Nile M2B ${marker}`;
const syntheticUser: MoodleSandboxSyntheticUserInput & {
  updatedFirstName: string;
} = {
  marker,
  username: "nile-m2b-a1b2c3d4",
  firstName: "Synthetic",
  updatedFirstName: "Verified",
  lastName: "Learner",
  email: "nile-m2b-a1b2c3d4@example.invalid",
  password: "Nile-M2B-Only-A1b2c3d4!",
};

type ProviderUser = {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  idnumber: string;
};

type ProviderGroup = {
  id: number;
  courseid: number;
  name: string;
  idnumber: string;
};

type FakeMutation =
  | "createUser"
  | "deleteUser"
  | "unenrolUser"
  | "deleteGroup"
  | "deleteGroupMember";

type FakeUnknownOutcome = "applied_timeout" | "absent_timeout";

type FakeProviderOptions = {
  users?: ProviderUser[];
  groups?: ProviderGroup[];
  enrolledUserIds?: number[];
  memberships?: Array<{ userId: number; groupId: number }>;
  failAddMembership?: boolean;
  retainUserOnDelete?: boolean;
  unknownOutcomes?: Partial<Record<FakeMutation, FakeUnknownOutcome>>;
  failReconciliationReadAfter?: FakeMutation;
};

function fakeProvider(options: FakeProviderOptions = {}) {
  const state = {
    users: [...(options.users ?? [])],
    groups: [...(options.groups ?? [])],
    enrolledUserIds: new Set(options.enrolledUserIds ?? []),
    memberships: new Set(
      (options.memberships ?? []).map(
        membership => `${membership.groupId}:${membership.userId}`
      )
    ),
  };
  const mutations: string[] = [];
  let nextUserId = 44;
  let nextGroupId = 77;
  const unknownOutcomes = new Map<FakeMutation, FakeUnknownOutcome>(
    Object.entries(options.unknownOutcomes ?? {}) as Array<
      [FakeMutation, FakeUnknownOutcome]
    >
  );
  let failNextReconciliationRead = false;
  let reconciliationReadFailureScheduled = false;

  const mutation = <T>(name: FakeMutation, apply: () => T): T => {
    mutations.push(name);
    const unknownOutcome = unknownOutcomes.get(name);
    unknownOutcomes.delete(name);

    const scheduleReconciliationReadFailure = () => {
      if (
        options.failReconciliationReadAfter === name &&
        !reconciliationReadFailureScheduled
      ) {
        failNextReconciliationRead = true;
        reconciliationReadFailureScheduled = true;
      }
    };
    const timeout = () =>
      Object.assign(new Error("Injected provider timeout."), {
        code: "timeout",
      });

    if (unknownOutcome === "absent_timeout") {
      scheduleReconciliationReadFailure();
      throw timeout();
    }

    const result = apply();
    scheduleReconciliationReadFailure();
    if (unknownOutcome === "applied_timeout") throw timeout();
    return result;
  };

  const readProbe = async () => ({
    mode: "read_only" as const,
    verifiedAt: "2026-07-13T12:00:00.000Z",
    site: {
      name: "Nile M2B Practice",
      url: "https://moodle-no-data.enesekremergunesh.com",
      release: "4.5.12+",
      version: "2024100712.00",
    },
    availableFunctionCount: MOODLE_READ_FUNCTIONS.length,
    approvedFunctionCount: MOODLE_READ_FUNCTIONS.length,
    missingApprovedFunctions: [],
    unexpectedFunctions: [],
    minimumPrivilegeVerified: true,
  });

  const call: MoodleSandboxWriteWorkflowReadClient["call"] = async <T>(
    functionName,
    parameters = {}
  ) => {
    if (functionName === "core_user_get_users_by_field") {
      const requestedMarker = String((parameters.values as string[])[0]);
      return state.users.filter(user => user.idnumber === requestedMarker) as T;
    }
    if (functionName === "core_group_get_course_groups") {
      return state.groups.filter(
        group => group.courseid === Number(parameters.courseid)
      ) as T;
    }
    if (functionName === "core_course_get_courses_by_field") {
      return {
        courses: [{ id: courseId }],
        warnings: [],
      } as T;
    }
    if (functionName === "core_enrol_get_enrolled_users") {
      return [
        { id: 6, roles: [{ roleid: roleId }] },
        ...state.users
          .filter(user => state.enrolledUserIds.has(user.id))
          .map(user => ({ ...user, roles: [{ roleid: roleId }] })),
      ] as T;
    }
    if (functionName === "core_group_get_course_user_groups") {
      const userId = Number(parameters.userid);
      return {
        groups: state.groups.filter(group =>
          state.memberships.has(`${group.id}:${userId}`)
        ),
      } as T;
    }
    throw new Error("Unexpected fake read function.");
  };

  const readClient: MoodleSandboxWriteWorkflowReadClient = {
    probe: readProbe,
    call,
  };

  const writeClient: MoodleSandboxWriteWorkflowWriteClient = {
    async probe() {
      return {
        mode: "sandbox_write",
        verifiedAt: "2026-07-13T12:00:00.000Z",
        service: "nile_m2b_sandbox_write",
        site: {
          name: "Nile M2B Practice",
          url: "https://moodle-no-data.enesekremergunesh.com",
          release: "4.5.12+",
          version: "2024100712.00",
        },
        availableFunctionCount: MOODLE_SANDBOX_WRITE_FUNCTIONS.length,
        approvedFunctionCount: MOODLE_SANDBOX_WRITE_FUNCTIONS.length,
        missingApprovedFunctions: [],
        unexpectedFunctions: [],
        hasDuplicateFunctions: false,
        minimumPrivilegeVerified: true,
      };
    },
    async findUsersByMarker(requestedMarker) {
      if (failNextReconciliationRead) {
        failNextReconciliationRead = false;
        throw new Error("Injected reconciliation read failure.");
      }
      return state.users
        .filter(user => user.idnumber === requestedMarker)
        .map(user => ({
          id: user.id,
          username: user.username,
          firstName: user.firstname,
          lastName: user.lastname,
          email: user.email,
          marker: user.idnumber,
        }));
    },
    async createUser(input) {
      return mutation("createUser", () => {
        const id = nextUserId++;
        state.users.push({
          id,
          username: input.username,
          firstname: input.firstName,
          lastname: input.lastName,
          email: input.email,
          idnumber: input.marker,
        });
        return { id, username: input.username };
      });
    },
    async updateUser(input) {
      mutations.push("updateUser");
      const user = state.users.find(candidate => candidate.id === input.userId);
      if (user) user.firstname = input.firstName;
    },
    async deleteUser(input) {
      mutation("deleteUser", () => {
        if (!options.retainUserOnDelete) {
          state.users = state.users.filter(user => user.id !== input.userId);
        }
      });
    },
    async enrolUser(input) {
      mutations.push("enrolUser");
      state.enrolledUserIds.add(input.userId);
    },
    async unenrolUser(input) {
      mutation("unenrolUser", () => state.enrolledUserIds.delete(input.userId));
    },
    async createGroup(input) {
      mutations.push("createGroup");
      const id = nextGroupId++;
      state.groups.push({
        id,
        courseid: courseId,
        name: input.name,
        idnumber: input.marker,
      });
      return { id, name: input.name };
    },
    async deleteGroup(input) {
      mutation("deleteGroup", () => {
        state.groups = state.groups.filter(group => group.id !== input.groupId);
      });
    },
    async addGroupMember(input) {
      mutations.push("addGroupMember");
      if (options.failAddMembership) {
        throw new Error("Injected partial failure.");
      }
      state.memberships.add(`${input.groupId}:${input.userId}`);
    },
    async deleteGroupMember(input) {
      mutation("deleteGroupMember", () =>
        state.memberships.delete(`${input.groupId}:${input.userId}`)
      );
    },
  };

  const workflowOptions: MoodleSandboxWriteWorkflowOptions = {
    readClient,
    writeClient,
    marker,
    courseId,
    roleId,
    user: syntheticUser,
    groupName,
  };

  return { state, mutations, workflowOptions };
}

function adoptedFixtures() {
  const user: ProviderUser = {
    id: 44,
    username: syntheticUser.username,
    firstname: syntheticUser.updatedFirstName,
    lastname: syntheticUser.lastName,
    email: syntheticUser.email,
    idnumber: marker,
  };
  const group: ProviderGroup = {
    id: 77,
    courseid: courseId,
    name: groupName,
    idnumber: marker,
  };
  return { user, group };
}

describe("Moodle M2B synthetic sandbox write workflow", () => {
  it("runs a clean ensure twice without duplicates and cleans up in dependency order", async () => {
    const provider = fakeProvider();

    const result = await runMoodleSandboxWriteWorkflow(
      provider.workflowOptions
    );

    expect(result).toMatchObject({
      outcome: "completed",
      ensurePasses: 2,
      cleanup: {
        membership: "absent",
        group: "absent",
        enrolment: "absent",
        user: "absent",
      },
    });
    expect(provider.mutations).toEqual([
      "createUser",
      "updateUser",
      "enrolUser",
      "createGroup",
      "addGroupMember",
      "deleteGroupMember",
      "deleteGroup",
      "unenrolUser",
      "deleteUser",
    ]);
    expect(
      result.evidence.find(
        item => item.operation === "user_create" && item.pass === 2
      )?.outcome
    ).toBe("adopted");
    expect(
      result.evidence.find(
        item => item.operation === "membership_ensure" && item.pass === 2
      )?.outcome
    ).toBe("adopted");
  });

  it("adopts a complete prior marker state and replays without creating duplicates", async () => {
    const { user, group } = adoptedFixtures();
    const provider = fakeProvider({
      users: [user],
      groups: [group],
      enrolledUserIds: [user.id],
      memberships: [{ userId: user.id, groupId: group.id }],
    });

    const result = await runMoodleSandboxWriteWorkflow(
      provider.workflowOptions
    );

    expect(provider.mutations.slice(0, 4)).toEqual([
      "deleteGroupMember",
      "deleteGroup",
      "unenrolUser",
      "deleteUser",
    ]);
    expect(
      result.evidence.filter(
        item => item.operation === "user_create" && item.outcome === "adopted"
      )
    ).toHaveLength(2);
    expect(
      result.evidence.filter(
        item =>
          item.operation === "membership_ensure" && item.outcome === "adopted"
      )
    ).toHaveLength(2);
  });

  it("reconciles a mutation applied before timeout without duplicating it", async () => {
    const provider = fakeProvider({
      unknownOutcomes: { createUser: "applied_timeout" },
    });

    const result = await runMoodleSandboxWriteWorkflow(
      provider.workflowOptions
    );

    expect(
      provider.mutations.filter(item => item === "createUser")
    ).toHaveLength(1);
    expect(
      result.evidence.find(
        item => item.operation === "user_create" && item.pass === 1
      )?.outcome
    ).toBe("reconciled");
  });

  it("retries a timed-out absent mutation only once and verifies the retry", async () => {
    const provider = fakeProvider({
      unknownOutcomes: { createUser: "absent_timeout" },
    });

    const result = await runMoodleSandboxWriteWorkflow(
      provider.workflowOptions
    );

    expect(
      provider.mutations.filter(item => item === "createUser")
    ).toHaveLength(2);
    expect(
      result.evidence.find(
        item => item.operation === "user_create" && item.pass === 1
      )?.outcome
    ).toBe("created");
    expect(result.outcome).toBe("completed");
  });

  it("fails closed when an unknown outcome cannot be reconciled", async () => {
    const provider = fakeProvider({
      unknownOutcomes: { createUser: "applied_timeout" },
      failReconciliationReadAfter: "createUser",
    });

    await expect(
      runMoodleSandboxWriteWorkflow(provider.workflowOptions)
    ).rejects.toMatchObject({ code: "write_failed" });
    expect(
      provider.mutations.filter(item => item === "createUser")
    ).toHaveLength(1);
    expect(provider.state.users).toEqual([]);
  });

  it.each([
    ["membership", "deleteGroupMember", "membership_cleanup"],
    ["group", "deleteGroup", "group_cleanup"],
    ["enrolment", "unenrolUser", "enrolment_cleanup"],
    ["user", "deleteUser", "user_cleanup"],
  ] as const)(
    "verifies an applied timeout during %s cleanup",
    async (_resource, mutationName, operation) => {
      const provider = fakeProvider({
        unknownOutcomes: { [mutationName]: "applied_timeout" },
      });

      const result = await runMoodleSandboxWriteWorkflow(
        provider.workflowOptions
      );

      expect(
        provider.mutations.filter(item => item === mutationName)
      ).toHaveLength(1);
      expect(
        result.evidence.find(item => item.operation === operation)?.outcome
      ).toBe("reconciled");
      expect(result.cleanup).toEqual({
        membership: "absent",
        group: "absent",
        enrolment: "absent",
        user: "absent",
      });
    }
  );

  it("refuses ambiguous marker matches before any write", async () => {
    const { user } = adoptedFixtures();
    const provider = fakeProvider({
      users: [user, { ...user, id: 45 }],
    });

    await expect(
      runMoodleSandboxWriteWorkflow(provider.workflowOptions)
    ).rejects.toMatchObject({ code: "ambiguous_marker" });
    expect(provider.mutations).toEqual([]);
  });

  it("cleans up created dependencies when a later ensure step fails", async () => {
    const provider = fakeProvider({ failAddMembership: true });

    await expect(
      runMoodleSandboxWriteWorkflow(provider.workflowOptions)
    ).rejects.toMatchObject({ code: "verification_failed" });
    expect(provider.mutations.slice(-3)).toEqual([
      "deleteGroup",
      "unenrolUser",
      "deleteUser",
    ]);
    expect(provider.state.users).toEqual([]);
    expect(provider.state.groups).toEqual([]);
    expect(provider.state.enrolledUserIds.size).toBe(0);
    expect(provider.state.memberships.size).toBe(0);
  });

  it("fails closed when cleanup cannot verify the active marker is absent", async () => {
    const provider = fakeProvider({ retainUserOnDelete: true });

    await expect(
      runMoodleSandboxWriteWorkflow(provider.workflowOptions)
    ).rejects.toMatchObject({ code: "cleanup_failed" });
    expect(
      provider.mutations.filter(item => item === "deleteUser")
    ).toHaveLength(2);
    expect(provider.state.users).toHaveLength(1);
  });

  it("returns evidence containing only operation outcomes and external IDs", async () => {
    const provider = fakeProvider();

    const result = await runMoodleSandboxWriteWorkflow(
      provider.workflowOptions
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain(syntheticUser.email);
    expect(serialized).not.toContain(syntheticUser.username);
    expect(serialized).not.toContain(syntheticUser.password);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
  });
});
