import type { MoodleClient } from "./moodleClient";
import {
  isMoodleSandboxMarker,
  type MoodleSandboxSyntheticUserInput,
  type MoodleSandboxWriteClient,
} from "./moodleSandboxWriteClient";

export type MoodleSandboxWriteWorkflowReadClient = Pick<
  MoodleClient,
  "call" | "probe"
>;

export type MoodleSandboxWriteWorkflowWriteClient = Pick<
  MoodleSandboxWriteClient,
  | "probe"
  | "findUsersByMarker"
  | "createUser"
  | "updateUser"
  | "deleteUser"
  | "enrolUser"
  | "unenrolUser"
  | "createGroup"
  | "deleteGroup"
  | "addGroupMember"
  | "deleteGroupMember"
>;

export type MoodleSandboxWriteWorkflowOptions = {
  readClient: MoodleSandboxWriteWorkflowReadClient;
  writeClient: MoodleSandboxWriteWorkflowWriteClient;
  marker: string;
  courseId: number;
  roleId: number;
  user: MoodleSandboxSyntheticUserInput & {
    updatedFirstName: string;
  };
  groupName: string;
};

export type MoodleSandboxWriteEvidenceOperation =
  | "read_probe"
  | "write_probe"
  | "scope_verify"
  | "user_create"
  | "user_update"
  | "enrolment_ensure"
  | "group_create"
  | "membership_ensure"
  | "ensure_verify"
  | "membership_cleanup"
  | "group_cleanup"
  | "enrolment_cleanup"
  | "user_cleanup"
  | "cleanup_verify"
  | "run";

export type MoodleSandboxWriteEvidenceOutcome =
  | "verified"
  | "created"
  | "updated"
  | "adopted"
  | "unchanged"
  | "reconciled"
  | "removed"
  | "absent"
  | "failed";

export type MoodleSandboxWriteEvidence = Readonly<{
  operation: MoodleSandboxWriteEvidenceOperation;
  outcome: MoodleSandboxWriteEvidenceOutcome;
  pass?: 1 | 2;
  courseId?: number;
  roleId?: number;
  userId?: number;
  groupId?: number;
}>;

export type MoodleSandboxWriteWorkflowResult = Readonly<{
  outcome: "completed";
  ensurePasses: 2;
  evidence: readonly MoodleSandboxWriteEvidence[];
  cleanup: Readonly<{
    membership: "absent";
    group: "absent";
    enrolment: "absent";
    user: "absent";
  }>;
}>;

export type MoodleSandboxWriteWorkflowErrorCode =
  | "configuration"
  | "probe_failed"
  | "invalid_read"
  | "ambiguous_marker"
  | "identity_mismatch"
  | "write_failed"
  | "verification_failed"
  | "cleanup_failed";

export class MoodleSandboxWriteWorkflowError extends Error {
  constructor(
    readonly code: MoodleSandboxWriteWorkflowErrorCode,
    readonly evidence: readonly MoodleSandboxWriteEvidence[]
  ) {
    super(`Moodle sandbox write workflow failed (${code}).`);
    this.name = "MoodleSandboxWriteWorkflowError";
  }
}

type UnknownRecord = Record<string, unknown>;

type MarkerUser = {
  id: number;
  firstName: string;
};

type MarkerGroup = {
  id: number;
};

type MarkerState = {
  user?: MarkerUser;
  group?: MarkerGroup;
  enrolled: boolean;
  member: boolean;
};

function fail(code: MoodleSandboxWriteWorkflowErrorCode): never {
  throw new MoodleSandboxWriteWorkflowError(code, []);
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid_read");
  }
  return value as UnknownRecord;
}

function array(value: unknown) {
  if (!Array.isArray(value)) fail("invalid_read");
  return value;
}

function positiveId(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    fail("invalid_read");
  }
  return Number(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function probeFingerprint(
  probe: Awaited<ReturnType<MoodleSandboxWriteWorkflowReadClient["probe"]>>
) {
  return JSON.stringify({
    mode: probe.mode,
    site: probe.site,
    availableFunctionCount: probe.availableFunctionCount,
    approvedFunctionCount: probe.approvedFunctionCount,
    missingApprovedFunctions: [...probe.missingApprovedFunctions].sort(),
    unexpectedFunctions: [...probe.unexpectedFunctions].sort(),
    minimumPrivilegeVerified: probe.minimumPrivilegeVerified,
  });
}

function workflowCode(error: unknown): MoodleSandboxWriteWorkflowErrorCode {
  return error instanceof MoodleSandboxWriteWorkflowError
    ? error.code
    : "write_failed";
}

function permitsRetry(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return true;
  return ["timeout", "remote", "invalid_response"].includes(
    String((error as { code?: unknown }).code)
  );
}

export async function runMoodleSandboxWriteWorkflow({
  readClient,
  writeClient,
  marker,
  courseId,
  roleId,
  user,
  groupName,
}: MoodleSandboxWriteWorkflowOptions): Promise<MoodleSandboxWriteWorkflowResult> {
  const evidence: MoodleSandboxWriteEvidence[] = [];

  if (
    !isMoodleSandboxMarker(marker) ||
    readClient === (writeClient as unknown) ||
    user.marker !== marker ||
    !Number.isSafeInteger(courseId) ||
    courseId <= 0 ||
    !Number.isSafeInteger(roleId) ||
    roleId <= 0 ||
    !text(groupName) ||
    !text(user.updatedFirstName)
  ) {
    throw new MoodleSandboxWriteWorkflowError("configuration", evidence);
  }

  const readUser = async (): Promise<MarkerUser | undefined> => {
    const matches = await writeClient.findUsersByMarker(marker);
    if (matches.length > 1) fail("ambiguous_marker");
    const item = matches[0];
    if (!item) return undefined;

    const firstName = text(item.firstName);
    const expectedFirstNames = new Set([
      text(user.firstName),
      text(user.updatedFirstName),
    ]);
    if (
      text(item.username) !== text(user.username) ||
      (text(item.email) !== "" && text(item.email) !== text(user.email)) ||
      !text(user.email).toLowerCase().endsWith("@example.invalid") ||
      text(item.lastName) !== text(user.lastName) ||
      text(item.marker) !== marker ||
      !expectedFirstNames.has(firstName)
    ) {
      fail("identity_mismatch");
    }
    return { id: positiveId(item.id), firstName };
  };

  const readGroup = async (): Promise<MarkerGroup | undefined> => {
    const payload = array(
      await readClient.call<unknown>("core_group_get_course_groups", {
        courseid: courseId,
      })
    );
    const matches = payload.filter(
      value => text(record(value).idnumber) === marker
    );
    if (matches.length > 1) fail("ambiguous_marker");
    if (!matches.length) return undefined;

    const item = record(matches[0]);
    if (
      positiveId(item.courseid) !== courseId ||
      text(item.name) !== text(groupName)
    ) {
      fail("identity_mismatch");
    }
    return { id: positiveId(item.id) };
  };

  const readEnrolment = async (userId: number) => {
    const payload = array(
      await readClient.call<unknown>("core_enrol_get_enrolled_users", {
        courseid: courseId,
        options: [{ name: "onlyactive", value: "1" }],
      })
    );
    const matches = payload.filter(
      value => positiveId(record(value).id) === userId
    );
    if (matches.length > 1) fail("ambiguous_marker");
    if (!matches.length) return false;

    const roles = array(record(matches[0]).roles);
    const roleMatches = roles.filter(
      value => positiveId(record(value).roleid) === roleId
    );
    if (roleMatches.length !== 1 || roles.length !== 1) {
      fail("identity_mismatch");
    }
    return true;
  };

  const readMembership = async (userId: number, groupId: number) => {
    const payload = record(
      await readClient.call<unknown>("core_group_get_course_user_groups", {
        courseid: courseId,
        userid: userId,
      })
    );
    const matches = array(payload.groups).filter(
      value => positiveId(record(value).id) === groupId
    );
    if (matches.length > 1) fail("ambiguous_marker");
    if (!matches.length) return false;
    if (text(record(matches[0]).idnumber) !== marker) {
      fail("identity_mismatch");
    }
    return true;
  };

  const verifyScope = async () => {
    const courseEnvelope = record(
      await readClient.call<unknown>("core_course_get_courses_by_field", {
        field: "id",
        value: String(courseId),
      })
    );
    const courses = array(courseEnvelope.courses);
    if (
      courses.length !== 1 ||
      positiveId(record(courses[0]).id) !== courseId
    ) {
      fail("identity_mismatch");
    }

    const enrolledUsers = array(
      await readClient.call<unknown>("core_enrol_get_enrolled_users", {
        courseid: courseId,
        options: [{ name: "onlyactive", value: "1" }],
      })
    );
    const roleMatches = enrolledUsers.flatMap(value =>
      array(record(value).roles).filter(
        role => positiveId(record(role).roleid) === roleId
      )
    );
    if (!roleMatches.length) fail("identity_mismatch");
  };

  const inspect = async (): Promise<MarkerState> => {
    const [markerUser, markerGroup] = await Promise.all([
      readUser(),
      readGroup(),
    ]);
    const enrolled = markerUser ? await readEnrolment(markerUser.id) : false;
    const member =
      markerUser && markerGroup
        ? await readMembership(markerUser.id, markerGroup.id)
        : false;
    return { user: markerUser, group: markerGroup, enrolled, member };
  };

  const reconcileMutation = async <T>({
    inspectState,
    isDesired,
    mutate,
    existingOutcome,
    successOutcome,
  }: {
    inspectState: () => Promise<T>;
    isDesired: (state: T) => boolean;
    mutate: () => Promise<void>;
    existingOutcome: MoodleSandboxWriteEvidenceOutcome;
    successOutcome: MoodleSandboxWriteEvidenceOutcome;
  }) => {
    let state = await inspectState();
    if (isDesired(state)) return { state, outcome: existingOutcome };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let mutationReturned = false;
      let mutationError: unknown;
      try {
        await mutate();
        mutationReturned = true;
      } catch (error) {
        mutationError = error;
        // The separate read client decides whether the outcome was applied.
      }
      state = await inspectState();
      if (isDesired(state)) {
        return {
          state,
          outcome: mutationReturned ? successOutcome : "reconciled",
        };
      }
      if (mutationError && !permitsRetry(mutationError)) {
        fail("write_failed");
      }
    }
    fail("verification_failed");
  };

  const ensure = async (pass: 1 | 2) => {
    const createdUser = await reconcileMutation({
      inspectState: readUser,
      isDesired: (state): state is MarkerUser => Boolean(state),
      mutate: async () => {
        await writeClient.createUser(user);
      },
      existingOutcome: "adopted",
      successOutcome: "created",
    });
    const userId = (createdUser.state as MarkerUser).id;
    evidence.push({
      operation: "user_create",
      outcome: createdUser.outcome,
      pass,
      userId,
    });

    const updatedUser = await reconcileMutation({
      inspectState: readUser,
      isDesired: state => state?.firstName === text(user.updatedFirstName),
      mutate: () =>
        writeClient.updateUser({
          ...user,
          firstName: user.updatedFirstName,
          userId,
        }),
      existingOutcome: "unchanged",
      successOutcome: "updated",
    });
    if (!updatedUser.state || updatedUser.state.id !== userId) {
      fail("verification_failed");
    }
    evidence.push({
      operation: "user_update",
      outcome: updatedUser.outcome,
      pass,
      userId,
    });

    const enrolment = await reconcileMutation({
      inspectState: () => readEnrolment(userId),
      isDesired: state => state,
      mutate: () => writeClient.enrolUser({ marker, userId }),
      existingOutcome: "adopted",
      successOutcome: "created",
    });
    evidence.push({
      operation: "enrolment_ensure",
      outcome: enrolment.outcome,
      pass,
      courseId,
      roleId,
      userId,
    });

    const createdGroup = await reconcileMutation({
      inspectState: readGroup,
      isDesired: (state): state is MarkerGroup => Boolean(state),
      mutate: async () => {
        await writeClient.createGroup({
          marker,
          name: groupName,
          description: marker,
        });
      },
      existingOutcome: "adopted",
      successOutcome: "created",
    });
    const groupId = (createdGroup.state as MarkerGroup).id;
    evidence.push({
      operation: "group_create",
      outcome: createdGroup.outcome,
      pass,
      courseId,
      groupId,
    });

    const membership = await reconcileMutation({
      inspectState: () => readMembership(userId, groupId),
      isDesired: state => state,
      mutate: () => writeClient.addGroupMember({ marker, userId, groupId }),
      existingOutcome: "adopted",
      successOutcome: "created",
    });
    evidence.push({
      operation: "membership_ensure",
      outcome: membership.outcome,
      pass,
      userId,
      groupId,
    });

    const verified = await inspect();
    if (
      verified.user?.id !== userId ||
      verified.group?.id !== groupId ||
      !verified.enrolled ||
      !verified.member
    ) {
      fail("verification_failed");
    }
    evidence.push({
      operation: "ensure_verify",
      outcome: "verified",
      pass,
      courseId,
      roleId,
      userId,
      groupId,
    });
  };

  const cleanup = async () => {
    let state = await inspect();
    const userId = state.user?.id;
    const groupId = state.group?.id;

    if (userId && groupId) {
      const membership = await reconcileMutation({
        inspectState: () => readMembership(userId, groupId),
        isDesired: current => !current,
        mutate: () =>
          writeClient.deleteGroupMember({ marker, userId, groupId }),
        existingOutcome: "absent",
        successOutcome: "removed",
      });
      evidence.push({
        operation: "membership_cleanup",
        outcome: membership.outcome,
        userId,
        groupId,
      });
    } else {
      evidence.push({
        operation: "membership_cleanup",
        outcome: "absent",
        userId,
        groupId,
      });
    }

    const group = await reconcileMutation({
      inspectState: readGroup,
      isDesired: current => !current,
      mutate: async () => {
        const current = await readGroup();
        if (!current) return;
        await writeClient.deleteGroup({ marker, groupId: current.id });
      },
      existingOutcome: "absent",
      successOutcome: "removed",
    });
    evidence.push({
      operation: "group_cleanup",
      outcome: group.outcome,
      groupId,
    });

    if (userId) {
      const enrolment = await reconcileMutation({
        inspectState: () => readEnrolment(userId),
        isDesired: current => !current,
        mutate: () => writeClient.unenrolUser({ marker, userId }),
        existingOutcome: "absent",
        successOutcome: "removed",
      });
      evidence.push({
        operation: "enrolment_cleanup",
        outcome: enrolment.outcome,
        courseId,
        roleId,
        userId,
      });
    } else {
      evidence.push({
        operation: "enrolment_cleanup",
        outcome: "absent",
        courseId,
        roleId,
      });
    }

    const markerUser = await readUser();
    const activeUserId = markerUser?.id;
    const removedUser = await reconcileMutation({
      inspectState: readUser,
      isDesired: current => !current,
      mutate: async () => {
        const current = await readUser();
        if (!current) return;
        await writeClient.deleteUser({ marker, userId: current.id });
      },
      existingOutcome: "absent",
      successOutcome: "removed",
    });
    evidence.push({
      operation: "user_cleanup",
      outcome: removedUser.outcome,
      userId: activeUserId ?? userId,
    });

    state = await inspect();
    if (state.user || state.group || state.enrolled || state.member) {
      fail("cleanup_failed");
    }
    evidence.push({
      operation: "cleanup_verify",
      outcome: "verified",
      courseId,
      roleId,
      userId,
      groupId,
    });
  };

  let readProbeBefore:
    | Awaited<ReturnType<MoodleSandboxWriteWorkflowReadClient["probe"]>>
    | undefined;
  let failureCode: MoodleSandboxWriteWorkflowErrorCode | undefined;
  let cleanupFailed = false;

  try {
    readProbeBefore = await readClient.probe();
    if (
      !readProbeBefore.minimumPrivilegeVerified ||
      readProbeBefore.missingApprovedFunctions.length ||
      readProbeBefore.unexpectedFunctions.length
    ) {
      fail("probe_failed");
    }
    evidence.push({ operation: "read_probe", outcome: "verified" });

    const writeProbe = await writeClient.probe();
    if (
      !writeProbe.minimumPrivilegeVerified ||
      writeProbe.missingApprovedFunctions.length ||
      writeProbe.unexpectedFunctions.length ||
      writeProbe.hasDuplicateFunctions
    ) {
      fail("probe_failed");
    }
    evidence.push({ operation: "write_probe", outcome: "verified" });

    await verifyScope();
    evidence.push({
      operation: "scope_verify",
      outcome: "verified",
      courseId,
      roleId,
    });

    await ensure(1);
    await ensure(2);
  } catch (error) {
    failureCode = workflowCode(error);
    evidence.push({ operation: "run", outcome: "failed" });
  } finally {
    try {
      await cleanup();
    } catch {
      cleanupFailed = true;
      evidence.push({ operation: "cleanup_verify", outcome: "failed" });
    }

    if (readProbeBefore) {
      try {
        const readProbeAfter = await readClient.probe();
        if (
          !readProbeAfter.minimumPrivilegeVerified ||
          probeFingerprint(readProbeAfter) !== probeFingerprint(readProbeBefore)
        ) {
          cleanupFailed = true;
          evidence.push({ operation: "read_probe", outcome: "failed" });
        }
      } catch {
        cleanupFailed = true;
        evidence.push({ operation: "read_probe", outcome: "failed" });
      }
    }
  }

  if (failureCode === "ambiguous_marker") {
    throw new MoodleSandboxWriteWorkflowError(failureCode, evidence);
  }
  if (cleanupFailed) {
    throw new MoodleSandboxWriteWorkflowError("cleanup_failed", evidence);
  }
  if (failureCode) {
    throw new MoodleSandboxWriteWorkflowError(failureCode, evidence);
  }

  return {
    outcome: "completed",
    ensurePasses: 2,
    evidence,
    cleanup: {
      membership: "absent",
      group: "absent",
      enrolment: "absent",
      user: "absent",
    },
  };
}
