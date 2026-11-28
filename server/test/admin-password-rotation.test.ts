import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, mock } from "node:test";
import {
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
} from "../src/config/seed-target";
import {
  PASSWORD_ALPHABET,
  PASSWORD_ALPHABETIC_COUNT,
  PASSWORD_DIGITS,
  PASSWORD_DIGIT_COUNT,
  PASSWORD_LENGTH,
  PASSWORD_SPECIAL_CHARACTERS,
  PASSWORD_SPECIAL_COUNT,
  PRODUCTION_ROTATION_CONFIRMATION,
  ROTATION_LOGIN_IDS,
  RotationConflictError,
  generatePassword,
  generateUniquePasswords,
  parseRotationOptions,
  rotateAdminPasswords,
  type RandomInt,
  type RotationDependencies,
  type RotationLoginId,
  type RotationOptions,
  type RotationUser,
} from "../src/scripts/rotate-admin-passwords";
import {
  writePasswordRotationExport,
  type PasswordRotationExport,
} from "../src/utils/credential-export";

const TESTING_DB = "venture_craft_testing";
const PRODUCTION_DB = "student_ranking";
const TESTING_URI = `mongodb://localhost:27017/${TESTING_DB}`;
const PRODUCTION_URI = `mongodb://localhost:27017/${PRODUCTION_DB}`;

interface FakeUser extends RotationUser {
  passwordHash: string;
  fullName: string;
  createdAt: Date;
}

interface FakeState {
  users: FakeUser[];
  logs: string[];
  hashCalls: string[];
  randomCalls: number;
  findCalls: number;
  exportData: PasswordRotationExport | null;
  exportPath: string;
  updates: Array<{ id: unknown; loginId: string; passwordHash: string }>;
  connectedUri: string | null;
  connectedDatabaseName: string | null;
  disconnected: boolean;
  failExport: Error | null;
  failUpdateAt: number | null;
}

function env(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    TESTING_MONGODB_URI: TESTING_URI,
    PRODUCTION_MONGODB_URI: PRODUCTION_URI,
    ...overrides,
  };
}

function cloneUser(user: FakeUser): FakeUser {
  return { ...user, createdAt: new Date(user.createdAt.getTime()) };
}

function newState(): FakeState {
  return {
    users: [],
    logs: [],
    hashCalls: [],
    randomCalls: 0,
    findCalls: 0,
    exportData: null,
    exportPath: "/tmp/admin-password-rotation-testing.json",
    updates: [],
    connectedUri: null,
    connectedDatabaseName: null,
    disconnected: false,
    failExport: null,
    failUpdateAt: null,
  };
}

function userEmail(loginId: RotationLoginId): string {
  return loginId === "vc-admin"
    ? "admin@karvaan.org"
    : `${loginId}@testing.venturecraft.invalid`;
}

function makeUser(loginId: RotationLoginId): FakeUser {
  return {
    _id: `id-${loginId}`,
    loginId,
    email: userEmail(loginId),
    role: "admin",
    isActive: true,
    passwordHash: `old-hash-${loginId}`,
    fullName: `${loginId} Admin`,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

function makeNonAdminUsers(): FakeUser[] {
  return [
    {
      _id: "id-vc-judge",
      loginId: "vc-judge",
      email: "judge@testing.venturecraft.invalid",
      role: "judge",
      isActive: true,
      passwordHash: "old-hash-judge",
      fullName: "Test Judge",
      createdAt: new Date("2025-02-01T00:00:00.000Z"),
    },
    {
      _id: "id-vc-participant",
      loginId: "vc-participant",
      email: "participant@testing.venturecraft.invalid",
      role: "participant",
      isActive: true,
      passwordHash: "old-hash-participant",
      fullName: "Test Participant",
      createdAt: new Date("2025-03-01T00:00:00.000Z"),
    },
  ];
}

function seedAllAccounts(state: FakeState): void {
  state.users.push(...ROTATION_LOGIN_IDS.map(makeUser));
}

function seedNonAdminAccounts(state: FakeState): void {
  state.users.push(...makeNonAdminUsers());
}

function getUser(state: FakeState, loginId: string): FakeUser {
  const user = state.users.find((candidate) => candidate.loginId === loginId);
  if (!user) {
    throw new Error(`Missing fake user ${loginId}`);
  }
  return user;
}

function snapshotUsers(state: FakeState): FakeUser[] {
  return state.users.map(cloneUser);
}

function sequentialRandom(start: number = 0): RandomInt {
  let cursor = start;
  return (maxExclusive: number): number => {
    const value = cursor % maxExclusive;
    cursor += 1;
    return value;
  };
}

function createFakeDependencies(
  state: FakeState,
  overrides: Partial<RotationDependencies> = {},
): RotationDependencies {
  const dependencies: RotationDependencies = {
    connect: async (uri) => {
      state.connectedUri = uri;
      return {
        name: state.connectedDatabaseName ?? databaseNameFromUri(uri),
      };
    },
    disconnect: async () => {
      state.disconnected = true;
    },
    findRotationAccounts: async (loginIds) => {
      state.findCalls += 1;
      return state.users
        .filter((user) => loginIds.includes(user.loginId as RotationLoginId))
        .map(cloneUser);
    },
    hashPassword: async (password) => {
      state.hashCalls.push(password);
      return `hashed:${password}`;
    },
    randomInt: (maxExclusive) => {
      state.randomCalls += 1;
      return sequentialRandom(state.randomCalls - 1)(maxExclusive);
    },
    writeExport: async (exportData) => {
      if (state.failExport) {
        throw state.failExport;
      }
      state.exportData = exportData;
      return state.exportPath;
    },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    updatePassword: async ({ id, loginId, passwordHash }) => {
      if (
        state.failUpdateAt !== null &&
        state.updates.length === state.failUpdateAt
      ) {
        throw new Error("Simulated database update failure");
      }
      const user = state.users.find(
        (candidate) =>
          String(candidate._id) === String(id) && candidate.loginId === loginId,
      );
      if (!user) {
        throw new Error(`Missing fake user for update ${loginId}`);
      }
      user.passwordHash = passwordHash;
      state.updates.push({ id, loginId, passwordHash });
    },
    logger: {
      info: (message) => {
        state.logs.push(message);
      },
    },
  };

  return Object.assign(dependencies, overrides);
}

function testingOptions(apply: boolean = false): RotationOptions {
  return parseRotationOptions(
    apply ? ["--target", "testing", "--apply"] : ["--target", "testing"],
    env(),
  );
}

function productionOptions(apply: boolean = false): RotationOptions {
  const args = apply
    ? ["--target", "production", "--apply", "--confirm", PRODUCTION_ROTATION_CONFIRMATION]
    : ["--target", "production", "--confirm", PRODUCTION_ROTATION_CONFIRMATION];
  return parseRotationOptions(args, env());
}

function assertPasswordFormat(password: string): void {
  assert.equal([...password].length, PASSWORD_LENGTH);
  assert.equal(
    (password.match(/[A-Za-z]/g) ?? []).length,
    PASSWORD_ALPHABETIC_COUNT,
  );
  assert.equal((password.match(/[0-9]/g) ?? []).length, PASSWORD_DIGIT_COUNT);
  assert.equal(
    (password.match(/[^A-Za-z0-9]/g) ?? []).length,
    PASSWORD_SPECIAL_COUNT,
  );
  assert.ok(
    [...password].every(
      (character) =>
        PASSWORD_ALPHABET.includes(character) ||
        PASSWORD_DIGITS.includes(character) ||
        PASSWORD_SPECIAL_CHARACTERS.includes(character),
    ),
  );
}

function assertNoSecretsLogged(state: FakeState, passwords: readonly string[]): void {
  const secrets = [...passwords, ...state.hashCalls];
  for (const secret of secrets) {
    assert.ok(
      state.logs.every((line) => !line.includes(secret)),
      "A password or hash was written to the log",
    );
  }
  assert.ok(state.logs.every((line) => !line.includes("eyJ")));
}

describe("password format", () => {
  it("generates exactly three letters, three digits, and one special character", () => {
    const passwords = Array.from({ length: 25 }, (_, index) =>
      generatePassword(sequentialRandom(index * 7)),
    );

    for (const password of passwords) {
      assertPasswordFormat(password);
    }
  });

  it("randomizes character positions", () => {
    let calls = 0;
    const identityShuffle: RandomInt = (maxExclusive) => {
      const value = calls < PASSWORD_LENGTH ? 0 : maxExclusive - 1;
      calls += 1;
      return value;
    };

    const grouped = generatePassword(identityShuffle);
    const reversed = generatePassword(() => 0);

    assertPasswordFormat(grouped);
    assertPasswordFormat(reversed);
    assert.match(grouped, /^[A-Za-z]{3}[0-9]{3}[^A-Za-z0-9]$/);
    assert.doesNotMatch(reversed, /^[A-Za-z]{3}[0-9]{3}[^A-Za-z0-9]$/);
    assert.ok(
      PASSWORD_SPECIAL_CHARACTERS.includes(
        reversed[PASSWORD_LENGTH - 2] ?? "",
      ),
    );
    assert.notEqual(grouped, reversed);
  });

  it("uses node:crypto.randomInt instead of Math.random by default", () => {
    const requestedMaximums: number[] = [];
    const randomSpy = mock.method(crypto, "randomInt", (maxExclusive: number) => {
      requestedMaximums.push(maxExclusive);
      return 0;
    });
    let mathCalls = 0;
    const mathSpy = mock.method(Math, "random", () => {
      mathCalls += 1;
      return 0.5;
    });

    try {
      const password = generatePassword();
      assertPasswordFormat(password);
      assert.equal(
        randomSpy.mock.callCount(),
        PASSWORD_LENGTH + PASSWORD_LENGTH - 1,
      );
      assert.equal(mathCalls, 0);
      assert.deepEqual(requestedMaximums, [
        ...Array(PASSWORD_ALPHABETIC_COUNT).fill(PASSWORD_ALPHABET.length),
        ...Array(PASSWORD_DIGIT_COUNT).fill(PASSWORD_DIGITS.length),
        ...Array(PASSWORD_SPECIAL_COUNT).fill(
          PASSWORD_SPECIAL_CHARACTERS.length,
        ),
        ...Array.from(
          { length: PASSWORD_LENGTH - 1 },
          (_, index) => PASSWORD_LENGTH - index,
        ),
      ]);
    } finally {
      randomSpy.mock.restore();
      mathSpy.mock.restore();
    }
  });

  it("generates seven unique passwords", () => {
    const passwords = generateUniquePasswords(
      ROTATION_LOGIN_IDS.length,
      sequentialRandom(),
    );

    assert.equal(passwords.length, ROTATION_LOGIN_IDS.length);
    assert.equal(new Set(passwords).size, ROTATION_LOGIN_IDS.length);
    for (const password of passwords) {
      assertPasswordFormat(password);
    }
  });

  it("aborts when unique passwords cannot be generated", () => {
    assert.throws(
      () => generateUniquePasswords(ROTATION_LOGIN_IDS.length, () => 0),
      (error: unknown) =>
        error instanceof RotationConflictError &&
        error.message.includes("Unable to generate unique admin passwords"),
    );
  });
});

describe("target selection and isolation", () => {
  it("requires an explicit --target and never falls back to MONGODB_URI", () => {
    for (const args of [[], ["--apply"], ["--target="], ["--target", "staging"]]) {
      assert.throws(
        () => parseRotationOptions(args, env()),
        (error: unknown) =>
          error instanceof SeedConfigError &&
          error.message.includes("--target must be either testing or production"),
      );
    }

    const testing = parseRotationOptions(
      ["--target", "testing"],
      env({ MONGODB_URI: PRODUCTION_URI }),
    );
    assert.equal(testing.target, "testing");
    assert.equal(testing.databaseName, TESTING_DB);
    assert.equal(testing.uri, TESTING_URI);
    assert.equal(testing.apply, false);

    assert.throws(
      () =>
        parseRotationOptions(
          ["--target", "testing"],
          env({ TESTING_MONGODB_URI: undefined, MONGODB_URI: TESTING_URI }),
        ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("TESTING_MONGODB_URI is required"),
    );

    assert.throws(
      () =>
        parseRotationOptions(
          [
            "--target",
            "production",
            "--confirm",
            PRODUCTION_ROTATION_CONFIRMATION,
          ],
          env({ PRODUCTION_MONGODB_URI: undefined, MONGODB_URI: PRODUCTION_URI }),
        ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("PRODUCTION_MONGODB_URI is required"),
    );
  });

  it("never lets the testing target connect to production", async () => {
    assert.throws(
      () =>
        parseRotationOptions(
          ["--target", "testing"],
          env({ TESTING_MONGODB_URI: PRODUCTION_URI }),
        ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(`TESTING_MONGODB_URI must target ${TESTING_DB}`),
    );

    const state = newState();
    seedAllAccounts(state);

    await assert.rejects(
      rotateAdminPasswords(
        { ...testingOptions(true), uri: PRODUCTION_URI },
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(`TESTING_MONGODB_URI must target ${TESTING_DB}`),
    );
    assert.equal(state.connectedUri, null);

    state.connectedDatabaseName = PRODUCTION_DB;
    await assert.rejects(
      rotateAdminPasswords(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(
          `Connected database ${PRODUCTION_DB} does not match expected ${TESTING_DB}`,
        ),
    );
    assert.equal(state.connectedUri, TESTING_URI);
    assert.equal(state.findCalls, 0);
    assert.equal(state.randomCalls, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("never lets the production target connect to testing", async () => {
    assert.throws(
      () =>
        parseRotationOptions(
          [
            "--target",
            "production",
            "--confirm",
            PRODUCTION_ROTATION_CONFIRMATION,
          ],
          env({ PRODUCTION_MONGODB_URI: TESTING_URI }),
        ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(`PRODUCTION_MONGODB_URI must target ${PRODUCTION_DB}`),
    );

    const state = newState();
    seedAllAccounts(state);

    await assert.rejects(
      rotateAdminPasswords(
        { ...productionOptions(true), uri: TESTING_URI },
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(`PRODUCTION_MONGODB_URI must target ${PRODUCTION_DB}`),
    );
    assert.equal(state.connectedUri, null);

    state.connectedDatabaseName = TESTING_DB;
    await assert.rejects(
      rotateAdminPasswords(productionOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(
          `Connected database ${TESTING_DB} does not match expected ${PRODUCTION_DB}`,
        ),
    );
    assert.equal(state.findCalls, 0);
    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("requires the exact production confirmation phrase", async () => {
    const rejectedArguments = [
      ["--target", "production", "--apply"],
      ["--target", "production"],
      [
        "--target",
        "production",
        "--apply",
        "--confirm",
        "SEED PRODUCTION ADMINS",
      ],
      [
        "--target",
        "production",
        "--apply",
        "--confirm",
        "rotate production admin passwords",
      ],
      [
        "--target",
        "production",
        "--apply",
        "--confirm",
        "ROTATE PRODUCTION ADMIN PASSWORDS ",
      ],
    ];

    for (const args of rejectedArguments) {
      assert.throws(
        () => parseRotationOptions(args, env()),
        (error: unknown) =>
          error instanceof SeedConfigError &&
          error.message.includes(
            `Production password rotation requires --confirm "${PRODUCTION_ROTATION_CONFIRMATION}"`,
          ),
      );
    }

    const options = parseRotationOptions(
      ["--target", "production", "--apply", "--confirm", PRODUCTION_ROTATION_CONFIRMATION],
      env(),
    );
    assert.equal(options.confirmation, PRODUCTION_ROTATION_CONFIRMATION);
    assert.equal(options.apply, true);

    const state = newState();
    seedAllAccounts(state);
    await assert.rejects(
      rotateAdminPasswords(
        {
          target: "production",
          databaseName: PRODUCTION_DB,
          uri: PRODUCTION_URI,
          apply: true,
          confirmation: undefined,
        },
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("Production password rotation requires --confirm"),
    );
    assert.equal(state.connectedUri, null);
    assert.equal(state.updates.length, 0);
  });

  it("rejects unknown, duplicate, and incomplete arguments", () => {
    assert.throws(
      () => parseRotationOptions(["--dry-run"], env()),
      (error: unknown) => error instanceof SeedConfigError && error.message.includes("Unknown argument"),
    );
    assert.throws(
      () => parseRotationOptions(["--target", "testing", "--target", "production"], env()),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("--target was provided more than once"),
    );
    assert.throws(
      () => parseRotationOptions(["--target", "testing", "--apply", "--apply"], env()),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("--apply was provided more than once"),
    );
    assert.throws(
      () => parseRotationOptions(["--target"], env()),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("--target requires a value"),
    );
    assert.throws(
      () => parseRotationOptions(["--target", "testing", "--confirm"], env()),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("--confirm requires a value"),
    );
  });
});

describe("admin password rotation", () => {
  it("dry-runs validation without generating, exporting, or updating", async () => {
    const state = newState();
    seedAllAccounts(state);
    seedNonAdminAccounts(state);
    const before = snapshotUsers(state);

    const result = await rotateAdminPasswords(
      testingOptions(false),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, false);
    assert.deepEqual(result.rotatedLoginIds, []);
    assert.equal(result.exportPath, null);
    assert.equal(state.connectedUri, TESTING_URI);
    assert.equal(state.findCalls, 1);
    assert.equal(state.randomCalls, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
    assert.equal(state.disconnected, true);
    assert.deepEqual(state.users, before);
    assert.ok(
      state.logs.some((line) =>
        line.includes(`Dry run: ${ROTATION_LOGIN_IDS.length} admin accounts validated`),
      ),
    );
  });

  it("dry-runs production validation without generating, exporting, or updating", async () => {
    const state = newState();
    seedAllAccounts(state);
    const before = snapshotUsers(state);

    const result = await rotateAdminPasswords(
      productionOptions(false),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, false);
    assert.equal(state.connectedUri, PRODUCTION_URI);
    assert.equal(state.randomCalls, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
    assert.deepEqual(state.users, before);
  });

  it("aborts account validation failures before any write", async () => {
    const scenarios: Array<{
      name: string;
      prepare: (state: FakeState) => void;
      message: string;
    }> = [
      {
        name: "missing account",
        prepare: (state) => {
          state.users.push(...ROTATION_LOGIN_IDS.slice(0, 6).map(makeUser));
        },
        message: "Missing admin account vc-swastik",
      },
      {
        name: "inactive account",
        prepare: (state) => {
          seedAllAccounts(state);
          getUser(state, "vc-akash").isActive = false;
        },
        message: "Account vc-akash is not active",
      },
      {
        name: "judge in an admin slot",
        prepare: (state) => {
          seedAllAccounts(state);
          getUser(state, "vc-harsha").role = "judge";
        },
        message: "Account vc-harsha is not an admin",
      },
      {
        name: "participant in an admin slot",
        prepare: (state) => {
          seedAllAccounts(state);
          getUser(state, "vc-adarsh").role = "participant";
        },
        message: "Account vc-adarsh is not an admin",
      },
      {
        name: "duplicate account",
        prepare: (state) => {
          seedAllAccounts(state);
          state.users.push({ ...makeUser("vc-adarsh"), _id: "duplicate-adarsh" });
        },
        message: "Duplicate admin account found for vc-adarsh",
      },
    ];

    for (const scenario of scenarios) {
      const state = newState();
      scenario.prepare(state);
      const before = snapshotUsers(state);

      await assert.rejects(
        rotateAdminPasswords(testingOptions(true), createFakeDependencies(state)),
        (error: unknown) =>
          error instanceof RotationConflictError &&
          error.message.includes(scenario.message),
      );

      assert.equal(state.randomCalls, 0);
      assert.equal(state.hashCalls.length, 0);
      assert.equal(state.exportData, null);
      assert.equal(state.updates.length, 0);
      assert.equal(state.disconnected, true);
      assert.deepEqual(state.users, before);
    }
  });

  it("never modifies judges or participants", async () => {
    const state = newState();
    seedAllAccounts(state);
    state.users.push(...makeNonAdminUsers());
    const before = snapshotUsers(state);

    const result = await rotateAdminPasswords(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.deepEqual(
      state.updates.map((update) => update.loginId),
      [...ROTATION_LOGIN_IDS],
    );
    for (const nonAdmin of makeNonAdminUsers()) {
      assert.deepEqual(getUser(state, nonAdmin.loginId), nonAdmin);
      assert.ok(
        !state.updates.some((update) => update.loginId === nonAdmin.loginId),
      );
    }
    for (const user of before.filter((user) => user.role !== "admin")) {
      const after = getUser(state, user.loginId);
      assert.deepEqual(after, user);
    }
  });

  it("hashes seven unique passwords, exports them, and changes only passwordHash", async () => {
    const state = newState();
    seedAllAccounts(state);
    const before = snapshotUsers(state);

    const result = await rotateAdminPasswords(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.deepEqual(result.rotatedLoginIds, [...ROTATION_LOGIN_IDS]);
    assert.equal(result.exportPath, state.exportPath);
    assert.equal(state.hashCalls.length, 7);
    assert.equal(new Set(state.hashCalls).size, 7);
    for (const password of state.hashCalls) {
      assertPasswordFormat(password);
    }
    assert.equal(state.updates.length, 7);
    assert.equal(state.disconnected, true);
    assertNoSecretsLogged(state, state.hashCalls);

    for (let index = 0; index < ROTATION_LOGIN_IDS.length; index += 1) {
      const loginId = ROTATION_LOGIN_IDS[index];
      const password = state.hashCalls[index];
      const update = state.updates[index];
      const previous = before[index];
      if (!loginId || !password || !update || !previous) {
        throw new Error("Missing rotation record");
      }
      assert.equal(update.loginId, loginId);
      assert.equal(update.passwordHash, `hashed:${password}`);
      const current = getUser(state, loginId);
      assert.equal(current.passwordHash, `hashed:${password}`);
      assert.notEqual(current.passwordHash, previous.passwordHash);
      assert.deepEqual(current, {
        ...previous,
        passwordHash: current.passwordHash,
      });
    }

    const exportData = state.exportData;
    if (!exportData) {
      throw new Error("Credential export was not written");
    }
    assert.equal(exportData.target, "testing");
    assert.equal(exportData.databaseName, TESTING_DB);
    assert.equal(exportData.accounts.length, 7);
    assert.deepEqual(
      exportData.accounts.map((account) => account.password),
      state.hashCalls,
    );
    assert.equal(
      new Set(exportData.accounts.map((account) => account.password)).size,
      7,
    );
    assert.deepEqual(
      exportData.accounts.map((account) => account.loginId),
      [...ROTATION_LOGIN_IDS],
    );
    assert.ok(
      exportData.accounts.every(
        (account) =>
          account.passwordStatus === "rotated" &&
          account.role === "admin" &&
          account.isActive === true,
      ),
    );
  });

  it("applies production rotation with the confirmation phrase and exports under production", async () => {
    const state = newState();
    seedAllAccounts(state);
    const before = snapshotUsers(state);

    const result = await rotateAdminPasswords(
      productionOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(state.connectedUri, PRODUCTION_URI);
    assert.equal(state.hashCalls.length, 7);
    assert.equal(state.updates.length, 7);
    assertNoSecretsLogged(state, state.hashCalls);

    const exportData = state.exportData;
    if (!exportData) {
      throw new Error("Credential export was not written");
    }
    assert.equal(exportData.target, "production");
    assert.equal(exportData.databaseName, PRODUCTION_DB);
    assert.match(exportData.notice, /production admin accounts/);
    for (let index = 0; index < before.length; index += 1) {
      const previous = before[index];
      const loginId = previous?.loginId;
      if (!previous || !loginId) {
        throw new Error("Missing rotation record");
      }
      const current = getUser(state, loginId);
      assert.deepEqual(current, {
        ...previous,
        passwordHash: current.passwordHash,
      });
    }
  });

  it("does not update passwords when credential export fails", async () => {
    const state = newState();
    seedAllAccounts(state);
    seedNonAdminAccounts(state);
    state.failExport = new Error("Simulated export failure");
    const before = snapshotUsers(state);

    await assert.rejects(
      rotateAdminPasswords(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof Error && error.message.includes("Simulated export failure"),
    );

    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
    assert.equal(state.disconnected, true);
    assert.deepEqual(state.users, before);
  });

  it("leaves a complete credential export when a database update fails", async () => {
    const state = newState();
    seedAllAccounts(state);
    state.failUpdateAt = 2;

    await assert.rejects(
      rotateAdminPasswords(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof Error && error.message.includes("Simulated database update failure"),
    );

    assert.equal(state.updates.length, 2);
    assert.equal(state.disconnected, true);
    const exportData = state.exportData;
    if (!exportData) {
      throw new Error("Credential export was not written");
    }
    assert.equal(exportData.accounts.length, 7);
    assertNoSecretsLogged(state, state.hashCalls);
  });
});

describe("password rotation export", () => {
  it("writes separate environment files with the target in the filename", async () => {
    for (const target of ["testing", "production"] as const) {
      const directory = await mkdtemp(path.join(tmpdir(), "admin-rotation-"));

      try {
        const exportData: PasswordRotationExport = {
          target,
          databaseName: target === "testing" ? TESTING_DB : PRODUCTION_DB,
          generatedAt: "2026-01-01T00:00:00.000Z",
          notice: "test",
          accounts: [],
        };

        const filePath = await writePasswordRotationExport(exportData, directory);
        const files = await readdir(directory);
        const contents = await readFile(filePath, "utf8");

        assert.equal(files.length, 1);
        assert.ok(files[0]?.startsWith(`admin-password-rotation-${target}-`));
        assert.deepEqual(JSON.parse(contents), exportData);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
});
