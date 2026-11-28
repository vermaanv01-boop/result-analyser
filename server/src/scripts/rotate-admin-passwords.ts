import { randomInt as secureRandomInt } from "node:crypto";
import mongoose, { Types } from "mongoose";
import {
  SEED_TARGETS,
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
  type SeedTarget,
} from "../config/seed-target";
import { User } from "../models/user.model";
import { hashPassword } from "../services/auth.service";
import {
  writePasswordRotationExport,
  type PasswordRotationExport,
} from "../utils/credential-export";
import { describeError } from "../utils/safe-log";

export const ROTATION_LOGIN_IDS = [
  "vc-admin",
  "vc-anushka",
  "vc-akash",
  "vc-shivam",
  "vc-harsha",
  "vc-adarsh",
  "vc-swastik",
] as const;

export type RotationLoginId = (typeof ROTATION_LOGIN_IDS)[number];

export const PRODUCTION_ROTATION_CONFIRMATION = "ROTATE PRODUCTION ADMIN PASSWORDS";

export const PASSWORD_ALPHABETIC_COUNT = 3;
export const PASSWORD_DIGIT_COUNT = 3;
export const PASSWORD_SPECIAL_COUNT = 1;
export const PASSWORD_LENGTH =
  PASSWORD_ALPHABETIC_COUNT + PASSWORD_DIGIT_COUNT + PASSWORD_SPECIAL_COUNT;
export const PASSWORD_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const PASSWORD_DIGITS = "0123456789";
export const PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*";

const ROTATION_LOGIN_ID_SET: ReadonlySet<string> = new Set<string>(
  ROTATION_LOGIN_IDS,
);

const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 0,
} as const;

export type RandomInt = (maxExclusive: number) => number;

export class RotationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RotationConflictError";
  }
}

export interface RotationOptions {
  target: SeedTarget;
  databaseName: string;
  uri: string;
  apply: boolean;
  confirmation: string | undefined;
}

export interface RotationUser {
  _id: unknown;
  loginId: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface RotationLogger {
  info(message: string): void;
}

export interface RotationDependencies {
  connect(uri: string): Promise<{ name: string }>;
  disconnect(): Promise<void>;
  findRotationAccounts(
    loginIds: readonly RotationLoginId[],
  ): Promise<RotationUser[]>;
  hashPassword(password: string): Promise<string>;
  randomInt(maxExclusive: number): number;
  writeExport(exportData: PasswordRotationExport): Promise<string>;
  now(): Date;
  updatePassword(input: {
    id: unknown;
    loginId: RotationLoginId;
    passwordHash: string;
  }): Promise<void>;
  logger: RotationLogger;
}

export interface RotationResult {
  applied: boolean;
  rotatedLoginIds: RotationLoginId[];
  exportPath: string | null;
}

interface ParsedRotationArguments {
  target: string | undefined;
  apply: boolean;
  confirmation: string | undefined;
}

function isValidRandomIndex(index: number, maxExclusive: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < maxExclusive;
}

function randomCharacter(characters: string, randomInt: RandomInt): string {
  const index = randomInt(characters.length);
  if (!isValidRandomIndex(index, characters.length)) {
    throw new RotationConflictError("Random character index was invalid");
  }
  const character = characters[index];
  if (!character) {
    throw new RotationConflictError("Random character selection failed");
  }
  return character;
}

function shuffleCharacters(
  characters: string[],
  randomInt: RandomInt,
): string[] {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    if (!isValidRandomIndex(swapIndex, index + 1)) {
      throw new RotationConflictError("Random shuffle index was invalid");
    }
    const current = characters[index];
    const swap = characters[swapIndex];
    if (current === undefined || swap === undefined) {
      throw new RotationConflictError("Random shuffle failed");
    }
    characters[index] = swap;
    characters[swapIndex] = current;
  }
  return characters;
}

export function generatePassword(
  randomInt: RandomInt = secureRandomInt,
): string {
  const characters: string[] = [];

  for (let index = 0; index < PASSWORD_ALPHABETIC_COUNT; index += 1) {
    characters.push(randomCharacter(PASSWORD_ALPHABET, randomInt));
  }
  for (let index = 0; index < PASSWORD_DIGIT_COUNT; index += 1) {
    characters.push(randomCharacter(PASSWORD_DIGITS, randomInt));
  }
  for (let index = 0; index < PASSWORD_SPECIAL_COUNT; index += 1) {
    characters.push(randomCharacter(PASSWORD_SPECIAL_CHARACTERS, randomInt));
  }

  return shuffleCharacters(characters, randomInt).join("");
}

export function generateUniquePasswords(
  count: number,
  randomInt: RandomInt = secureRandomInt,
): string[] {
  const passwords = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    let generated: string | undefined;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = generatePassword(randomInt);
      if (!passwords.has(candidate)) {
        generated = candidate;
        break;
      }
    }
    if (!generated) {
      throw new RotationConflictError(
        "Unable to generate unique admin passwords",
      );
    }
    passwords.add(generated);
  }

  return [...passwords];
}

function readValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) {
    throw new SeedConfigError(`${flag} requires a value`);
  }
  return value;
}

function parseArguments(args: readonly string[]): ParsedRotationArguments {
  const parsed: ParsedRotationArguments = {
    target: undefined,
    apply: false,
    confirmation: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      break;
    }

    if (arg === "--apply") {
      if (parsed.apply) {
        throw new SeedConfigError("--apply was provided more than once");
      }
      parsed.apply = true;
      continue;
    }

    if (arg === "--target" || arg.startsWith("--target=")) {
      if (parsed.target !== undefined) {
        throw new SeedConfigError("--target was provided more than once");
      }
      parsed.target =
        arg === "--target"
          ? readValue(args, index + 1, "--target")
          : arg.slice("--target=".length);
      if (arg === "--target") {
        index += 1;
      }
      continue;
    }

    if (arg === "--confirm" || arg.startsWith("--confirm=")) {
      if (parsed.confirmation !== undefined) {
        throw new SeedConfigError("--confirm was provided more than once");
      }
      parsed.confirmation =
        arg === "--confirm"
          ? readValue(args, index + 1, "--confirm")
          : arg.slice("--confirm=".length);
      if (arg === "--confirm") {
        index += 1;
      }
      continue;
    }

    throw new SeedConfigError(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function assertRotationOptions(options: RotationOptions): void {
  if (options.target !== "testing" && options.target !== "production") {
    throw new SeedConfigError("--target must be either testing or production");
  }

  const targetConfig = SEED_TARGETS[options.target];
  if (options.databaseName !== targetConfig.databaseName) {
    throw new SeedConfigError(
      `${options.target} databaseName must be ${targetConfig.databaseName}, received ${options.databaseName}`,
    );
  }

  const uriDatabaseName = databaseNameFromUri(options.uri);
  if (uriDatabaseName !== targetConfig.databaseName) {
    throw new SeedConfigError(
      `${targetConfig.uriEnv} must target ${targetConfig.databaseName}, received ${uriDatabaseName}`,
    );
  }

  if (
    options.target === "production" &&
    options.confirmation !== PRODUCTION_ROTATION_CONFIRMATION
  ) {
    throw new SeedConfigError(
      `Production password rotation requires --confirm "${PRODUCTION_ROTATION_CONFIRMATION}"`,
    );
  }
}

export function parseRotationOptions(
  args: readonly string[],
  env: Record<string, string | undefined>,
): RotationOptions {
  const parsed = parseArguments(args);

  if (parsed.target !== "testing" && parsed.target !== "production") {
    throw new SeedConfigError("--target must be either testing or production");
  }

  const targetConfig = SEED_TARGETS[parsed.target];
  const uri = env[targetConfig.uriEnv]?.trim();
  if (!uri) {
    throw new SeedConfigError(`${targetConfig.uriEnv} is required`);
  }

  const options: RotationOptions = {
    target: parsed.target,
    databaseName: targetConfig.databaseName,
    uri,
    apply: parsed.apply,
    confirmation: parsed.confirmation,
  };
  assertRotationOptions(options);
  return options;
}

function validateRotationAccounts(
  accounts: readonly RotationUser[],
): Map<RotationLoginId, RotationUser> {
  const byLoginId = new Map<string, RotationUser>();

  for (const account of accounts) {
    if (!ROTATION_LOGIN_ID_SET.has(account.loginId)) {
      throw new RotationConflictError(
        `Unexpected loginId returned for password rotation: ${account.loginId}`,
      );
    }
    if (byLoginId.has(account.loginId)) {
      throw new RotationConflictError(
        `Duplicate admin account found for ${account.loginId}`,
      );
    }
    byLoginId.set(account.loginId, account);
  }

  for (const loginId of ROTATION_LOGIN_IDS) {
    const account = byLoginId.get(loginId);
    if (!account) {
      throw new RotationConflictError(`Missing admin account ${loginId}`);
    }
    if (account.role !== "admin") {
      throw new RotationConflictError(`Account ${loginId} is not an admin`);
    }
    if (account.isActive !== true) {
      throw new RotationConflictError(`Account ${loginId} is not active`);
    }
    if (typeof account.email !== "string" || account.email.length === 0) {
      throw new RotationConflictError(`Account ${loginId} has no email address`);
    }
  }

  return byLoginId as Map<RotationLoginId, RotationUser>;
}

function buildPasswordRotationExport(
  options: RotationOptions,
  accounts: ReadonlyMap<RotationLoginId, RotationUser>,
  passwords: readonly string[],
  generatedAt: Date,
): PasswordRotationExport {
  const records = ROTATION_LOGIN_IDS.map((loginId, index) => {
    const account = accounts.get(loginId);
    if (!account) {
      throw new RotationConflictError(
        `Missing admin account ${loginId} for credential export`,
      );
    }
    const password = passwords[index];
    if (!password) {
      throw new RotationConflictError(
        `Missing generated password for ${loginId}`,
      );
    }

    return {
      loginId,
      email: account.email,
      role: "admin" as const,
      isActive: true as const,
      password,
      passwordStatus: "rotated" as const,
    };
  });

  return {
    target: options.target,
    databaseName: options.databaseName,
    generatedAt: generatedAt.toISOString(),
    notice: `Passwords were rotated for all listed ${options.target} admin accounts. Store this file securely and delete it after use.`,
    accounts: records,
  };
}

export async function rotateAdminPasswords(
  options: RotationOptions,
  dependencies: RotationDependencies,
): Promise<RotationResult> {
  assertRotationOptions(options);

  const connection = await dependencies.connect(options.uri);

  try {
    assertConnectedDatabaseName(connection.name, options.databaseName);
    dependencies.logger.info(
      `[rotate] target=${options.target} database=${options.databaseName} mode=${options.apply ? "apply" : "dry-run"}`,
    );

    const accounts = await dependencies.findRotationAccounts(ROTATION_LOGIN_IDS);
    const accountsByLoginId = validateRotationAccounts(accounts);

    if (!options.apply) {
      dependencies.logger.info(
        `[rotate] Dry run: ${ROTATION_LOGIN_IDS.length} admin accounts validated; no passwords generated, no export written, and no database changes made`,
      );
      return {
        applied: false,
        rotatedLoginIds: [],
        exportPath: null,
      };
    }

    const passwords = generateUniquePasswords(
      ROTATION_LOGIN_IDS.length,
      dependencies.randomInt,
    );
    const passwordHashes: string[] = [];

    for (const password of passwords) {
      passwordHashes.push(await dependencies.hashPassword(password));
    }

    const exportData = buildPasswordRotationExport(
      options,
      accountsByLoginId,
      passwords,
      dependencies.now(),
    );
    const exportPath = await dependencies.writeExport(exportData);
    dependencies.logger.info(`[rotate] Wrote credential export to ${exportPath}`);

    for (let index = 0; index < ROTATION_LOGIN_IDS.length; index += 1) {
      const loginId = ROTATION_LOGIN_IDS[index];
      const account = loginId ? accountsByLoginId.get(loginId) : undefined;
      const passwordHash = passwordHashes[index];
      if (!loginId || !account || !passwordHash) {
        throw new RotationConflictError(
          "Missing account or password hash during password update",
        );
      }

      await dependencies.updatePassword({
        id: account._id,
        loginId,
        passwordHash,
      });
      dependencies.logger.info(`[rotate] Rotated password for ${loginId}`);
    }

    return {
      applied: true,
      rotatedLoginIds: [...ROTATION_LOGIN_IDS],
      exportPath,
    };
  } finally {
    await dependencies.disconnect();
  }
}

export function createRotationDependencies(
  logger: RotationLogger = console,
): RotationDependencies {
  return {
    connect: async (uri) => {
      await mongoose.connect(uri, CONNECTION_OPTIONS);
      return { name: mongoose.connection.name };
    },
    disconnect: async () => {
      await mongoose.disconnect();
    },
    findRotationAccounts: async (loginIds) =>
      (await User.find({ loginId: { $in: loginIds } })
        .select("loginId email role isActive")
        .lean()) as unknown as RotationUser[],
    hashPassword,
    randomInt: secureRandomInt,
    writeExport: async (exportData) =>
      writePasswordRotationExport(exportData),
    now: () => new Date(),
    updatePassword: async ({ id, loginId, passwordHash }) => {
      const result = await User.updateOne(
        {
          _id: id as Types.ObjectId,
          loginId,
          role: "admin",
          isActive: true,
        },
        { $set: { passwordHash } },
        { timestamps: false },
      );
      if (result.matchedCount !== 1) {
        throw new RotationConflictError(
          `Admin account ${loginId} changed during password rotation`,
        );
      }
    },
    logger,
  };
}

async function runCli(): Promise<void> {
  const options = parseRotationOptions(process.argv.slice(2), process.env);
  const result = await rotateAdminPasswords(
    options,
    createRotationDependencies(),
  );

  if (!result.applied) {
    console.log(
      "[rotate] Dry run complete. No passwords were generated, no export was written, and no database changes were made.",
    );
    return;
  }

  console.log("[rotate] Password rotation complete.");
}

if (require.main === module) {
  runCli().catch((error: unknown) => {
    console.error(`[rotate] Failed: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
