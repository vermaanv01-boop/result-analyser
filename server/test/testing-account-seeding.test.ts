import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
} from "../src/config/seed-target";
import {
  DEFAULT_TESTING_PANEL_NAME,
  JUDGE_COUNT,
  PARTICIPANT_COUNT,
  ROTATION_LOGIN_IDS,
  TESTING_EMAIL_DOMAIN,
  TESTING_SEED_TOTAL_ACCOUNT_COUNT,
  TestingSeedConflictError,
  assertTestingSeedOptions,
  createTestingSeedDependencies,
  parseTestingSeedOptions,
  seedTestingAccounts,
  type CreateTestingPanelInput,
  type CreateTestingParticipantInput,
  type CreateTestingUserInput,
  type EligibilityRecord,
  type ParticipantRecord,
  type SeedUser,
  type TestingSeedDependencies,
  type TestingSeedOptions,
} from "../src/scripts/seed-testing-accounts";
import {
  generateUniquePasswords,
  PASSWORD_ALPHABETIC_COUNT,
  PASSWORD_DIGIT_COUNT,
  PASSWORD_LENGTH,
  PASSWORD_SPECIAL_CHARACTERS,
  PASSWORD_SPECIAL_COUNT,
} from "../src/scripts/rotate-admin-passwords";
import type { TestingAccountExport } from "../src/utils/credential-export";

const TESTING_URI = "mongodb://localhost:27017/venture_craft_testing";
const PRODUCTION_URI = "mongodb://localhost:27017/student_ranking";
const COMPETITION_ID = "507f1f77bcf86cd799439011";
const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

interface FakeUser extends SeedUser {
  passwordHash: string;
}

interface FakeIndex {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
}

interface FakeState {
  users: FakeUser[];
  panels: Array<{
    _id: unknown;
    competition: unknown;
    name: string;
    judges: unknown[];
    isActive: boolean;
  }>;
  participants: ParticipantRecord[];
  userIndexes: FakeIndex[];
  participantIndexes: FakeIndex[];
  competition: { _id: unknown; status: string } | null;
  logs: string[];
  events: string[];
  exports: TestingAccountExport[];
  createUserInputs: CreateTestingUserInput[];
  createPanelInputs: CreateTestingPanelInput[];
  createParticipantInputs: CreateTestingParticipantInput[];
  hashCalls: string[];
  generatedCounts: number[];
  connectedUri: string | null;
  disconnected: boolean;
}

function passwordFor(index: number): string {
  return `Abc${String(index).padStart(3, "0")}!`;
}

function expectedPasswords(): string[] {
  return Array.from(
    { length: TESTING_SEED_TOTAL_ACCOUNT_COUNT },
    (_, index) => passwordFor(index + 1),
  );
}

function expectedEligibility(): EligibilityRecord[] {
  return [
    {
      round: 1,
      eligible: true,
      ineligibleReason: null,
      updatedAt: FIXED_NOW,
    },
    {
      round: 2,
      eligible: true,
      ineligibleReason: null,
      updatedAt: FIXED_NOW,
    },
  ];
}

function newState(): FakeState {
  return {
    users: ROTATION_LOGIN_IDS.map((loginId, index) => ({
      _id: `admin-${index + 1}`,
      name: `Admin ${index + 1}`,
      email: `${loginId}@testing.venturecraft.invalid`,
      loginId,
      role: "admin",
      isActive: true,
      passwordHash: `admin-hash-${index + 1}`,
    })),
    panels: [],
    participants: [],
    userIndexes: [
      {
        name: "user_loginId_unique",
        key: { loginId: 1 },
        unique: true,
        sparse: true,
      },
      { name: "email_1", key: { email: 1 }, unique: true },
    ],
    participantIndexes: [
      {
        name: "participant_competition_registrationId",
        key: { competition: 1, registrationId: 1 },
        unique: true,
      },
    ],
    competition: { _id: COMPETITION_ID, status: "active" },
    logs: [],
    events: [],
    exports: [],
    createUserInputs: [],
    createPanelInputs: [],
    createParticipantInputs: [],
    hashCalls: [],
    generatedCounts: [],
    connectedUri: null,
    disconnected: false,
  };
}

function cloneUser(user: FakeUser): FakeUser {
  return { ...user };
}

function createFakeDependencies(
  state: FakeState,
  overrides: Partial<TestingSeedDependencies> = {},
): TestingSeedDependencies {
  const dependencies: TestingSeedDependencies = {
    connect: async (uri) => {
      state.connectedUri = uri;
      return { name: new URL(uri).pathname.replace(/^\//, "") };
    },
    disconnect: async () => {
      state.disconnected = true;
    },
    findCompetitionById: async () =>
      state.competition ? { ...state.competition } : null,
    listUserIndexes: async () =>
      state.userIndexes.map((index) => ({ ...index, key: { ...index.key } })),
    listParticipantIndexes: async () =>
      state.participantIndexes.map((index) => ({
        ...index,
        key: { ...index.key },
      })),
    createUserLoginIdIndex: async () => {
      state.events.push("index");
      state.userIndexes.push({
        name: "user_loginId_unique",
        key: { loginId: 1 },
        unique: true,
        sparse: true,
      });
    },
    createUserEmailIndex: async () => {
      state.events.push("index");
      state.userIndexes.push({
        name: "email_1",
        key: { email: 1 },
        unique: true,
      });
    },
    createParticipantRegistrationIdIndex: async () => {
      state.events.push("index");
      state.participantIndexes.push({
        name: "participant_competition_registrationId",
        key: { competition: 1, registrationId: 1 },
        unique: true,
      });
    },
    findAllUsersWithLoginId: async () =>
      state.users
        .filter((user) => user.loginId !== undefined)
        .map(cloneUser),
    findUsersByLoginIds: async (loginIds) =>
      state.users
        .filter(
          (user) =>
            typeof user.loginId === "string" && loginIds.includes(user.loginId),
        )
        .map(cloneUser),
    findUsersByEmails: async (emails) =>
      state.users.filter((user) => emails.includes(user.email)).map(cloneUser),
    findPanelsByCompetition: async () =>
      state.panels.map((panel) => ({
        ...panel,
        judges: [...panel.judges],
      })),
    findParticipantsByCompetition: async () =>
      state.participants.map((participant) => ({
        ...participant,
        teamMembers: [...participant.teamMembers],
        eligibility: participant.eligibility.map((entry) => ({ ...entry })),
      })),
    createUser: async (input) => {
      state.events.push("user");
      state.createUserInputs.push(input);
      const created: FakeUser = {
        _id: `created-user-${state.createUserInputs.length}`,
        name: input.name,
        email: input.email,
        loginId: input.loginId,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.passwordHash,
      };
      state.users.push(created);
      return cloneUser(created);
    },
    createPanel: async (input) => {
      state.events.push("panel");
      state.createPanelInputs.push(input);
      const panel = {
        _id: "created-panel-1",
        competition: input.competition,
        name: input.name,
        judges: [...input.judges],
        isActive: input.isActive,
      };
      state.panels.push(panel);
      return { ...panel, judges: [...panel.judges] };
    },
    createParticipant: async (input) => {
      state.events.push("participant");
      state.createParticipantInputs.push(input);
      const participant: ParticipantRecord = {
        _id: `created-participant-${state.createParticipantInputs.length}`,
        competition: input.competition,
        user: input.user,
        name: input.name,
        registrationId: input.registrationId,
        email: input.email,
        panel: input.panel,
        teamMembers: [...input.teamMembers],
        isActive: input.isActive,
        eligibility: input.eligibility.map((entry) => ({ ...entry })),
      };
      state.participants.push(participant);
      return participant;
    },
    hashPassword: async (password) => {
      state.hashCalls.push(password);
      return `hashed:${password}`;
    },
    generatePasswords: (count) => {
      state.generatedCounts.push(count);
      return expectedPasswords().slice(0, count);
    },
    writeExport: async (exportData) => {
      state.events.push("export");
      state.exports.push(exportData);
      return "/tmp/testing-accounts-credentials.json";
    },
    now: () => FIXED_NOW,
    logger: {
      info: (message) => {
        state.logs.push(message);
      },
    },
  };

  return Object.assign(dependencies, overrides);
}

function testingOptions(
  apply: boolean,
  args: readonly string[] = [],
): TestingSeedOptions {
  return parseTestingSeedOptions(
    [
      "--target",
      "testing",
      "--competition-id",
      COMPETITION_ID,
      ...args,
      ...(apply ? ["--apply"] : []),
    ],
    {
      TESTING_MONGODB_URI: TESTING_URI,
      MONGODB_URI: PRODUCTION_URI,
    },
  );
}

function assertPasswordShape(password: string): void {
  assert.equal(password.length, PASSWORD_LENGTH);
  assert.equal(
    [...password].filter((character) => /[A-Za-z]/.test(character)).length,
    PASSWORD_ALPHABETIC_COUNT,
  );
  assert.equal(
    [...password].filter((character) => /[0-9]/.test(character)).length,
    PASSWORD_DIGIT_COUNT,
  );
  assert.equal(
    [...password].filter((character) =>
      PASSWORD_SPECIAL_CHARACTERS.includes(character),
    ).length,
    PASSWORD_SPECIAL_COUNT,
  );
}

describe("testing seed configuration", () => {
  it("only accepts testing with a competition id and never falls back to MONGODB_URI", () => {
    const options = parseTestingSeedOptions(
      ["--target", "testing", "--competition-id", COMPETITION_ID],
      { TESTING_MONGODB_URI: TESTING_URI, MONGODB_URI: PRODUCTION_URI },
    );
    assert.equal(options.target, "testing");
    assert.equal(options.uri, TESTING_URI);
    assert.equal(options.databaseName, "venture_craft_testing");
    assert.equal(options.apply, false);
    assert.equal(options.panelName, DEFAULT_TESTING_PANEL_NAME);

    assert.throws(
      () => parseTestingSeedOptions(["--target", "testing"], {
        TESTING_MONGODB_URI: TESTING_URI,
      }),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("--competition-id is required"),
    );
    assert.throws(
      () =>
        parseTestingSeedOptions(
          ["--target", "testing", "--competition-id", COMPETITION_ID],
          { MONGODB_URI: PRODUCTION_URI },
        ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("TESTING_MONGODB_URI is required"),
    );
    assert.throws(
      () =>
        parseTestingSeedOptions(
          ["--target=production", "--competition-id", COMPETITION_ID, "--apply"],
          { PRODUCTION_MONGODB_URI: PRODUCTION_URI },
        ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("only allows --target testing"),
    );
    assert.throws(
      () =>
        parseTestingSeedOptions(
          ["--target", "testing", "--competition-id", "not-an-object-id"],
          { TESTING_MONGODB_URI: TESTING_URI },
        ),
      SeedConfigError,
    );
    assert.throws(
      () =>
        parseTestingSeedOptions(
          ["--target", "testing", "--competition-id", COMPETITION_ID],
          { TESTING_MONGODB_URI: PRODUCTION_URI },
        ),
      SeedConfigError,
    );
  });

  it("rejects production options before connecting", async () => {
    const state = newState();
    const productionOptions = {
      target: "production" as unknown as "testing",
      databaseName: "student_ranking",
      uri: PRODUCTION_URI,
      apply: true,
      competitionId: COMPETITION_ID,
      panelName: DEFAULT_TESTING_PANEL_NAME,
    };

    await assert.rejects(
      seedTestingAccounts(productionOptions, createFakeDependencies(state)),
      SeedConfigError,
    );
    assert.equal(state.connectedUri, null);
    assert.equal(state.events.length, 0);
  });

  it("validates target configuration without connecting", () => {
    assert.doesNotThrow(() =>
      assertTestingSeedOptions({
        target: "testing",
        databaseName: "venture_craft_testing",
        uri: TESTING_URI,
        apply: false,
        competitionId: COMPETITION_ID,
        panelName: DEFAULT_TESTING_PANEL_NAME,
      }),
    );
    assert.throws(
      () => databaseNameFromUri("http://localhost/venture_craft_testing"),
      SeedConfigError,
    );
    assert.doesNotThrow(() =>
      assertConnectedDatabaseName("venture_craft_testing", "venture_craft_testing"),
    );
    assert.throws(
      () => assertConnectedDatabaseName("student_ranking", "venture_craft_testing"),
      SeedConfigError,
    );
  });

  it("uses the existing cryptographically secure generator for 40 unique valid passwords", () => {
    const dependencies = createTestingSeedDependencies();
    const passwords = dependencies.generatePasswords(
      TESTING_SEED_TOTAL_ACCOUNT_COUNT,
    );
    assert.equal(passwords.length, TESTING_SEED_TOTAL_ACCOUNT_COUNT);
    assert.equal(new Set(passwords).size, TESTING_SEED_TOTAL_ACCOUNT_COUNT);
    for (const password of passwords) {
      assertPasswordShape(password);
    }
    assert.equal(typeof generateUniquePasswords, "function");
  });
});

describe("testing account seeding", () => {
  it("aborts when the connected database is not venture_craft_testing", async () => {
    const state = newState();

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(state, {
          connect: async () => ({ name: "student_ranking" }),
        }),
      ),
      SeedConfigError,
    );

    assert.equal(state.events.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("requires an active competition", async () => {
    const missingState = newState();
    missingState.competition = null;
    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(missingState),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("Competition was not found"),
    );
    assert.equal(missingState.events.length, 0);

    const inactiveState = newState();
    if (inactiveState.competition) {
      inactiveState.competition.status = "completed";
    }
    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(inactiveState),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("Competition must be active"),
    );
    assert.equal(inactiveState.events.length, 0);
  });

  it("dry-run performs no writes, password generation, hashing, or export", async () => {
    const state = newState();
    state.userIndexes = [];
    state.participantIndexes = [];

    const result = await seedTestingAccounts(
      testingOptions(false),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, false);
    assert.equal(result.exportPath, null);
    assert.deepEqual(result.createdParticipantLoginIds, []);
    assert.deepEqual(result.createdJudgeLoginIds, []);
    assert.equal(state.generatedCounts.length, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.events.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.createUserInputs.length, 0);
    assert.equal(state.createPanelInputs.length, 0);
    assert.equal(state.createParticipantInputs.length, 0);
    assert.equal(state.userIndexes.length, 0);
    assert.equal(state.participantIndexes.length, 0);
    assert.equal(state.disconnected, true);
    assert.ok(
      state.logs.some((line) =>
        line.includes(
          `would create ${PARTICIPANT_COUNT} participants, ${JUDGE_COUNT} judges, and 1 panel`,
        ),
      ),
    );
    assert.ok(
      state.logs.some((line) => line.includes("Would create missing index")),
    );
  });

  it("creates exactly 30 participants and 10 judges with correct roles and credentials", async () => {
    const state = newState();
    const adminHashes = state.users.map((user) => user.passwordHash);

    const result = await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(result.panelCreated, true);
    assert.equal(result.createdParticipantLoginIds.length, PARTICIPANT_COUNT);
    assert.equal(result.createdJudgeLoginIds.length, JUDGE_COUNT);
    assert.equal(state.createUserInputs.length, TESTING_SEED_TOTAL_ACCOUNT_COUNT);
    assert.equal(state.createPanelInputs.length, 1);
    assert.equal(state.createParticipantInputs.length, PARTICIPANT_COUNT);
    assert.deepEqual(state.generatedCounts, [TESTING_SEED_TOTAL_ACCOUNT_COUNT]);
    assert.equal(state.hashCalls.length, TESTING_SEED_TOTAL_ACCOUNT_COUNT);
    assert.equal(new Set(state.hashCalls).size, TESTING_SEED_TOTAL_ACCOUNT_COUNT);
    assert.equal(state.exports.length, 1);
    assert.equal(state.disconnected, true);

    assert.equal(state.events[0], "export");
    assert.ok(state.events.indexOf("panel") > state.events.indexOf("export"));
    assert.ok(
      state.events.indexOf("participant") > state.events.indexOf("panel"),
    );

    const judges = state.createUserInputs.filter(
      (input) => input.role === "judge",
    );
    const participants = state.createUserInputs.filter(
      (input) => input.role === "participant",
    );
    assert.equal(judges.length, JUDGE_COUNT);
    assert.equal(participants.length, PARTICIPANT_COUNT);

    for (let index = 1; index <= PARTICIPANT_COUNT; index += 1) {
      const loginId = `test-team-${String(index).padStart(3, "0")}`;
      assert.ok(participants.some((input) => input.loginId === loginId));
      assert.ok(
        state.createParticipantInputs.some(
          (input) =>
            input.registrationId === `TEST-TEAM-${String(index).padStart(3, "0")}` &&
            input.user ===
              state.users.find((user) => user.loginId === loginId)?._id,
        ),
      );
    }
    for (let index = 1; index <= JUDGE_COUNT; index += 1) {
      const loginId = `test-jdg-${String(index).padStart(3, "0")}`;
      assert.ok(judges.some((input) => input.loginId === loginId));
    }
    assert.ok(
      state.createUserInputs.every((input) =>
        input.email.endsWith(`@${TESTING_EMAIL_DOMAIN}`),
      ),
    );
    assert.equal(new Set(state.createUserInputs.map((input) => input.email)).size, 40);

    for (const participant of state.createParticipantInputs) {
      assert.equal(participant.competition, COMPETITION_ID);
      assert.equal(
        participant.name,
        participant.registrationId.replace("TEST-TEAM-", "TEST Team "),
      );
      assert.equal(participant.email, `${participant.registrationId.toLowerCase()}@${TESTING_EMAIL_DOMAIN}`);
      assert.equal(participant.panel, "created-panel-1");
      assert.deepEqual(participant.teamMembers, []);
      assert.equal(participant.isActive, true);
      assert.deepEqual(participant.eligibility, expectedEligibility());
    }

    const panelInput = state.createPanelInputs[0];
    assert.ok(panelInput);
    assert.equal(panelInput.judges.length, JUDGE_COUNT);
    assert.equal(panelInput.isActive, true);

    const credentialExport = state.exports[0];
    assert.ok(credentialExport);
    assert.equal(credentialExport.target, "testing");
    assert.equal(credentialExport.databaseName, "venture_craft_testing");
    assert.equal(credentialExport.competitionId, COMPETITION_ID);
    assert.equal(credentialExport.panelName, DEFAULT_TESTING_PANEL_NAME);
    assert.equal(credentialExport.accounts.length, 40);
    assert.equal(
      credentialExport.accounts.filter((account) => account.role === "judge")
        .length,
      JUDGE_COUNT,
    );
    assert.equal(
      credentialExport.accounts.filter(
        (account) => account.role === "participant",
      ).length,
      PARTICIPANT_COUNT,
    );
    assert.equal(
      new Set(credentialExport.accounts.map((account) => account.password)).size,
      40,
    );
    for (const account of credentialExport.accounts) {
      assertPasswordShape(account.password);
      assert.equal(account.isActive, true);
      assert.equal(account.passwordStatus, "created");
    }

    const passwords = expectedPasswords();
    assert.deepEqual(state.hashCalls, passwords);
    assert.deepEqual(
      credentialExport.accounts.map((account) => account.password),
      passwords,
    );

    assert.deepEqual(
      state.users.slice(0, adminHashes.length).map((user) => user.passwordHash),
      adminHashes,
    );
    assert.ok(
      state.createUserInputs.every(
        (input) =>
          !(ROTATION_LOGIN_IDS as readonly string[]).includes(input.loginId),
      ),
    );
  });

  it("does not expose passwords, hashes, JWTs, or URIs in logs", async () => {
    const state = newState();

    await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );

    const joinedLogs = state.logs.join("\n");
    for (const password of expectedPasswords()) {
      assert.ok(!joinedLogs.includes(password));
    }
    assert.ok(!joinedLogs.includes("hashed:"));
    assert.ok(!joinedLogs.includes("eyJ"));
    assert.ok(!joinedLogs.includes(TESTING_URI));
    assert.ok(!joinedLogs.includes(PRODUCTION_URI));
  });

  it("is idempotent on reruns", async () => {
    const state = newState();
    const dependencies = createFakeDependencies(state);

    const first = await seedTestingAccounts(testingOptions(true), dependencies);
    const counts = {
      users: state.createUserInputs.length,
      panels: state.createPanelInputs.length,
      participants: state.createParticipantInputs.length,
      exports: state.exports.length,
      hashes: state.hashCalls.length,
      generationCalls: state.generatedCounts.length,
    };

    const second = await seedTestingAccounts(testingOptions(true), dependencies);

    assert.equal(first.applied, true);
    assert.equal(second.applied, true);
    assert.equal(second.exportPath, null);
    assert.equal(second.panelCreated, false);
    assert.deepEqual(second.createdParticipantLoginIds, []);
    assert.deepEqual(second.createdJudgeLoginIds, []);
    assert.equal(state.createUserInputs.length, counts.users);
    assert.equal(state.createPanelInputs.length, counts.panels);
    assert.equal(state.createParticipantInputs.length, counts.participants);
    assert.equal(state.exports.length, counts.exports);
    assert.equal(state.hashCalls.length, counts.hashes);
    assert.equal(state.generatedCounts.length, counts.generationCalls);
    assert.ok(
      state.logs.some((line) => line.includes("Already up to date")),
    );
  });

  it("creates required indexes after export when they are missing", async () => {
    const state = newState();
    state.userIndexes = [];
    state.participantIndexes = [];

    await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(state.events[0], "export");
    assert.ok(state.events.includes("index"));
    assert.ok(
      state.userIndexes.some(
        (index) =>
          index.key["loginId"] === 1 &&
          index.unique === true &&
          index.sparse === true,
      ),
    );
    assert.ok(
      state.userIndexes.some(
        (index) => index.key["email"] === 1 && index.unique === true,
      ),
    );
    assert.ok(
      state.participantIndexes.some(
        (index) =>
          index.key["competition"] === 1 &&
          index.key["registrationId"] === 1 &&
          index.unique === true,
      ),
    );
  });

  it("prevents database writes when credential export fails", async () => {
    const state = newState();

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(state, {
          writeExport: async () => {
            throw new Error("export failed");
          },
        }),
      ),
      /export failed/,
    );

    assert.equal(state.generatedCounts.length, 1);
    assert.ok(!state.events.includes("user"));
    assert.ok(!state.events.includes("panel"));
    assert.ok(!state.events.includes("participant"));
    assert.ok(!state.events.includes("index"));
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.createUserInputs.length, 0);
    assert.equal(state.createPanelInputs.length, 0);
    assert.equal(state.createParticipantInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("aborts on duplicate target login IDs before writing", async () => {
    const state = newState();
    state.users.push({
      _id: "duplicate-login-1",
      name: "Duplicate One",
      email: "duplicate-one@testing.venturecraft.invalid",
      loginId: "test-jdg-001",
      role: "judge",
      isActive: true,
      passwordHash: "duplicate-hash-1",
    });
    state.users.push({
      _id: "duplicate-login-2",
      name: "Duplicate Two",
      email: "duplicate-two@testing.venturecraft.invalid",
      loginId: "test-jdg-001",
      role: "judge",
      isActive: true,
      passwordHash: "duplicate-hash-2",
    });

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("Duplicate loginId found"),
    );

    assert.equal(state.events.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("aborts when a target email belongs to another account", async () => {
    const state = newState();
    state.users.push({
      _id: "email-conflict",
      name: "Other",
      email: `test-team-001@${TESTING_EMAIL_DOMAIN}`,
      loginId: "other-account",
      role: "participant",
      isActive: true,
      passwordHash: "other-hash",
    });

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("is already used by another account"),
    );

    assert.equal(state.events.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.hashCalls.length, 0);
  });

  it("aborts on partial user or participant state without modifying data", async () => {
    const partialUserState = newState();
    partialUserState.users.push({
      _id: "partial-user",
      name: "TEST Team 001",
      email: `test-team-001@${TESTING_EMAIL_DOMAIN}`,
      loginId: "test-team-001",
      role: "participant",
      isActive: true,
      passwordHash: "partial-hash",
    });

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(partialUserState),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("Partial testing account state detected"),
    );
    assert.equal(partialUserState.events.length, 0);
    assert.equal(partialUserState.exports.length, 0);

    const state = newState();
    await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );
    const participant = state.participants[0];
    assert.ok(participant);
    participant.panel = "different-panel";

    await assert.rejects(
      seedTestingAccounts(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("conflicting panel assignment"),
    );
    assert.equal(participant.panel, "different-panel");
    assert.equal(state.exports.length, 1);
    assert.equal(state.createParticipantInputs.length, PARTICIPANT_COUNT);
  });

  it("never overwrites existing panels or judge assignments", async () => {
    const conflictingState = newState();
    conflictingState.panels.push({
      _id: "other-panel",
      competition: COMPETITION_ID,
      name: "Existing Panel",
      judges: ["test-jdg-001"],
      isActive: true,
    });

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(conflictingState),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("refusing to change judge assignments"),
    );
    assert.equal(conflictingState.createPanelInputs.length, 0);
    assert.equal(conflictingState.events.length, 0);

    const state = newState();
    await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );
    const panel = state.panels[0];
    assert.ok(panel);
    panel.judges = [...panel.judges, "extra-judge"];

    await assert.rejects(
      seedTestingAccounts(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("conflicting judge assignments"),
    );
    assert.equal(state.createPanelInputs.length, 1);
    assert.equal(state.exports.length, 1);
  });

  it("reuses a safe configured panel on reruns", async () => {
    const state = newState();
    await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );
    const panel = state.panels[0];
    assert.ok(panel);
    assert.equal(panel.name, DEFAULT_TESTING_PANEL_NAME);

    const result = await seedTestingAccounts(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(result.panelCreated, false);
    assert.equal(state.createPanelInputs.length, 1);
  });

  it("aborts when an existing index is incompatible", async () => {
    const state = newState();
    state.userIndexes = [
      { name: "login_1", key: { loginId: 1 }, unique: false },
      { name: "email_1", key: { email: 1 }, unique: true },
    ];

    await assert.rejects(
      seedTestingAccounts(
        testingOptions(true),
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof TestingSeedConflictError &&
        error.message.includes("not a unique sparse single-field index"),
    );

    assert.equal(state.events.length, 0);
    assert.equal(state.exports.length, 0);
  });
});
