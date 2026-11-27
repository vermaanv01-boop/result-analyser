import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  PRODUCTION_CONFIRMATION,
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
  parseSeedOptions,
  type SeedOptions,
} from "../src/config/seed-target";
import { User } from "../src/models/user.model";
import {
  SeedConflictError,
  createSeedDependencies,
  seedAdmins,
  type SeedDependencies,
  type SeedUser,
} from "../src/scripts/seed-admins";
import {
  writeCredentialExport,
  type CredentialExport,
} from "../src/utils/credential-export";

const TESTING_URI = "mongodb://localhost:27017/venture_craft_testing";
const PRODUCTION_URI = "mongodb://localhost:27017/student_ranking";
const EXPECTED_NEW_LOGIN_IDS = [
  "vc-anushka",
  "vc-akash",
  "vc-shivam",
  "vc-harsha",
  "vc-adarsh",
  "vc-swastik",
] as const;

interface FakeUser extends SeedUser {
  passwordHash: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeIndex {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
}

interface CreateUserInput {
  name: string;
  email: string;
  loginId: string;
  passwordHash: string;
  role: "admin";
  isActive: true;
}

interface FakeState {
  users: FakeUser[];
  indexes: FakeIndex[];
  logs: string[];
  exports: CredentialExport[];
  createInputs: CreateUserInput[];
  migrations: Array<{ id: unknown; loginId: string }>;
  connectedUri: string | null;
  disconnected: boolean;
  generatedPasswords: string[];
  hashCalls: string[];
}

function cloneUser(user: FakeUser): FakeUser {
  return { ...user };
}

function newState(): FakeState {
  return {
    users: [],
    indexes: [
      {
        name: "user_loginId_unique",
        key: { loginId: 1 },
        unique: true,
        sparse: true,
      },
    ],
    logs: [],
    exports: [],
    createInputs: [],
    migrations: [],
    connectedUri: null,
    disconnected: false,
    generatedPasswords: [],
    hashCalls: [],
  };
}

function legacyAdmin(): FakeUser {
  return {
    _id: "legacy-admin",
    email: "admin@karvaan.org",
    loginId: undefined,
    role: "admin",
    isActive: true,
    passwordHash: "legacy-password-hash",
    fullName: "Legacy Admin",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-06-01T00:00:00.000Z"),
  };
}

function existingAdmin(loginId: string, id: string = loginId): FakeUser {
  return {
    _id: id,
    email: `${loginId}@testing.venturecraft.invalid`,
    loginId,
    role: "admin",
    isActive: true,
    passwordHash: `${loginId}-password-hash`,
    fullName: `${loginId} Admin`,
    createdAt: new Date("2025-02-01T00:00:00.000Z"),
    updatedAt: new Date("2025-07-01T00:00:00.000Z"),
  };
}

function createFakeDependencies(
  state: FakeState,
  overrides: Partial<SeedDependencies> = {},
): SeedDependencies {
  const dependencies: SeedDependencies = {
    connect: async (uri) => {
      state.connectedUri = uri;
      return { name: new URL(uri).pathname.replace(/^\//, "") };
    },
    disconnect: async () => {
      state.disconnected = true;
    },
    findAllWithLoginId: async () =>
      state.users
        .filter((user) => user.loginId !== undefined)
        .map(cloneUser),
    findManyByLoginIds: async (loginIds) =>
      state.users
        .filter(
          (user) =>
            typeof user.loginId === "string" &&
            loginIds.includes(user.loginId),
        )
        .map(cloneUser),
    findByEmail: async (email) =>
      state.users.filter((user) => user.email === email).map(cloneUser),
    listIndexes: async () =>
      state.indexes.map((index) => ({
        ...index,
        key: { ...index.key },
      })),
    createLoginIdIndex: async () => {
      state.indexes.push({
        name: "user_loginId_unique",
        key: { loginId: 1 },
        unique: true,
        sparse: true,
      });
    },
    setLoginId: async (id, loginId) => {
      const user = state.users.find(
        (candidate) => String(candidate._id) === String(id),
      );
      if (!user) {
        throw new Error("Fake user not found");
      }
      if (typeof user.loginId === "string" && user.loginId !== loginId) {
        throw new Error("Fake user already has a loginId");
      }
      user.loginId = loginId;
      state.migrations.push({ id, loginId });
      return cloneUser(user);
    },
    createUser: async (input) => {
      const created: FakeUser = {
        _id: `created-${state.createInputs.length + 1}`,
        email: input.email,
        loginId: input.loginId,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.passwordHash,
        fullName: input.name,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      state.users.push(created);
      state.createInputs.push(input);
      return cloneUser(created);
    },
    hashPassword: async (password) => {
      state.hashCalls.push(password);
      return `hashed:${password}`;
    },
    generatePassword: () => {
      const password = `generated-password-${state.generatedPasswords.length + 1}`;
      state.generatedPasswords.push(password);
      return password;
    },
    writeExport: async (credentialExport) => {
      state.exports.push(credentialExport);
      return `/tmp/admin-credentials-${state.exports.length}.json`;
    },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    logger: {
      info: (message) => {
        state.logs.push(message);
      },
    },
  };

  return Object.assign(dependencies, overrides);
}

function testingOptions(apply: boolean): SeedOptions {
  const args = ["--target", "testing"];
  if (apply) {
    args.push("--apply");
  }
  return parseSeedOptions(args, { TESTING_MONGODB_URI: TESTING_URI });
}

function productionOptions(
  apply: boolean,
  confirmation?: string,
): SeedOptions {
  const args = ["--target", "production"];
  if (apply) {
    args.push("--apply");
  }
  if (confirmation !== undefined) {
    args.push("--confirm", confirmation);
  }
  return parseSeedOptions(args, { PRODUCTION_MONGODB_URI: PRODUCTION_URI });
}

describe("seed target configuration", () => {
  it("requires target-specific env vars and explicit production confirmation", () => {
    const testing = parseSeedOptions(["--target", "testing"], {
      TESTING_MONGODB_URI: TESTING_URI,
      MONGODB_URI: PRODUCTION_URI,
    });
    assert.equal(testing.target, "testing");
    assert.equal(testing.uri, TESTING_URI);

    assert.throws(
      () =>
        parseSeedOptions(["--target", "production", "--apply"], {
          PRODUCTION_MONGODB_URI: PRODUCTION_URI,
        }),
      (error: unknown) =>
        error instanceof SeedConfigError &&
        error.message.includes(
          `--confirm "${PRODUCTION_CONFIRMATION}"`,
        ),
    );

    const production = productionOptions(true, PRODUCTION_CONFIRMATION);
    assert.equal(production.target, "production");
    assert.equal(production.apply, true);

    assert.throws(
      () =>
        parseSeedOptions(["--target", "testing"], {
          TESTING_MONGODB_URI: PRODUCTION_URI,
        }),
      SeedConfigError,
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
});

describe("admin seeding", () => {
  it("aborts when the connected database does not match the target", async () => {
    const state = newState();
    state.users.push(legacyAdmin());

    await assert.rejects(
      seedAdmins(
        testingOptions(false),
        createFakeDependencies(state, {
          connect: async () => ({ name: "student_ranking" }),
        }),
      ),
      SeedConfigError,
    );

    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.migrations.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("production aborts when the legacy admin is missing", async () => {
    const state = newState();

    await assert.rejects(
      seedAdmins(
        productionOptions(true, PRODUCTION_CONFIRMATION),
        createFakeDependencies(state),
      ),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("admin@karvaan.org is missing"),
    );

    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.generatedPasswords.length, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.migrations.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("dry-runs testing bootstrap without generating passwords or writing", async () => {
    const state = newState();
    state.indexes = [];

    const result = await seedAdmins(
      testingOptions(false),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, false);
    assert.deepEqual(result.createdLoginIds, []);
    assert.equal(result.exportPath, null);
    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.generatedPasswords.length, 0);
    assert.equal(state.hashCalls.length, 0);
    assert.equal(state.migrations.length, 0);
    assert.equal(state.indexes.length, 0);
    assert.equal(state.disconnected, true);
    assert.ok(
      state.logs.some((line) =>
        line.includes("Would bootstrap admin vc-admin in testing"),
      ),
    );
    for (const loginId of EXPECTED_NEW_LOGIN_IDS) {
      assert.ok(
        state.logs.some((line) => line.includes(`Would create admin ${loginId}`)),
      );
    }
    assert.ok(
      state.logs.some((line) => line.includes("user_loginId_unique would be created")),
    );
  });

  it("bootstraps testing vc-admin and creates six admins with new credentials", async () => {
    const state = newState();
    state.indexes = [];

    const result = await seedAdmins(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(result.migratedVcAdmin, false);
    assert.deepEqual(result.createdLoginIds, [
      "vc-admin",
      ...EXPECTED_NEW_LOGIN_IDS,
    ]);
    assert.equal(state.createInputs.length, 7);
    assert.equal(state.migrations.length, 0);
    assert.equal(state.generatedPasswords.length, 7);
    assert.equal(new Set(state.generatedPasswords).size, 7);
    assert.equal(state.hashCalls.length, 7);
    assert.equal(new Set(state.hashCalls).size, 7);
    assert.equal(state.exports.length, 1);
    assert.equal(state.disconnected, true);

    const credentialExport = state.exports[0];
    if (!credentialExport) {
      throw new Error("Credential export was not written");
    }
    assert.equal(credentialExport.target, "testing");
    assert.equal(credentialExport.databaseName, "venture_craft_testing");
    assert.equal(credentialExport.accounts.length, 7);
    assert.ok(
      credentialExport.accounts.every(
        (account) =>
          account.passwordStatus === "created" &&
          typeof account.password === "string",
      ),
    );
    assert.equal(
      new Set(
        credentialExport.accounts.map((account) => account.password),
      ).size,
      7,
    );
    assert.equal(
      credentialExport.accounts.find((account) => account.loginId === "vc-admin")
        ?.email,
      "admin@karvaan.org",
    );

    const bootstrappedAdmin = state.createInputs.find(
      (input) => input.loginId === "vc-admin",
    );
    if (!bootstrappedAdmin) {
      throw new Error("Bootstrapped vc-admin was not created");
    }
    assert.equal(bootstrappedAdmin.email, "admin@karvaan.org");
    assert.equal(bootstrappedAdmin.role, "admin");
    assert.equal(bootstrappedAdmin.isActive, true);
    assert.ok(bootstrappedAdmin.passwordHash.startsWith("hashed:"));

    for (const create of state.createInputs.filter(
      (input) => input.loginId !== "vc-admin",
    )) {
      assert.equal(
        create.email,
        `${create.loginId}@testing.venturecraft.invalid`,
      );
      assert.ok(create.passwordHash.startsWith("hashed:"));
    }

    assert.ok(
      state.indexes.some(
        (index) =>
          index.unique === true &&
          index.sparse === true &&
          index.key["loginId"] === 1 &&
          Object.keys(index.key).length === 1,
      ),
    );
    assert.ok(
      state.logs.every((line) => !line.includes("generated-password-")),
    );
  });

  it("does not regenerate credentials when rerunning testing bootstrap", async () => {
    const state = newState();
    const dependencies = createFakeDependencies(state);

    await seedAdmins(testingOptions(true), dependencies);
    const createCount = state.createInputs.length;
    const exportCount = state.exports.length;
    const passwordCount = state.generatedPasswords.length;
    const hashCount = state.hashCalls.length;

    const result = await seedAdmins(testingOptions(true), dependencies);

    assert.equal(result.applied, true);
    assert.deepEqual(result.createdLoginIds, []);
    assert.equal(result.migratedVcAdmin, false);
    assert.equal(result.exportPath, null);
    assert.equal(state.createInputs.length, createCount);
    assert.equal(state.exports.length, exportCount);
    assert.equal(state.generatedPasswords.length, passwordCount);
    assert.equal(state.hashCalls.length, hashCount);
    assert.equal(state.migrations.length, 0);
  });

  it("aborts testing bootstrap on conflicts before any database write", async () => {
    const loginConflictState = newState();
    const orphan = existingAdmin("vc-admin", "orphan-vc-admin");
    loginConflictState.users.push(orphan);
    loginConflictState.indexes = [];

    await assert.rejects(
      seedAdmins(
        testingOptions(true),
        createFakeDependencies(loginConflictState),
      ),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("loginId vc-admin is already assigned"),
    );

    assert.equal(orphan.loginId, "vc-admin");
    assert.equal(loginConflictState.createInputs.length, 0);
    assert.equal(loginConflictState.exports.length, 0);
    assert.equal(loginConflictState.migrations.length, 0);
    assert.equal(loginConflictState.hashCalls.length, 0);
    assert.equal(loginConflictState.indexes.length, 0);
    assert.equal(loginConflictState.disconnected, true);

    const emailConflictState = newState();
    const emailConflict = existingAdmin("vc-other", "email-conflict");
    emailConflict.email = "vc-anushka@testing.venturecraft.invalid";
    emailConflictState.users.push(emailConflict);
    emailConflictState.indexes = [];

    await assert.rejects(
      seedAdmins(
        testingOptions(true),
        createFakeDependencies(emailConflictState),
      ),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("Synthetic email for vc-anushka is already used"),
    );

    assert.equal(emailConflictState.createInputs.length, 0);
    assert.equal(emailConflictState.exports.length, 0);
    assert.equal(emailConflictState.migrations.length, 0);
    assert.equal(emailConflictState.hashCalls.length, 0);
    assert.equal(emailConflictState.indexes.length, 0);
    assert.equal(emailConflictState.disconnected, true);
  });

  it("aborts when vc-admin belongs to a different account", async () => {
    const state = newState();
    const legacy = legacyAdmin();
    const conflictingAccount = existingAdmin(
      "vc-admin",
      "conflicting-vc-admin",
    );
    state.users.push(legacy, conflictingAccount);

    await assert.rejects(
      seedAdmins(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("identify different accounts"),
    );

    assert.equal(legacy.loginId, undefined);
    assert.equal(conflictingAccount.loginId, "vc-admin");
    assert.equal(conflictingAccount.passwordHash, "vc-admin-password-hash");
    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.migrations.length, 0);
    assert.equal(state.generatedPasswords.length, 0);
    assert.equal(state.disconnected, true);
  });

  it("migrates the legacy admin without changing its other fields", async () => {
    const state = newState();
    const legacy = legacyAdmin();
    const originalLegacy = cloneUser(legacy);
    state.users.push(
      legacy,
      ...EXPECTED_NEW_LOGIN_IDS.map((loginId) => existingAdmin(loginId)),
    );

    const result = await seedAdmins(
      productionOptions(true, PRODUCTION_CONFIRMATION),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(result.migratedVcAdmin, true);
    assert.deepEqual(result.createdLoginIds, []);
    assert.equal(state.migrations.length, 1);
    assert.equal(state.createInputs.length, 0);
    assert.equal(state.generatedPasswords.length, 0);

    assert.equal(legacy.loginId, "vc-admin");
    assert.equal(legacy.email, originalLegacy.email);
    assert.equal(legacy.passwordHash, originalLegacy.passwordHash);
    assert.equal(legacy.fullName, originalLegacy.fullName);
    assert.equal(legacy.role, originalLegacy.role);
    assert.equal(legacy.isActive, originalLegacy.isActive);
    assert.deepEqual(legacy.createdAt, originalLegacy.createdAt);
    assert.deepEqual(legacy.updatedAt, originalLegacy.updatedAt);
    assert.deepEqual(legacy, { ...originalLegacy, loginId: "vc-admin" });

    const credentialExport = state.exports[0];
    if (!credentialExport) {
      throw new Error("Credential export was not written");
    }
    assert.equal(credentialExport.target, "production");
    assert.equal(credentialExport.databaseName, "student_ranking");
    assert.equal(
      credentialExport.accounts.filter(
        (account) => account.passwordStatus === "created",
      ).length,
      0,
    );
    assert.equal(
      credentialExport.accounts.find((account) => account.loginId === "vc-admin")
        ?.password,
      null,
    );
  });

  it("disables automatic timestamps on the loginId migration update", async () => {
    const originalFindOneAndUpdate = User.findOneAndUpdate;
    let captured:
      | { filter: unknown; update: unknown; options: unknown }
      | undefined;

    type FakeQuery = {
      select: () => FakeQuery;
      lean: () => Promise<SeedUser>;
    };

    const query: FakeQuery = {
      select: () => query,
      lean: async () => ({
        _id: "legacy-admin",
        email: "admin@karvaan.org",
        loginId: "vc-admin",
        role: "admin",
        isActive: true,
      }),
    };

    const stub = ((filter: unknown, update: unknown, options: unknown) => {
      captured = { filter, update, options };
      return query;
    }) as unknown as typeof User.findOneAndUpdate;

    (User as unknown as { findOneAndUpdate: typeof User.findOneAndUpdate })
      .findOneAndUpdate = stub;

    try {
      const dependencies = createSeedDependencies();
      const updated = await dependencies.setLoginId("legacy-admin", "vc-admin");

      assert.ok(captured);
      assert.deepEqual(captured.filter, {
        _id: "legacy-admin",
        loginId: { $exists: false },
      });
      assert.deepEqual(captured.update, { $set: { loginId: "vc-admin" } });
      assert.deepEqual(captured.options, { new: true, timestamps: false });
      assert.equal(updated.loginId, "vc-admin");
    } finally {
      (User as unknown as { findOneAndUpdate: typeof User.findOneAndUpdate })
        .findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  it("creates the six production admins without changing preservation behavior", async () => {
    const state = newState();
    state.users.push(legacyAdmin());
    state.indexes = [];

    const result = await seedAdmins(
      productionOptions(true, PRODUCTION_CONFIRMATION),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(result.migratedVcAdmin, true);
    assert.deepEqual(result.createdLoginIds, [...EXPECTED_NEW_LOGIN_IDS]);
    assert.equal(state.migrations.length, 1);
    assert.equal(state.createInputs.length, 6);

    const migrated = state.users.find((user) => user._id === "legacy-admin");
    assert.ok(migrated);
    assert.equal(migrated.loginId, "vc-admin");
    assert.equal(migrated.email, "admin@karvaan.org");
    assert.equal(migrated.passwordHash, "legacy-password-hash");
    assert.equal(migrated.role, "admin");
    assert.equal(migrated.isActive, true);
    assert.deepEqual(migrated.createdAt, new Date("2025-01-01T00:00:00.000Z"));
    assert.deepEqual(migrated.updatedAt, new Date("2025-06-01T00:00:00.000Z"));

    for (const input of state.createInputs) {
      assert.equal(input.role, "admin");
      assert.equal(input.isActive, true);
      assert.equal(
        input.email,
        `${input.loginId}@production.venturecraft.invalid`,
      );
    }

    const credentialExport = state.exports[0];
    if (!credentialExport) {
      throw new Error("Credential export was not written");
    }
    assert.equal(credentialExport.target, "production");
    assert.equal(credentialExport.databaseName, "student_ranking");
    assert.equal(
      credentialExport.accounts.find((account) => account.loginId === "vc-admin")
        ?.password,
      null,
    );
    const createdRecords = credentialExport.accounts.filter(
      (account) => account.passwordStatus === "created",
    );
    assert.equal(createdRecords.length, 6);
    assert.equal(
      new Set(createdRecords.map((account) => account.password)).size,
      6,
    );
    assert.ok(
      state.logs.every((line) => !line.includes("generated-password-")),
    );
  });

  it("dry-runs the full migration without generating passwords or writing", async () => {
    const state = newState();
    state.users.push(legacyAdmin());
    state.indexes = [];

    const result = await seedAdmins(
      testingOptions(false),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, false);
    assert.deepEqual(result.createdLoginIds, []);
    assert.equal(result.exportPath, null);
    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.generatedPasswords.length, 0);
    assert.equal(state.migrations.length, 0);
    assert.equal(state.connectedUri, TESTING_URI);
    assert.equal(state.disconnected, true);

    for (const loginId of EXPECTED_NEW_LOGIN_IDS) {
      assert.ok(
        state.logs.some((line) => line.includes(`Would create admin ${loginId}`)),
      );
    }
    assert.ok(
      state.logs.some((line) => line.includes("user_loginId_unique would be created")),
    );
  });

  it("migrates vc-admin, creates new admins, and exports only new passwords", async () => {
    const state = newState();
    state.users.push(legacyAdmin());
    state.indexes = [];

    const result = await seedAdmins(
      testingOptions(true),
      createFakeDependencies(state),
    );

    assert.equal(result.applied, true);
    assert.equal(result.migratedVcAdmin, true);
    assert.deepEqual(result.createdLoginIds, [...EXPECTED_NEW_LOGIN_IDS]);
    assert.equal(state.migrations.length, 1);
    assert.equal(state.createInputs.length, 6);
    assert.equal(state.exports.length, 1);
    assert.equal(state.disconnected, true);

    const credentialExport = state.exports[0];
    if (!credentialExport) {
      throw new Error("Credential export was not written");
    }
    assert.equal(credentialExport.target, "testing");
    assert.equal(credentialExport.databaseName, "venture_craft_testing");
    assert.equal(credentialExport.accounts.length, 7);

    const vcAdminRecord = credentialExport.accounts.find(
      (account) => account.loginId === "vc-admin",
    );
    if (!vcAdminRecord) {
      throw new Error("vc-admin credential record is missing");
    }
    assert.equal(vcAdminRecord.password, null);
    assert.equal(vcAdminRecord.passwordStatus, "preserved-not-exported");

    const createdRecords = credentialExport.accounts.filter(
      (account) => account.passwordStatus === "created",
    );
    assert.equal(createdRecords.length, 6);
    assert.equal(
      new Set(createdRecords.map((account) => account.password)).size,
      6,
    );

    for (const input of state.createInputs) {
      assert.equal(input.role, "admin");
      assert.equal(input.isActive, true);
      assert.match(input.loginId, /^vc-(anushka|akash|shivam|harsha|adarsh|swastik)$/);
      assert.equal(
        input.email,
        `${input.loginId}@testing.venturecraft.invalid`,
      );
      assert.ok(input.passwordHash.startsWith("hashed:"));
    }

    const migrated = state.users.find(
      (user) => String(user._id) === "legacy-admin",
    );
    if (!migrated) {
      throw new Error("Migrated admin is missing");
    }
    assert.equal(migrated.loginId, "vc-admin");
    assert.equal(migrated.email, "admin@karvaan.org");
    assert.equal(migrated.passwordHash, "legacy-password-hash");
    assert.equal(migrated.fullName, "Legacy Admin");

    assert.ok(
      state.indexes.some(
        (index) =>
          index.unique === true &&
          index.sparse === true &&
          index.key["loginId"] === 1 &&
          Object.keys(index.key).length === 1,
      ),
    );
    assert.ok(
      state.logs.every((line) => !line.includes("generated-password-")),
    );
  });

  it("is idempotent on rerun", async () => {
    const state = newState();
    state.users.push(legacyAdmin());
    const dependencies = createFakeDependencies(state);

    await seedAdmins(testingOptions(true), dependencies);
    const createdCount = state.createInputs.length;
    const exportCount = state.exports.length;
    const passwordCount = state.generatedPasswords.length;

    const result = await seedAdmins(testingOptions(true), dependencies);

    assert.equal(result.applied, true);
    assert.deepEqual(result.createdLoginIds, []);
    assert.equal(result.migratedVcAdmin, false);
    assert.equal(result.exportPath, null);
    assert.equal(state.createInputs.length, createdCount);
    assert.equal(state.exports.length, exportCount);
    assert.equal(state.generatedPasswords.length, passwordCount);
    assert.equal(state.migrations.length, 1);
  });

  it("rejects duplicate loginId values before making changes", async () => {
    const state = newState();
    state.users.push(
      legacyAdmin(),
      {
        ...legacyAdmin(),
        _id: "duplicate-1",
        email: "duplicate-1@example.com",
        loginId: "vc-anushka",
      },
      {
        ...legacyAdmin(),
        _id: "duplicate-2",
        email: "duplicate-2@example.com",
        loginId: "vc-anushka",
      },
    );

    await assert.rejects(
      seedAdmins(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("Duplicate loginId found: vc-anushka"),
    );

    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.migrations.length, 0);
  });

  it("rejects inactive or non-admin official accounts", async () => {
    const state = newState();
    state.users.push(
      legacyAdmin(),
      {
        ...legacyAdmin(),
        _id: "inactive-official",
        email: "vc-akash@testing.venturecraft.invalid",
        loginId: "vc-akash",
        role: "admin",
        isActive: false,
      },
    );

    await assert.rejects(
      seedAdmins(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("not an active admin account"),
    );

    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.migrations.length, 0);
  });

  it("rejects an incompatible existing loginId index", async () => {
    const state = newState();
    state.users.push(legacyAdmin());
    state.indexes = [
      {
        name: "bad_loginId_index",
        key: { loginId: 1 },
        unique: false,
        sparse: false,
      },
    ];

    await assert.rejects(
      seedAdmins(testingOptions(true), createFakeDependencies(state)),
      (error: unknown) =>
        error instanceof SeedConflictError &&
        error.message.includes("not a unique sparse single-field index"),
    );

    assert.equal(state.createInputs.length, 0);
    assert.equal(state.exports.length, 0);
    assert.equal(state.migrations.length, 0);
  });
});

describe("credential export", () => {
  it("writes a single JSON file atomically", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "admin-credentials-"));

    try {
      const credentialExport: CredentialExport = {
        target: "testing",
        databaseName: "venture_craft_testing",
        generatedAt: "2026-01-01T00:00:00.000Z",
        notice: "test",
        accounts: [],
      };

      const filePath = await writeCredentialExport(
        credentialExport,
        directory,
      );
      const files = await readdir(directory);
      const contents = await readFile(filePath, "utf8");

      assert.equal(files.length, 1);
      assert.deepEqual(JSON.parse(contents), credentialExport);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
