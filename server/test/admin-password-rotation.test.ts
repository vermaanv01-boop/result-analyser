import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
} from "../src/config/seed-target";
import {
  PASSPHRASE_DIGIT_COUNT,
  PASSPHRASE_WORD_COUNT,
  PASSWORD_WORDS,
  ROTATION_LOGIN_IDS,
  RotationConflictError,
  generatePassphrase,
  generateUniquePassphrases,
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

const TESTING_URI = "mongodb://localhost:27017/venture_craft_testing";
const PRODUCTION_URI = "mongodb://localhost:27017/student_ranking";

interface FakeUser extends RotationUser {
  passwordHash: string;
  fullName: string;
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
  disconnected: boolean;
  failExport: Error | null;
  failUpdateAt: number | null;
}

function cloneUser(user: FakeUser): FakeUser {
  return { ...user };
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
  };
}

function seedAllAccounts(state: FakeState): void {
  state.users.push(...ROTATION_LOGIN_IDS.map(makeUser));
}

function getUser(state: FakeState, loginId: RotationLoginId): FakeUser {
  const user = state.users.find((candidate) => candidate.loginId === loginId);
  if (!user) {
    throw new Error(`Missing fake user ${loginId}`);
  }
  return user;
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
      return { name: new URL(uri).pathname.replace(/^\//, "") };
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
      if (state.failUpdateAt !== null && state.updates.length === state.failUpdateAt) {
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
  return parseRotationOptions(apply ? ["--apply"] : [], {
    TESTING_MONGODB_URI: TESTING_URI,
    PRODUCTION_MONGODB_URI: PRODUCTION_URI,
  });
}

function assertNoPlaintextPasswordsLogged(
  state: FakeState,
  passwords: readonly string[],
): void {
  for (const password of passwords) {
    assert.ok(state.logs.every((line) => !line.includes(password)));
  }
}

function assertAccountsUnchangedExceptPasswords(state: FakeState): void {
  for (const loginId of ROTATION_LOGIN_IDS) {
    const user = getUser(state, loginId);
    assert.equal(user.loginId, loginId);
    assert.equal(user.email, userEmail(loginId));
    assert.equal(user.role, "admin");
    assert.equal(user.isActive, true);
    assert.notEqual(user.passwordHash, `old-hash-${loginId}`);
  }
}

describe("passphrase generation", () => {
  it("uses deterministic cryptographic random selection to build a passphrase", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let calls = 0;
    const passphrase = generatePassphrase((maxExclusive) => {
      const value = values[calls];
      if (value === undefined) {
        throw new Error("Unexpected random call");
      }
      calls += 1;
      assert.ok(value >= 0 && value < maxExclusive);
      return value;
    });

    assert.equal(
      passphrase,
      "amber-anchor-apple-arbor-atlas-aurora-678",
    );
    assert.equal(calls, PASSPHRASE_WORD_COUNT + PASSPHRASE_DIGIT_COUNT);
    assert.ok(PASSWORD_WORDS.length >= 256);
    assert.equal(new Set(PASSWORD_WORDS).size, PASSWORD_WORDS.length);
  });

  it("generates seven unique passphrases with six words and three digits", () => {
    const passphrases = generateUniquePassphrases(7, sequentialRandom());

    assert.equal(passphrases.length, 7);
    assert.equal(new Set(passphrases).size, 7);
    assert.equal(new Set(PASSWORD_WORDS).size, PASSWORD_WORDS.length);

    for (const passphrase of passphrases) {
      const parts = passphrase.split("-");
      assert.equal(parts.length, PASSPHRASE_WORD_COUNT + 1);
      assert.equal(parts.length - 1, PASSPHRASE_WORD_COUNT);
      assert.ok(parts.slice(0, -1).every((word) => PASSWORD_WORDS.includes(word as (typeof PASSWORD_WORDS)[number])));
      const digits = parts[parts.length - 1];
      assert.ok(digits !== undefined);
      assert.equal(digits.length, PASSPHRASE_DIGIT_COUNT);
      assert.match(digits, /^\d{3}$/);
    }
  });

  it("aborts when unique passphrases cannot be generated", () => {
    assert.throws(
      () => generateUniquePassphrases(7, () => 0),
      (error: unknown) =>
        error instanceof RotationConflictError &&
        error.message.includes("Unable to generate unique admin passphrases"),
    );
  });
});

describe("rotation options", () => {
  it("uses only TESTING_MONGODB_URI and rejects production configuration", () => {
    const options = parseRotationOptions([], {
      TESTING_MONGODB_URI: TESTING_URI,
      PRODUCTION_MONGODB_URI: PRODUCTION_URI,
      MONGODB_URI: PRODUCTION_URI,
    });
    assert.equal(options.target, "testing");
    assert.equal(options.uri, TESTING_URI);
    assert.equal(options.databaseName, "venture_craft_testing");

    assert.throws(
      () =>
        parseRotationOptions(["--target", "production"], {
          TESTING_MONGODB_URI: TESTING_URI,
          PRODUCTION_MONGODB_URI: PRODUCTION_URI,
        }),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("only supports the testing target"),
    );

    assert.throws(
      () => parseRotationOptions([], { TESTING_MONGODB_URI: PRODUCTION_URI }),
      SeedConfigError,
    );

    assert.equal(databaseNameFromUri(TESTING_URI), "venture_craft_testing");
    assert.throws(() =>
      assertConnectedDatabaseName("student_ranking", "venture_craft_testing"),
    );
  });

  it("rejects unsupported arguments", () => {
    assert.throws(
      () => parseRotationOptions(["--confirm", "anything"], { TESTING_MONGODB_URI: TESTING_URI }),
      SeedConfigError,
    );
    assert.throws(
      () => parseRotationOptions(["--apply", "--apply"], { TESTING_MONGODB_URI: TESTING_URI }),
      SeedConfigError,
    );
  });
});

describe("admin password rotation", () => {
  it("aborts before connecting when the URI targets production", async () => {
    const state = newState();
    const options: RotationOptions = {
      target: "testing",
      databaseName: "venture_craft_testing",
      uri: PRODUCTION_URI,
      apply: true,
    };

    await assert.rejects(
      rotateAdminPasswords(options, createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes("TESTING_MONGODB_URI must target venture_craft_testing"),
    );

    assert.equal(state.connectedUri, null);
    assert.equal(state.findCalls, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
  });

  it("dry-runs validation without generating, exporting, or updating", async () => {
    const state = newState();
    seedAllAccounts(state);

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
    assert.ok(state.logs.some((line) => line.includes("Dry run: 7 admin accounts validated")));
    for (const loginId of ROTATION_LOGIN_IDS) {
      assert.equal(getUser(state, loginId).passwordHash, `old-hash-${loginId}`);
    }
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
        name: "non-admin account",
        prepare: (state) => {
          seedAllAccounts(state);
          getUser(state, "vc-harsha").role = "judge";
        },
        message: "Account vc-harsha is not an admin",
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
    }
  });

  it("hashes seven unique passphrases, exports them, and updates only password hashes", async () => {
    const state = newState();
    seedAllAccounts(state);

    const result = await rotateAdminPasswords(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.deepEqual(result.rotatedLoginIds, [...ROTATION_LOGIN_IDS]);
    assert.equal(result.exportPath, state.exportPath);
    assert.equal(state.hashCalls.length, 7);
    assert.equal(new Set(state.hashCalls).size, 7);
    assert.equal(state.updates.length, 7);
    assert.equal(state.disconnected, true);
    assertNoPlaintextPasswordsLogged(state, state.hashCalls);
    assertAccountsUnchangedExceptPasswords(state);

    for (let index = 0; index < ROTATION_LOGIN_IDS.length; index += 1) {
      const loginId = ROTATION_LOGIN_IDS[index];
      const password = state.hashCalls[index];
      const update = state.updates[index];
      if (!loginId || !password || !update) {
        throw new Error("Missing rotation record");
      }
      assert.equal(update.loginId, loginId);
      assert.equal(update.passwordHash, `hashed:${password}`);
      assert.equal(getUser(state, loginId).passwordHash, `hashed:${password}`);
    }

    const exportData = state.exportData;
    if (!exportData) {
      throw new Error("Credential export was not written");
    }
    assert.equal(exportData.target, "testing");
    assert.equal(exportData.databaseName, "venture_craft_testing");
    assert.equal(exportData.accounts.length, 7);
    assert.ok(
      exportData.accounts.every(
        (account) =>
          account.passwordStatus === "rotated" &&
          typeof account.password === "string" &&
          account.role === "admin" &&
          account.isActive === true,
      ),
    );
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
  });

  it("does not update passwords when credential export fails", async () => {
    const state = newState();
    seedAllAccounts(state);
    state.failExport = new Error("Simulated export failure");

    await assert.rejects(
      rotateAdminPasswords(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) => error instanceof Error && error.message.includes("Simulated export failure"),
    );

    assert.equal(state.exportData, null);
    assert.equal(state.updates.length, 0);
    assert.equal(state.disconnected, true);
    for (const loginId of ROTATION_LOGIN_IDS) {
      assert.equal(getUser(state, loginId).passwordHash, `old-hash-${loginId}`);
    }
  });

  it("leaves a complete credential export when a database update fails", async () => {
    const state = newState();
    seedAllAccounts(state);
    state.failUpdateAt = 2;

    await assert.rejects(
      rotateAdminPasswords(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) => error instanceof Error && error.message.includes("Simulated database update failure"),
    );

    assert.equal(state.updates.length, 2);
    assert.equal(state.disconnected, true);
    const exportData = state.exportData;
    if (!exportData) {
      throw new Error("Credential export was not written");
    }
    assert.equal(exportData.accounts.length, 7);
    assert.ok(
      exportData.accounts.every(
        (account) =>
          account.passwordStatus === "rotated" && typeof account.password === "string",
      ),
    );
    assertNoPlaintextPasswordsLogged(state, state.hashCalls);
  });
});

describe("password rotation export", () => {
  it("writes a single JSON file atomically", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "admin-rotation-"));

    try {
      const exportData: PasswordRotationExport = {
        target: "testing",
        databaseName: "venture_craft_testing",
        generatedAt: "2026-01-01T00:00:00.000Z",
        notice: "test",
        accounts: [],
      };

      const filePath = await writePasswordRotationExport(exportData, directory);
      const files = await readdir(directory);
      const contents = await readFile(filePath, "utf8");

      assert.equal(files.length, 1);
      assert.ok(files[0]?.startsWith("admin-password-rotation-testing-"));
      assert.deepEqual(JSON.parse(contents), exportData);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
