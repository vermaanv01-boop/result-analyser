import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import {
  assertConnectedDatabaseName,
  parseSeedOptions,
  type SeedOptions,
  type SeedTarget,
} from "../config/seed-target";
import { LOGIN_ID_PATTERN, User } from "../models/user.model";
import { hashPassword } from "../services/auth.service";
import {
  writeCredentialExport,
  type CredentialExport,
  type CredentialRecord,
} from "../utils/credential-export";
import { describeError } from "../utils/safe-log";

const LEGACY_ADMIN_EMAIL = "admin@karvaan.org";
const LOGIN_ID_INDEX_NAME = "user_loginId_unique";
const ADMIN_LOGIN_IDS = [
  "vc-admin",
  "vc-anushka",
  "vc-akash",
  "vc-shivam",
  "vc-harsha",
  "vc-adarsh",
  "vc-swastik",
] as const;

type AdminLoginId = (typeof ADMIN_LOGIN_IDS)[number];
type NewAdminLoginId = Exclude<AdminLoginId, "vc-admin">;

const NEW_ADMIN_DISPLAY_NAMES: Record<NewAdminLoginId, string> = {
  "vc-anushka": "Anushka",
  "vc-akash": "Akash",
  "vc-shivam": "Shivam",
  "vc-harsha": "Harsha",
  "vc-adarsh": "Adarsh",
  "vc-swastik": "Swastik",
};

const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 0,
} as const;

export class SeedConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConflictError";
  }
}

export interface SeedUser {
  _id: unknown;
  email: string;
  loginId: string | null | undefined;
  role: string;
  isActive: boolean;
}

interface CollectionIndex {
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  name?: string;
}

interface SeedConnection {
  name: string;
}

interface CreateSeedUserInput {
  name: string;
  email: string;
  loginId: string;
  passwordHash: string;
  role: "admin";
  isActive: true;
}

interface SeedLogger {
  info(message: string): void;
}

export interface SeedDependencies {
  connect(uri: string): Promise<SeedConnection>;
  disconnect(): Promise<void>;
  findAllWithLoginId(): Promise<SeedUser[]>;
  findManyByLoginIds(loginIds: readonly string[]): Promise<SeedUser[]>;
  findByEmail(email: string): Promise<SeedUser[]>;
  listIndexes(): Promise<CollectionIndex[]>;
  createLoginIdIndex(): Promise<void>;
  setLoginId(id: unknown, loginId: AdminLoginId): Promise<SeedUser>;
  createUser(input: CreateSeedUserInput): Promise<SeedUser>;
  hashPassword(password: string): Promise<string>;
  generatePassword(): string;
  writeExport(credentialExport: CredentialExport): Promise<string>;
  now(): Date;
  logger: SeedLogger;
}

interface CreatePlan {
  loginId: NewAdminLoginId;
  email: string;
  name: string;
  password: string | null;
}

interface SeedPlan {
  vcAdminUser: SeedUser;
  vcAdminNeedsMigration: boolean;
  creates: CreatePlan[];
  existingLoginIds: AdminLoginId[];
}

export interface SeedResult {
  applied: boolean;
  createdLoginIds: string[];
  migratedVcAdmin: boolean;
  exportPath: string | null;
}

function idToString(id: unknown): string {
  return String(id);
}

function assertSingleDocument(
  documents: readonly SeedUser[],
  description: string,
): SeedUser | undefined {
  if (documents.length > 1) {
    throw new SeedConflictError(`${description} matched more than one account`);
  }
  return documents[0];
}

function assertActiveAdmin(user: SeedUser, description: string): void {
  if (user.role !== "admin" || user.isActive !== true) {
    throw new SeedConflictError(
      `${description} is not an active admin account`,
    );
  }
}

function validateExistingLoginIds(users: readonly SeedUser[]): void {
  const seen = new Set<string>();

  for (const user of users) {
    const loginId = user.loginId;

    if (typeof loginId !== "string" || loginId.length === 0) {
      throw new SeedConflictError("Found a null or empty loginId value");
    }

    const normalized = loginId.trim().toLowerCase();
    if (normalized !== loginId) {
      throw new SeedConflictError("Found a non-normalized loginId value");
    }

    if (!LOGIN_ID_PATTERN.test(normalized)) {
      throw new SeedConflictError("Found an invalid loginId value");
    }

    if (seen.has(normalized)) {
      throw new SeedConflictError(`Duplicate loginId found: ${normalized}`);
    }

    seen.add(normalized);
  }
}

function syntheticEmail(loginId: string, target: SeedTarget): string {
  return `${loginId}@${target}.venturecraft.invalid`;
}

function generateUniquePassword(
  generatePassword: () => string,
  usedPasswords: Set<string>,
): string {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const password = generatePassword();
    if (!password) {
      throw new SeedConflictError("Generated password must not be empty");
    }
    if (!usedPasswords.has(password)) {
      usedPasswords.add(password);
      return password;
    }
  }

  throw new SeedConflictError("Unable to generate a unique password");
}

async function resolveVcAdmin(
  dependencies: SeedDependencies,
  byLoginId: ReadonlyMap<string, SeedUser>,
): Promise<{ user: SeedUser; needsMigration: boolean }> {
  const legacyMatches = await dependencies.findByEmail(LEGACY_ADMIN_EMAIL);
  const legacyUser = assertSingleDocument(legacyMatches, LEGACY_ADMIN_EMAIL);

  if (!legacyUser) {
    throw new SeedConflictError(
      `Legacy admin account ${LEGACY_ADMIN_EMAIL} is missing; refusing to create a replacement`,
    );
  }

  assertActiveAdmin(legacyUser, "Legacy admin account");

  const existingById = byLoginId.get("vc-admin");
  if (
    existingById &&
    idToString(existingById._id) !== idToString(legacyUser._id)
  ) {
    throw new SeedConflictError(
      "vc-admin loginId and legacy admin email identify different accounts",
    );
  }

  return {
    user: legacyUser,
    needsMigration: legacyUser.loginId !== "vc-admin",
  };
}

async function planNewAdmins(
  options: SeedOptions,
  dependencies: SeedDependencies,
  byLoginId: ReadonlyMap<string, SeedUser>,
): Promise<{ creates: CreatePlan[]; existingLoginIds: NewAdminLoginId[] }> {
  const creates: CreatePlan[] = [];
  const existingLoginIds: NewAdminLoginId[] = [];
  const usedPasswords = new Set<string>();
  const newLoginIds = ADMIN_LOGIN_IDS.slice(1) as readonly NewAdminLoginId[];

  for (const loginId of newLoginIds) {
    const existing = byLoginId.get(loginId);

    if (existing) {
      assertActiveAdmin(existing, `Existing account ${loginId}`);
      existingLoginIds.push(loginId);
      continue;
    }

    const email = syntheticEmail(loginId, options.target);
    const emailMatches = await dependencies.findByEmail(email);
    const emailUser = assertSingleDocument(emailMatches, email);

    if (emailUser) {
      throw new SeedConflictError(
        `Synthetic email for ${loginId} is already used by another account`,
      );
    }

    creates.push({
      loginId,
      email,
      name: `${NEW_ADMIN_DISPLAY_NAMES[loginId]} — Venture Craft Admin`,
      password: options.apply
        ? generateUniquePassword(dependencies.generatePassword, usedPasswords)
        : null,
    });
  }

  return { creates, existingLoginIds };
}

async function ensureLoginIdIndex(
  dependencies: SeedDependencies,
  apply: boolean,
): Promise<void> {
  const indexes = await dependencies.listIndexes();
  const loginIdIndexes = indexes.filter(
    (index) => typeof index.key?.["loginId"] === "number",
  );

  const incompatible = loginIdIndexes.find(
    (index) =>
      Object.keys(index.key).length !== 1 ||
      index.key["loginId"] !== 1 ||
      index.unique !== true ||
      index.sparse !== true,
  );

  if (incompatible) {
    throw new SeedConflictError(
      "Existing loginId index is not a unique sparse single-field index",
    );
  }

  if (loginIdIndexes.length > 0) {
    dependencies.logger.info("[seed] Unique sparse loginId index is present");
    return;
  }

  if (!apply) {
    dependencies.logger.info(
      `[seed] Unique sparse loginId index ${LOGIN_ID_INDEX_NAME} would be created`,
    );
    return;
  }

  await dependencies.createLoginIdIndex();
  dependencies.logger.info(
    `[seed] Created unique sparse loginId index ${LOGIN_ID_INDEX_NAME}`,
  );
}

function buildCredentialRecords(
  options: SeedOptions,
  plan: SeedPlan,
): CredentialRecord[] {
  const records: CredentialRecord[] = [
    {
      loginId: "vc-admin",
      email: plan.vcAdminUser.email,
      role: "admin",
      isActive: true,
      password: null,
      passwordStatus: "preserved-not-exported",
    },
  ];

  for (const loginId of plan.existingLoginIds) {
    records.push({
      loginId,
      email: syntheticEmail(loginId, options.target),
      role: "admin",
      isActive: true,
      password: null,
      passwordStatus: "preserved-not-exported",
    });
  }

  for (const create of plan.creates) {
    if (!create.password) {
      throw new SeedConflictError("Missing generated password for credential export");
    }
    records.push({
      loginId: create.loginId,
      email: create.email,
      role: "admin",
      isActive: true,
      password: create.password,
      passwordStatus: "created",
    });
  }

  return records;
}

async function applyPlan(
  options: SeedOptions,
  dependencies: SeedDependencies,
  plan: SeedPlan,
): Promise<string | null> {
  if (plan.creates.length === 0 && !plan.vcAdminNeedsMigration) {
    dependencies.logger.info("[seed] Already up to date; no writes were made");
    return null;
  }

  const credentialExport: CredentialExport = {
    target: options.target,
    databaseName: options.databaseName,
    generatedAt: dependencies.now().toISOString(),
    notice:
      "Passwords are included only for newly created accounts. Existing passwords were preserved and are not exported.",
    accounts: buildCredentialRecords(options, plan),
  };

  const exportPath = await dependencies.writeExport(credentialExport);
  dependencies.logger.info(`[seed] Wrote credential export to ${exportPath}`);

  if (plan.vcAdminNeedsMigration) {
    await dependencies.setLoginId(plan.vcAdminUser._id, "vc-admin");
    dependencies.logger.info("[seed] Assigned loginId vc-admin to existing admin");
  }

  for (const create of plan.creates) {
    if (!create.password) {
      throw new SeedConflictError("Missing generated password for account creation");
    }
    const passwordHash = await dependencies.hashPassword(create.password);
    await dependencies.createUser({
      name: create.name,
      email: create.email,
      loginId: create.loginId,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    dependencies.logger.info(`[seed] Created admin ${create.loginId}`);
  }

  return exportPath;
}

export async function seedAdmins(
  options: SeedOptions,
  dependencies: SeedDependencies,
): Promise<SeedResult> {
  const connection = await dependencies.connect(options.uri);

  try {
    assertConnectedDatabaseName(connection.name, options.databaseName);
    dependencies.logger.info(
      `[seed] target=${options.target} database=${options.databaseName} mode=${options.apply ? "apply" : "dry-run"}`,
    );

    const allLoginIds = await dependencies.findAllWithLoginId();
    validateExistingLoginIds(allLoginIds);

    const existingOfficialAccounts = await dependencies.findManyByLoginIds(
      ADMIN_LOGIN_IDS,
    );
    const byLoginId = new Map<string, SeedUser>();

    for (const user of existingOfficialAccounts) {
      if (typeof user.loginId !== "string") {
        throw new SeedConflictError("Official login ID query returned an invalid value");
      }
      assertActiveAdmin(user, `Existing account ${user.loginId}`);
      byLoginId.set(user.loginId, user);
    }

    const vcAdmin = await resolveVcAdmin(dependencies, byLoginId);
    const newAdmins = await planNewAdmins(options, dependencies, byLoginId);

    const plan: SeedPlan = {
      vcAdminUser: vcAdmin.user,
      vcAdminNeedsMigration: vcAdmin.needsMigration,
      creates: newAdmins.creates,
      existingLoginIds: newAdmins.existingLoginIds,
    };

    await ensureLoginIdIndex(dependencies, options.apply);

    if (!options.apply) {
      dependencies.logger.info(
        `[seed] Dry run: ${plan.creates.length} new admin(s), ${vcAdmin.needsMigration ? 1 : 0} migration(s), ${plan.existingLoginIds.length} existing admin(s)`,
      );
      for (const create of plan.creates) {
        dependencies.logger.info(`[seed] Would create admin ${create.loginId}`);
      }
      return {
        applied: false,
        createdLoginIds: [],
        migratedVcAdmin: false,
        exportPath: null,
      };
    }

    const exportPath = await applyPlan(options, dependencies, plan);
    return {
      applied: true,
      createdLoginIds: plan.creates.map((create) => create.loginId),
      migratedVcAdmin: plan.vcAdminNeedsMigration,
      exportPath,
    };
  } finally {
    await dependencies.disconnect();
  }
}

export function createSeedDependencies(
  logger: SeedLogger = console,
): SeedDependencies {
  return {
    connect: async (uri) => {
      await mongoose.connect(uri, CONNECTION_OPTIONS);
      return { name: mongoose.connection.name };
    },
    disconnect: async () => {
      await mongoose.disconnect();
    },
    findAllWithLoginId: async () =>
      (await User.find({ loginId: { $exists: true } })
        .select("loginId email role isActive")
        .lean()) as unknown as SeedUser[],
    findManyByLoginIds: async (loginIds) =>
      (await User.find({ loginId: { $in: loginIds } })
        .select("loginId email role isActive")
        .lean()) as unknown as SeedUser[],
    findByEmail: async (email) =>
      (await User.find({ email })
        .select("loginId email role isActive")
        .lean()) as unknown as SeedUser[],
    listIndexes: async () =>
      (await User.collection.indexes()) as unknown as CollectionIndex[],
    createLoginIdIndex: async () => {
      await User.collection.createIndex(
        { loginId: 1 },
        { name: LOGIN_ID_INDEX_NAME, unique: true, sparse: true },
      );
    },
    setLoginId: async (id, loginId) => {
      const updated = await User.findOneAndUpdate(
        { _id: id, loginId: { $exists: false } },
        { $set: { loginId } },
        { new: true },
      )
        .select("loginId email role isActive")
        .lean();
      if (!updated) {
        throw new SeedConflictError("Legacy admin changed during migration");
      }
      return updated as unknown as SeedUser;
    },
    createUser: async (input) => {
      const created = await User.create(input);
      return {
        _id: created._id,
        email: created.email,
        loginId: created.loginId,
        role: created.role,
        isActive: created.isActive,
      };
    },
    hashPassword,
    generatePassword: () => randomBytes(24).toString("base64url"),
    writeExport: async (credentialExport) =>
      writeCredentialExport(credentialExport),
    now: () => new Date(),
    logger,
  };
}

async function runCli(): Promise<void> {
  const options = parseSeedOptions(process.argv.slice(2), process.env);
  const result = await seedAdmins(options, createSeedDependencies());

  if (!result.applied) {
    console.log("[seed] Dry run complete. No database writes or exports were made.");
    return;
  }

  console.log("[seed] Admin seeding complete.");
}

if (require.main === module) {
  runCli().catch((error: unknown) => {
    console.error(`[seed] Failed: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
