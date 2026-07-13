import { describe, expect, it } from "vitest";

import * as readModels from "../../../../server/moodleReadModels";

const observedAt = 1_700_000_000;
const observedAtIso = "2023-11-14T22:13:20.000Z";
const privateEmail = "learner@example.test";
const privatePhone = "+20 100 000 0000";
const privateUrl = "https://private.example.test/profile";
const privateAddress = "12 Private Street";

const forbiddenProjectionKeys = new Set([
  "address",
  "city",
  "content",
  "customfields",
  "description",
  "email",
  "externalurl",
  "fileurl",
  "html",
  "intro",
  "overviewfiles",
  "parameters",
  "password",
  "phone1",
  "phone2",
  "plugins",
  "profileimageurl",
  "profileimageurlsmall",
  "responsefileareas",
  "subnet",
  "summary",
  "url",
]);

function projectionKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(projectionKeys);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...projectionKeys(child),
  ]);
}

function expectSanitizedProjection(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(privateEmail);
  expect(serialized).not.toContain(privatePhone);
  expect(serialized).not.toContain(privateUrl);
  expect(serialized).not.toContain(privateAddress);
  expect(serialized).not.toContain("<script");
  expect(serialized).not.toContain("<p>");
  expect(serialized).not.toContain("<b>");
  projectionKeys(value).forEach(key => {
    expect(forbiddenProjectionKeys.has(key)).toBe(false);
  });
}

describe("Moodle provider-neutral read models", () => {
  it("keeps safe identity and enrolment facts while dropping contact and profile data", () => {
    const identities = readModels.parseMoodleReadResponse(
      "core_user_get_users_by_field",
      [
        {
          id: 17,
          fullname: `<b>Practice Learner</b> ${privateEmail}`,
          firstname: "Practice",
          lastname: "Learner",
          suspended: 0,
          firstaccess: observedAt,
          lastaccess: observedAt,
          email: privateEmail,
          phone1: privatePhone,
          address: privateAddress,
          profileimageurl: privateUrl,
          customfields: [{ shortname: "passport", value: "private" }],
        },
      ]
    );

    expect(identities).toEqual([
      {
        sourceId: "17",
        displayName: "Practice Learner",
        active: true,
        firstSeenAt: observedAtIso,
        lastSeenAt: observedAtIso,
      },
    ]);

    const enrolledUsers = readModels.parseMoodleEnrolledUsersResponse([
      {
        id: 17,
        fullname: "Practice Learner",
        suspended: 0,
        firstaccess: observedAt,
        lastaccess: observedAt,
        email: privateEmail,
        phone2: privatePhone,
        profileimageurlsmall: privateUrl,
        roles: [
          {
            roleid: 5,
            name: "<b>Student</b>",
            shortname: "student",
          },
        ],
        groups: [
          {
            id: 31,
            courseid: 42,
            name: "Practice cohort",
            description: `<p>${privateAddress}</p>`,
            enrolmentkey: "must-not-survive",
          },
        ],
      },
    ]);

    expect(enrolledUsers).toEqual([
      {
        sourceUserId: "17",
        displayName: "Practice Learner",
        active: true,
        firstSeenAt: observedAtIso,
        lastSeenAt: observedAtIso,
        roles: [{ sourceId: "5", title: "Student" }],
        groups: [
          {
            sourceId: "31",
            courseSourceId: "42",
            title: "Practice cohort",
            createdAt: undefined,
            modifiedAt: undefined,
          },
        ],
      },
    ]);

    const userCourses = readModels.parseMoodleUserCoursesResponse([
      {
        id: 42,
        fullname: "Arabic Foundations",
        shortname: "AR-FND",
        hidden: 0,
        progress: 75.5,
        completed: 0,
        startdate: observedAt,
        enddate: 0,
        lastaccess: observedAt,
        summary: `<p>${privateEmail}</p>`,
        overviewfiles: [{ fileurl: privateUrl }],
      },
    ]);

    expect(userCourses).toEqual([
      {
        sourceCourseId: "42",
        title: "Arabic Foundations",
        shortTitle: "AR-FND",
        visible: true,
        progressPercent: 75.5,
        completed: false,
        startsAt: observedAtIso,
        endsAt: undefined,
        lastAccessAt: observedAtIso,
      },
    ]);
    expectSanitizedProjection([identities, enrolledUsers, userCourses]);
  });

  it("projects course categories, courses, sections, and modules without summaries or links", () => {
    const categories = readModels.parseMoodleCourseCategoriesResponse([
      {
        id: 4,
        parent: 0,
        name: "<b>Language</b>",
        visible: 1,
        depth: 1,
        description: `<p>${privateEmail}</p>`,
      },
    ]);
    const courses = readModels.parseMoodleCoursesResponse({
      courses: [
        {
          id: 42,
          categoryid: 4,
          fullname: "<b>Arabic Foundations</b>",
          shortname: "AR-FND",
          visible: 1,
          startdate: observedAt,
          enddate: 0,
          enablecompletion: 1,
          summary: `<script>private</script><p>${privateAddress}</p>`,
          courseimage: privateUrl,
          customfields: [{ shortname: "private", value: privatePhone }],
        },
      ],
      warnings: [],
    });
    const sections = readModels.parseMoodleCourseContentsResponse([
      {
        id: 7,
        section: 1,
        name: "Week 1",
        visible: 1,
        summary: `<p>${privateEmail}</p>`,
        modules: [
          {
            id: 81,
            instance: 91,
            modname: "page",
            name: "<b>Welcome</b>",
            visible: 1,
            completion: 2,
            url: privateUrl,
            contents: [
              {
                filename: "private.pdf",
                fileurl: privateUrl,
                author: privateEmail,
              },
            ],
          },
        ],
      },
    ]);
    const module = readModels.parseMoodleCourseModuleResponse({
      cm: {
        id: 81,
        instance: 91,
        course: 42,
        section: 7,
        sectionnum: 1,
        modname: "page",
        name: "Welcome",
        uservisible: true,
        completion: 2,
        url: privateUrl,
        content: `<p>${privateAddress}</p>`,
      },
      warnings: [],
    });

    expect(categories[0]).toEqual({
      sourceId: "4",
      parentSourceId: undefined,
      title: "Language",
      visible: true,
      depth: 1,
    });
    expect(courses[0]).toEqual({
      sourceId: "42",
      categorySourceId: "4",
      title: "Arabic Foundations",
      shortTitle: "AR-FND",
      visible: true,
      startsAt: observedAtIso,
      endsAt: undefined,
      completionTrackingEnabled: true,
    });
    expect(sections[0]).toEqual({
      sourceId: "7",
      position: 1,
      title: "Week 1",
      visible: true,
      activities: [
        {
          sourceId: "81",
          instanceSourceId: "91",
          type: "page",
          title: "Welcome",
          visible: true,
          completionTracking: "automatic",
        },
      ],
    });
    expect(module).toMatchObject({
      sourceId: "81",
      instanceSourceId: "91",
      courseSourceId: "42",
      sectionSourceId: "7",
      sectionPosition: 1,
      type: "page",
      title: "Welcome",
    });
    expectSanitizedProjection([categories, courses, sections, module]);
  });

  it("projects groups and groupings without descriptions, keys, or images", () => {
    const rawGroup = {
      id: 31,
      courseid: 42,
      name: "Cohort A",
      timecreated: observedAt,
      timemodified: observedAt,
      description: `<p>${privateAddress}</p>`,
      enrolmentkey: "secret-group-key",
      picture: privateUrl,
    };
    const groups = readModels.parseMoodleCourseGroupsResponse([rawGroup]);
    const groupings = readModels.parseMoodleCourseGroupingsResponse([
      {
        id: 61,
        courseid: 42,
        name: "Morning groups",
        timecreated: observedAt,
        timemodified: observedAt,
        description: `<p>${privateEmail}</p>`,
        configdata: privateUrl,
      },
    ]);
    const userGroups = readModels.parseMoodleCourseUserGroupsResponse({
      groups: [rawGroup],
      warnings: [],
    });

    expect(groups).toEqual([
      {
        sourceId: "31",
        courseSourceId: "42",
        title: "Cohort A",
        createdAt: observedAtIso,
        modifiedAt: observedAtIso,
      },
    ]);
    expect(groupings[0]).toMatchObject({
      sourceId: "61",
      courseSourceId: "42",
      title: "Morning groups",
    });
    expect(userGroups).toEqual(groups);
    expectSanitizedProjection([groups, groupings, userGroups]);
  });

  it("normalizes completion and grades while retaining only sanitized feedback text", () => {
    const activities = readModels.parseMoodleActivityCompletionResponse({
      statuses: [
        {
          cmid: 81,
          modname: "page",
          instance: 91,
          state: 2,
          timecompleted: observedAt,
          overrideby: 99,
          valueused: privateEmail,
        },
      ],
      warnings: [],
    });
    const course = readModels.parseMoodleCourseCompletionResponse({
      completionstatus: {
        completed: 1,
        aggregation: 1,
        completions: [
          {
            type: 4,
            title: "<b>Complete Welcome</b>",
            status: "Yes",
            complete: 1,
            timecompleted: observedAt,
            details: { description: privateAddress, url: privateUrl },
          },
        ],
      },
      warnings: [],
    });
    const grades = readModels.parseMoodleGradeItemsResponse({
      usergrades: [
        {
          courseid: 42,
          userid: 17,
          userfullname: `${privateEmail} ${privatePhone}`,
          gradeitems: [
            {
              id: 501,
              itemname: "<b>Practice quiz</b>",
              itemtype: "mod",
              itemmodule: "quiz",
              cmid: 82,
              iteminstance: 92,
              graderaw: 8.5,
              grademinraw: 0,
              grademaxraw: 10,
              locked: 0,
              feedback: `<p>Strong work. ${privateEmail} ${privatePhone} ${privateUrl}</p>`,
              feedbackformat: 1,
            },
          ],
        },
      ],
      warnings: [],
    });

    expect(activities).toEqual([
      {
        activitySourceId: "81",
        activityType: "page",
        activityInstanceSourceId: "91",
        state: "complete_pass",
        completedAt: observedAtIso,
      },
    ]);
    expect(course).toEqual({
      completed: true,
      criteria: [
        {
          title: "Complete Welcome",
          status: "Yes",
          completed: true,
          completedAt: observedAtIso,
        },
      ],
    });
    expect(grades).toEqual([
      {
        sourceCourseId: "42",
        sourceUserId: "17",
        items: [
          {
            sourceId: "501",
            title: "Practice quiz",
            kind: "mod",
            activityType: "quiz",
            activitySourceId: "82",
            activityInstanceSourceId: "92",
            score: 8.5,
            minimumScore: 0,
            maximumScore: 10,
            locked: false,
            feedbackText: "Strong work.",
          },
        ],
      },
    ]);
    expectSanitizedProjection([activities, course, grades]);
  });

  it("projects assignments, submissions, and grades without learner work payloads", () => {
    const assignments = readModels.parseMoodleAssignmentsResponse({
      courses: [
        {
          id: 42,
          fullname: "Arabic Foundations",
          shortname: "AR-FND",
          assignments: [
            {
              id: 101,
              cmid: 81,
              course: 42,
              name: "<b>Writing practice</b>",
              nosubmissions: 0,
              submissiondrafts: 1,
              teamsubmission: 0,
              completionsubmit: 1,
              grade: 100,
              allowsubmissionsfromdate: observedAt,
              duedate: observedAt,
              cutoffdate: 0,
              gradingduedate: observedAt,
              timemodified: observedAt,
              intro: `<p>${privateAddress} ${privateEmail}</p>`,
              introfiles: [{ fileurl: privateUrl }],
              configs: [{ name: "private", value: privatePhone }],
            },
          ],
        },
      ],
      warnings: [],
    });
    const submissions = readModels.parseMoodleAssignmentSubmissionsResponse({
      assignments: [
        {
          assignmentid: 101,
          submissions: [
            {
              id: 201,
              assignment: 101,
              userid: 17,
              attemptnumber: 0,
              status: "submitted",
              groupid: 0,
              timecreated: observedAt,
              timemodified: observedAt,
              latest: 1,
              gradingstatus: "graded",
              plugins: [
                {
                  type: "onlinetext",
                  editorfields: [
                    { text: `<p>${privateEmail} ${privateUrl}</p>` },
                  ],
                },
              ],
            },
          ],
        },
      ],
      warnings: [],
    });
    const grades = readModels.parseMoodleAssignmentGradesResponse({
      assignments: [
        {
          assignmentid: 101,
          grades: [
            {
              id: 301,
              assignment: 101,
              userid: 17,
              attemptnumber: 0,
              grade: "88.50000",
              timecreated: observedAt,
              timemodified: observedAt,
              grader: 99,
              feedback: `<p>${privateEmail}</p>`,
            },
          ],
        },
      ],
      warnings: [],
    });

    expect(assignments[0].assignments[0]).toMatchObject({
      sourceId: "101",
      activitySourceId: "81",
      courseSourceId: "42",
      title: "Writing practice",
      acceptsSubmissions: true,
      draftMode: true,
      teamSubmission: false,
      completionRequiresSubmission: true,
      maximumScore: 100,
    });
    expect(submissions).toEqual([
      {
        assignmentSourceId: "101",
        submissions: [
          {
            sourceId: "201",
            sourceUserId: "17",
            attempt: 0,
            status: "submitted",
            groupSourceId: undefined,
            createdAt: observedAtIso,
            modifiedAt: observedAtIso,
            latest: true,
            gradingStatus: "graded",
          },
        ],
      },
    ]);
    expect(grades[0].grades[0]).toEqual({
      sourceId: "301",
      sourceUserId: "17",
      attempt: 0,
      score: 88.5,
      createdAt: observedAtIso,
      modifiedAt: observedAtIso,
    });
    expectSanitizedProjection([assignments, submissions, grades]);
  });

  it("projects quizzes, attempts, and review marks without passwords or question HTML", () => {
    const quizzes = readModels.parseMoodleQuizzesResponse({
      quizzes: [
        {
          id: 102,
          coursemodule: 82,
          course: 42,
          name: "<b>Week 1 quiz</b>",
          timeopen: observedAt,
          timeclose: observedAt,
          timelimit: 900,
          attempts: 2,
          grade: 10,
          sumgrades: 12,
          hasquestions: 1,
          completionpass: 1,
          completionattemptsexhausted: 0,
          timemodified: observedAt,
          intro: `<p>${privateEmail}</p>`,
          password: "quiz-secret",
          subnet: privateAddress,
        },
      ],
      warnings: [],
    });
    const rawAttempt = {
      id: 401,
      quiz: 102,
      userid: 17,
      attempt: 1,
      state: "finished",
      preview: 0,
      sumgrades: "9.5",
      timestart: observedAt,
      timefinish: observedAt,
      timemodified: observedAt,
      uniqueid: privatePhone,
      layout: privateUrl,
    };
    const attempts = readModels.parseMoodleQuizAttemptsResponse({
      attempts: [rawAttempt],
      warnings: [],
    });
    const review = readModels.parseMoodleQuizReviewResponse({
      attempt: rawAttempt,
      grade: `<b>9.5 out of 10</b> ${privateUrl}`,
      questions: [
        {
          slot: 1,
          type: "multichoice",
          page: 0,
          state: "gradedright",
          status: "<b>Correct</b>",
          mark: "1.0",
          maxmark: 1,
          blocked: false,
          html: `<div>${privateEmail} ${privateAddress}</div>`,
          responsefileareas: [{ fileurl: privateUrl }],
          sequencecheck: privatePhone,
        },
      ],
      additionaldata: [{ id: "private", content: privateAddress }],
      warnings: [],
    });

    expect(quizzes[0]).toMatchObject({
      sourceId: "102",
      activitySourceId: "82",
      courseSourceId: "42",
      title: "Week 1 quiz",
      timeLimitSeconds: 900,
      attemptLimit: 2,
      maximumScore: 10,
      totalMarks: 12,
      hasQuestions: true,
    });
    expect(attempts[0]).toEqual({
      sourceId: "401",
      quizSourceId: "102",
      sourceUserId: "17",
      attempt: 1,
      state: "finished",
      preview: false,
      score: 9.5,
      startedAt: observedAtIso,
      finishedAt: observedAtIso,
      modifiedAt: observedAtIso,
    });
    expect(review).toEqual({
      attempt: attempts[0],
      gradeSummary: "9.5 out of 10",
      questions: [
        {
          slot: 1,
          type: "multichoice",
          page: 0,
          state: "gradedright",
          status: "Correct",
          mark: 1,
          maximumMark: 1,
          blocked: false,
        },
      ],
    });
    expectSanitizedProjection([quizzes, attempts, review]);
  });

  it("projects lessons, lesson grades, books, pages, and URL activities as metadata only", () => {
    const lessons = readModels.parseMoodleLessonsResponse({
      lessons: [
        {
          id: 103,
          coursemodule: 83,
          course: 42,
          name: "<b>Guided practice</b>",
          practice: 1,
          retake: 1,
          grade: 100,
          available: observedAt,
          deadline: observedAt,
          timelimit: 600,
          completionendreached: 1,
          completiontimespent: 300,
          timemodified: observedAt,
          intro: `<p>${privateAddress}</p>`,
          password: "lesson-secret",
          mediafile: privateUrl,
        },
      ],
      warnings: [],
    });
    const lessonGrade = readModels.parseMoodleLessonGradeResponse({
      grade: { lessonid: 103, userid: 17, grade: "91.25" },
      warnings: [],
    });
    const scalarLessonGrade = readModels.parseMoodleLessonGradeResponse({
      grade: 91.25,
      warnings: [],
    });
    const books = readModels.parseMoodleBooksResponse({
      books: [
        {
          id: 104,
          coursemodule: 84,
          course: 42,
          name: "<b>Reference book</b>",
          visible: 1,
          revision: 3,
          timecreated: observedAt,
          timemodified: observedAt,
          intro: `<p>${privateEmail}</p>`,
        },
      ],
      warnings: [],
    });
    const pages = readModels.parseMoodlePagesResponse({
      pages: [
        {
          id: 105,
          coursemodule: 85,
          course: 42,
          name: "Welcome page",
          uservisible: true,
          revision: 2,
          timemodified: observedAt,
          intro: `<p>${privateEmail}</p>`,
          content: `<script>private</script><p>${privateAddress}</p>`,
        },
      ],
      warnings: [],
    });
    const urls = readModels.parseMoodleUrlsResponse({
      urls: [
        {
          id: 106,
          coursemodule: 86,
          course: 42,
          name: "Conversation resource",
          visible: 1,
          timemodified: observedAt,
          intro: `<p>${privateEmail}</p>`,
          externalurl: privateUrl,
          parameters: [{ name: "user", value: privatePhone }],
        },
      ],
      warnings: [],
    });

    expect(lessons[0]).toMatchObject({
      sourceId: "103",
      activitySourceId: "83",
      courseSourceId: "42",
      title: "Guided practice",
      practice: true,
      retakesAllowed: true,
      maximumScore: 100,
      timeLimitSeconds: 600,
    });
    expect(lessonGrade).toEqual({
      lessonSourceId: "103",
      sourceUserId: "17",
      score: 91.25,
    });
    expect(scalarLessonGrade).toEqual({ score: 91.25 });
    expect(books[0]).toMatchObject({
      kind: "book",
      sourceId: "104",
      activitySourceId: "84",
      courseSourceId: "42",
      title: "Reference book",
    });
    expect(pages[0]).toMatchObject({
      kind: "page",
      sourceId: "105",
      title: "Welcome page",
      visible: true,
    });
    expect(urls[0]).toMatchObject({
      kind: "url",
      sourceId: "106",
      title: "Conversation resource",
      visible: true,
    });
    expectSanitizedProjection([
      lessons,
      lessonGrade,
      scalarLessonGrade,
      books,
      pages,
      urls,
    ]);
  });

  it("fails closed for malformed envelopes and bounded collection or text violations", () => {
    const malformedTopLevels = [
      () => readModels.parseMoodleIdentityResponse({}),
      () => readModels.parseMoodleCourseCategoriesResponse({}),
      () => readModels.parseMoodleCoursesResponse([]),
      () => readModels.parseMoodleCourseContentsResponse({}),
      () => readModels.parseMoodleCourseModuleResponse([]),
      () => readModels.parseMoodleEnrolledUsersResponse({}),
      () => readModels.parseMoodleUserCoursesResponse({}),
      () => readModels.parseMoodleCourseGroupsResponse({}),
      () => readModels.parseMoodleCourseGroupingsResponse({}),
      () => readModels.parseMoodleCourseUserGroupsResponse([]),
      () => readModels.parseMoodleActivityCompletionResponse([]),
      () => readModels.parseMoodleCourseCompletionResponse([]),
      () => readModels.parseMoodleGradeItemsResponse([]),
      () => readModels.parseMoodleAssignmentsResponse([]),
      () => readModels.parseMoodleAssignmentSubmissionsResponse([]),
      () => readModels.parseMoodleAssignmentGradesResponse([]),
      () => readModels.parseMoodleQuizzesResponse([]),
      () => readModels.parseMoodleQuizAttemptsResponse([]),
      () => readModels.parseMoodleQuizReviewResponse([]),
      () => readModels.parseMoodleLessonsResponse([]),
      () => readModels.parseMoodleLessonGradeResponse([]),
      () => readModels.parseMoodleBooksResponse([]),
      () => readModels.parseMoodlePagesResponse([]),
      () => readModels.parseMoodleUrlsResponse([]),
    ];

    malformedTopLevels.forEach(parse => {
      expect(parse).toThrowError(
        expect.objectContaining({
          name: "MoodleReadModelError",
          code: "invalid_response",
        })
      );
    });

    expect(() =>
      readModels.parseMoodleIdentityResponse(
        Array.from(
          { length: readModels.MOODLE_READ_MODEL_LIMITS.collectionItems + 1 },
          () => ({ id: 1, fullname: "Bounded learner" })
        )
      )
    ).toThrow(readModels.MoodleReadModelError);

    expect(() =>
      readModels.parseMoodleCoursesResponse({
        courses: [
          {
            id: 42,
            fullname: "x".repeat(
              readModels.MOODLE_READ_MODEL_LIMITS.titleCharacters + 1
            ),
            shortname: "AR-FND",
          },
        ],
      })
    ).toThrow(readModels.MoodleReadModelError);

    expect(() =>
      readModels.parseMoodleCourseContentsResponse([
        {
          id: 7,
          section: 1,
          modules: Array.from(
            { length: readModels.MOODLE_READ_MODEL_LIMITS.nestedItems + 1 },
            () => ({
              id: 81,
              instance: 91,
              modname: "page",
              name: "Welcome",
            })
          ),
        },
      ])
    ).toThrow(readModels.MoodleReadModelError);

    expect(() =>
      readModels.parseMoodleAssignmentGradesResponse({
        assignments: [
          {
            assignmentid: 101,
            grades: [
              {
                id: 301,
                assignment: 999,
                userid: 17,
                attemptnumber: 0,
                grade: 88,
              },
            ],
          },
        ],
      })
    ).toThrow(readModels.MoodleReadModelError);
  });
});
