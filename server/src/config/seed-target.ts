export const SEED_TARGETS = {
  testing: {
    databaseName: "venture_craft_testing",
    uriEnv: "TESTING_MONGODB_URI",
  },
  production: {
    databaseName: "student_ranking",
    uriEnv: "PRODUCTION_MONGODB_URI",
  },
} as const;

export type SeedTarget = keyof typeof SEED_TARGETS;

export const PRODUCTION_CONFIRMATION = "SEED PRODUCTION ADMINS";

export class SeedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConfigError";
  }
}

export interface SeedOptions {
  target: SeedTarget;
  databaseName: string;
  uri: string;
  apply: boolean;
  confirmation: string | undefined;
}

interface ParsedArguments {
  target: string | undefined;
  apply: boolean;
  confirmation: string | undefined;
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

function parseArguments(args: readonly string[]): ParsedArguments {
  const parsed: ParsedArguments = {
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
      parsed.target = arg === "--target"
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
      parsed.confirmation = arg === "--confirm"
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

export function databaseNameFromUri(uri: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new SeedConfigError("MongoDB URI could not be parsed");
  }

  if (parsed.protocol !== "mongodb:" && parsed.protocol !== "mongodb+srv:") {
    throw new SeedConfigError("MongoDB URI must use mongodb or mongodb+srv");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName) {
    throw new SeedConfigError("MongoDB URI must include an explicit database name");
  }

  return databaseName;
}

export function parseSeedOptions(
  args: readonly string[],
  env: Record<string, string | undefined>,
): SeedOptions {
  const parsed = parseArguments(args);

  if (parsed.target !== "testing" && parsed.target !== "production") {
    throw new SeedConfigError("--target must be either testing or production");
  }

  const targetConfig = SEED_TARGETS[parsed.target];
  const uri = env[targetConfig.uriEnv]?.trim();

  if (!uri) {
    throw new SeedConfigError(`${targetConfig.uriEnv} is required`);
  }

  const uriDatabaseName = databaseNameFromUri(uri);
  if (uriDatabaseName !== targetConfig.databaseName) {
    throw new SeedConfigError(
      `${targetConfig.uriEnv} must target ${targetConfig.databaseName}, received ${uriDatabaseName}`,
    );
  }

  if (
    parsed.target === "production" &&
    parsed.apply &&
    parsed.confirmation !== PRODUCTION_CONFIRMATION
  ) {
    throw new SeedConfigError(
      `Production writes require --confirm "${PRODUCTION_CONFIRMATION}"`,
    );
  }

  return {
    target: parsed.target,
    databaseName: targetConfig.databaseName,
    uri,
    apply: parsed.apply,
    confirmation: parsed.confirmation,
  };
}

export function assertConnectedDatabaseName(
  actualDatabaseName: string,
  expectedDatabaseName: string,
): void {
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new SeedConfigError(
      `Connected database ${actualDatabaseName || "<none>"} does not match expected ${expectedDatabaseName}`,
    );
  }
}
