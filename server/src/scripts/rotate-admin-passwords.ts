import { randomInt as secureRandomInt } from "node:crypto";
import mongoose, { Types } from "mongoose";
import {
  SEED_TARGETS,
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
  parseSeedOptions,
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

export const PASSPHRASE_WORD_COUNT = 6;
export const PASSPHRASE_DIGIT_COUNT = 3;

export const PASSWORD_WORDS = [
  "amber", "anchor", "apple", "arbor", "atlas", "aurora", "autumn", "avenue",
  "badge", "basket", "beacon", "birch", "blossom", "breeze", "bridge", "brook",
  "canyon", "cedar", "chart", "cherry", "circle", "clarity", "clover", "cobalt",
  "comet", "coral", "cotton", "cradle", "crest", "crystal", "cupcake", "dahlia",
  "dawn", "delta", "denim", "desert", "diamond", "dolphin", "dragon", "drizzle",
  "eagle", "ember", "emerald", "engine", "evening", "fabric", "falcon", "fern",
  "field", "forest", "fossil", "fountain", "garden", "garlic", "glacier", "globe",
  "golden", "granite", "grape", "harbor", "harmony", "harp", "hazel", "helix",
  "horizon", "island", "ivory", "jade", "jungle", "kernel", "lantern", "lava",
  "lemon", "lilac", "limestone", "lobster", "maple", "marble", "meadow", "melody",
  "memory", "mercury", "meteor", "mirror", "mist", "mountain", "mushroom", "nectar",
  "needle", "neon", "nest", "noble", "north", "ocean", "olive", "orbit",
  "orchid", "otter", "palette", "paper", "parcel", "passenger", "path", "pebble",
  "pearl", "pepper", "pine", "plateau", "plum", "prairie", "pulse", "puzzle",
  "quartz", "quiet", "rainbow", "raven", "river", "robin", "rocket", "rose",
  "ruby", "saddle", "sage", "sand", "saturn", "silver", "slate", "snow",
  "solar", "sparrow", "spring", "stable", "star", "stone", "storm", "sunflower",
  "sunset", "swan", "tablet", "tapestry", "temple", "thistle", "thunder", "timber",
  "tulip", "valley", "velvet", "violet", "voyage", "walnut", "waterfall", "willow",
  "winter", "wonder", "yellow", "zephyr", "zircon", "acorn", "almond", "amethyst",
  "anise", "apricot", "basil", "beaker", "bell", "berry", "blanket", "bloom",
  "brick", "bronze", "bubble", "bucket", "butterfly", "camera", "candle", "caramel",
  "cardinal", "carnation", "cascade", "castle", "cavern", "cello", "chalk", "charm",
  "cheese", "chestnut", "chimney", "cinnamon", "circus", "citrine", "coconut", "coffee",
  "compass", "copper", "cosmos", "dandelion", "deck", "dictionary", "dimple", "dungeon",
  "echo", "eclipse", "elephant", "ellipse", "fan", "feather", "ferry", "fig",
  "filter", "finch", "flame", "flask", "flute", "fog", "fuel", "galaxy",
  "game", "gardenia", "gate", "ginger", "giraffe", "glass", "glow", "goose",
  "guitar", "hammock", "helmet", "hill", "honey", "hope", "hummingbird", "ink",
  "iris", "jacket", "jelly", "jewel", "journey", "kettle", "kite", "ladder",
  "lagoon", "lamp", "leaf", "library", "lightning", "lily", "magnet", "magnolia",
  "majestic", "mango", "mosaic", "moss", "motor", "muffin", "napkin", "night",
] as const;

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
  target: "testing";
  databaseName: string;
  uri: string;
  apply: boolean;
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

function isValidRandomIndex(index: number, maxExclusive: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < maxExclusive;
}

export function generatePassphrase(randomInt: RandomInt = secureRandomInt): string {
  const words: string[] = [];

  for (let index = 0; index < PASSPHRASE_WORD_COUNT; index += 1) {
    const wordIndex = randomInt(PASSWORD_WORDS.length);
    if (!isValidRandomIndex(wordIndex, PASSWORD_WORDS.length)) {
      throw new RotationConflictError("Random word index was invalid");
    }
    const word = PASSWORD_WORDS[wordIndex];
    if (!word) {
      throw new RotationConflictError("Random word selection failed");
    }
    words.push(word);
  }

  const digits: string[] = [];
  for (let index = 0; index < PASSPHRASE_DIGIT_COUNT; index += 1) {
    const digit = randomInt(10);
    if (!isValidRandomIndex(digit, 10)) {
      throw new RotationConflictError("Random digit was invalid");
    }
    digits.push(String(digit));
  }

  return `${words.join("-")}-${digits.join("")}`;
}

export function generateUniquePassphrases(
  count: number,
  randomInt: RandomInt = secureRandomInt,
): string[] {
  const passphrases = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    let generated: string | undefined;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = generatePassphrase(randomInt);
      if (!passphrases.has(candidate)) {
        generated = candidate;
        break;
      }
    }
    if (!generated) {
      throw new RotationConflictError(
        "Unable to generate unique admin passphrases",
      );
    }
    passphrases.add(generated);
  }

  return [...passphrases];
}

export function parseRotationOptions(
  args: readonly string[],
  env: Record<string, string | undefined>,
): RotationOptions {
  let apply = false;

  for (const arg of args) {
    if (arg === "--apply") {
      if (apply) {
        throw new SeedConfigError("--apply was provided more than once");
      }
      apply = true;
      continue;
    }

    if (arg === "--target" || arg.startsWith("--target=")) {
      throw new SeedConfigError(
        "Password rotation only supports the testing target; do not pass --target",
      );
    }

    throw new SeedConfigError(`Unknown argument: ${arg}`);
  }

  const testing = parseSeedOptions(["--target", "testing"], env);
  return {
    target: "testing",
    databaseName: testing.databaseName,
    uri: testing.uri,
    apply,
  };
}

function assertTestingOptions(options: RotationOptions): void {
  if (
    options.target !== "testing" ||
    options.databaseName !== SEED_TARGETS.testing.databaseName
  ) {
    throw new SeedConfigError("Password rotation only supports the testing target");
  }

  const uriDatabaseName = databaseNameFromUri(options.uri);
  if (uriDatabaseName !== SEED_TARGETS.testing.databaseName) {
    throw new SeedConfigError(
      `TESTING_MONGODB_URI must target ${SEED_TARGETS.testing.databaseName}, received ${uriDatabaseName}`,
    );
  }
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
  passphrases: readonly string[],
  generatedAt: Date,
): PasswordRotationExport {
  const records = ROTATION_LOGIN_IDS.map((loginId, index) => {
    const account = accounts.get(loginId);
    if (!account) {
      throw new RotationConflictError(
        `Missing admin account ${loginId} for credential export`,
      );
    }
    const password = passphrases[index];
    if (!password) {
      throw new RotationConflictError(
        `Missing generated passphrase for ${loginId}`,
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
    target: "testing",
    databaseName: options.databaseName,
    generatedAt: generatedAt.toISOString(),
    notice:
      "Passwords were rotated for all listed testing admin accounts. Store this file securely and delete it after use.",
    accounts: records,
  };
}

export async function rotateAdminPasswords(
  options: RotationOptions,
  dependencies: RotationDependencies,
): Promise<RotationResult> {
  assertTestingOptions(options);

  const connection = await dependencies.connect(options.uri);

  try {
    assertConnectedDatabaseName(connection.name, options.databaseName);
    dependencies.logger.info(
      `[rotate] target=testing database=${options.databaseName} mode=${options.apply ? "apply" : "dry-run"}`,
    );

    const accounts = await dependencies.findRotationAccounts(ROTATION_LOGIN_IDS);
    const accountsByLoginId = validateRotationAccounts(accounts);

    if (!options.apply) {
      dependencies.logger.info(
        "[rotate] Dry run: 7 admin accounts validated; no passwords generated, no export written, and no database changes made",
      );
      return {
        applied: false,
        rotatedLoginIds: [],
        exportPath: null,
      };
    }

    const passphrases = generateUniquePassphrases(
      ROTATION_LOGIN_IDS.length,
      dependencies.randomInt,
    );
    const passwordHashes: string[] = [];

    for (const passphrase of passphrases) {
      passwordHashes.push(await dependencies.hashPassword(passphrase));
    }

    const exportData = buildPasswordRotationExport(
      options,
      accountsByLoginId,
      passphrases,
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
