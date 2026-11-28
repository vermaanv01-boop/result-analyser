import mongoose, { Types } from "mongoose";
import {
  SEED_TARGETS,
  SeedConfigError,
  assertConnectedDatabaseName,
  databaseNameFromUri,
} from "../config/seed-target";
import { Competition } from "../models/competition.model";
import { Panel } from "../models/panel.model";
import { Participant } from "../models/participant.model";
import { LOGIN_ID_PATTERN, User } from "../models/user.model";
import { hashPassword } from "../services/auth.service";
import {
  generateUniquePasswords,
  PASSWORD_ALPHABETIC_COUNT,
  PASSWORD_DIGIT_COUNT,
  PASSWORD_LENGTH,
  PASSWORD_SPECIAL_CHARACTERS,
  PASSWORD_SPECIAL_COUNT,
  ROTATION_LOGIN_IDS,
} from "./rotate-admin-passwords";
import {
  writeTestingAccountExport,
  type TestingAccountExport,
} from "../utils/credential-export";
import { describeError } from "../utils/safe-log";
import { ROUND_IDENTIFIERS, type RoundIdentifier } from "../types/domain.types";

export { ROTATION_LOGIN_IDS };

export const PARTICIPANT_COUNT = 30;
export const JUDGE_COUNT = 10;
export const TOTAL_ACCOUNT_COUNT = PARTICIPANT_COUNT + JUDGE_COUNT;
export const TESTING_SEED_TOTAL_ACCOUNT_COUNT = TOTAL_ACCOUNT_COUNT;
export const DEFAULT_TESTING_PANEL_NAME = "Testing Account Seed Panel";
export const TESTING_EMAIL_DOMAIN = "testing.venturecraft.invalid";
export const USER_LOGIN_ID_INDEX_NAME = "user_loginId_unique";
export const PARTICIPANT_REGISTRATION_INDEX_NAME =
  "participant_competition_registrationId";

const ADMIN_LOGIN_ID_SET: ReadonlySet<string> = new Set<string>(
  ROTATION_LOGIN_IDS,
);
const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  bufferCommands: false,
  maxPoolSize: 10,
  minPoolSize: 0,
} as const;

export class TestingSeedConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestingSeedConflictError";
  }
}

export interface TestingSeedOptions {
  target: "testing";
  databaseName: string;
  uri: string;
  apply: boolean;
  competitionId: string;
  panelName: string;
}

export interface SeedUser {
  _id: unknown;
  name?: string;
  email: string;
  loginId: string | null | undefined;
  role: string;
  isActive: boolean;
}

export interface CompetitionRecord {
  _id: unknown;
  status: string;
}

export interface PanelRecord {
  _id: unknown;
  competition: unknown;
  name: string;
  judges: unknown[];
  isActive: boolean;
}

export interface EligibilityRecord {
  round: RoundIdentifier;
  eligible: boolean;
  ineligibleReason: string | null;
  updatedAt: Date;
}

export interface ParticipantRecord {
  _id: unknown;
  competition: unknown;
  user: unknown | null;
  name: string;
  registrationId: string;
  email: string | null;
  panel: unknown | null;
  teamMembers: string[];
  isActive: boolean;
  eligibility: EligibilityRecord[];
}

interface CollectionIndex {
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  name?: string;
}

export interface SeedLogger {
  info(message: string): void;
}

export interface CreateTestingUserInput {
  name: string;
  email: string;
  loginId: string;
  passwordHash: string;
  role: "judge" | "participant";
  isActive: true;
}

export interface CreateTestingPanelInput {
  competition: string;
  name: string;
  judges: unknown[];
  isActive: true;
}

export interface CreateTestingParticipantInput {
  competition: string;
  user: string;
  name: string;
  registrationId: string;
  email: string;
  panel: string;
  teamMembers: string[];
  isActive: true;
  eligibility: EligibilityRecord[];
}

export type MissingIndexAction =
  | "userLoginId"
  | "userEmail"
  | "participantRegistrationId";

export interface TestingSeedDependencies {
  connect(uri: string): Promise<{ name: string }>;
  disconnect(): Promise<void>;
  findCompetitionById(id: string): Promise<CompetitionRecord | null>;
  listUserIndexes(): Promise<CollectionIndex[]>;
  listParticipantIndexes(): Promise<CollectionIndex[]>;
  createUserLoginIdIndex(): Promise<void>;
  createUserEmailIndex(): Promise<void>;
  createParticipantRegistrationIdIndex(): Promise<void>;
  findAllUsersWithLoginId(): Promise<SeedUser[]>;
  findUsersByLoginIds(loginIds: readonly string[]): Promise<SeedUser[]>;
  findUsersByEmails(emails: readonly string[]): Promise<SeedUser[]>;
  findPanelsByCompetition(competitionId: string): Promise<PanelRecord[]>;
  findParticipantsByCompetition(
    competitionId: string,
  ): Promise<ParticipantRecord[]>;
  createUser(input: CreateTestingUserInput): Promise<SeedUser>;
  createPanel(input: CreateTestingPanelInput): Promise<PanelRecord>;
  createParticipant(
    input: CreateTestingParticipantInput,
  ): Promise<ParticipantRecord>;
  hashPassword(password: string): Promise<string>;
  generatePasswords(count: number): string[];
  writeExport(exportData: TestingAccountExport): Promise<string>;
  now(): Date;
  logger: SeedLogger;
}

export interface TestingSeedResult {
  applied: boolean;
  createdParticipantLoginIds: string[];
  createdJudgeLoginIds: string[];
  panelCreated: boolean;
  exportPath: string | null;
}

interface ParsedTestingArguments {
  target: string | undefined;
  apply: boolean;
  competitionId: string | undefined;
  panelName: string | undefined;
}

type AccountRole = "judge" | "participant";

interface AccountSpec {
  code: string;
  loginId: string;
  email: string;
  name: string;
  role: AccountRole;
  registrationId: string | null;
}

interface UserState {
  allUsersExist: boolean;
  existingUserIdsByLoginId: Map<string, string>;
}

interface PanelState {
  targetPanel: PanelRecord | null;
  createPanel: boolean;
}

function idToString(id: unknown): string {
  return String(id);
}

function code(prefix: "TEST-TEAM" | "TEST-JDG", index: number): string {
  return `${prefix}-${String(index).padStart(3, "0")}`;
}

function normalizedIds(values: readonly string[]): string[] {
  return values.map((value) => value.trim().toLowerCase());
}

export const PARTICIPANT_REGISTRATION_IDS: readonly string[] = Array.from(
  { length: PARTICIPANT_COUNT },
  (_, index) => code("TEST-TEAM", index + 1),
);

export const JUDGE_CODES: readonly string[] = Array.from(
  { length: JUDGE_COUNT },
  (_, index) => code("TEST-JDG", index + 1),
);

function buildAccounts(): AccountSpec[] {
  const participants = PARTICIPANT_REGISTRATION_IDS.map((registrationId, index) => {
    const loginId = registrationId.toLowerCase();
    return {
      code: registrationId,
      loginId,
      email: `${loginId}@${TESTING_EMAIL_DOMAIN}`,
      name: `TEST Team ${String(index + 1).padStart(3, "0")}`,
      role: "participant" as const,
      registrationId,
    };
  });

  const judges = JUDGE_CODES.map((judgeCode, index) => {
    const loginId = judgeCode.toLowerCase();
    return {
      code: judgeCode,
      loginId,
      email: `${loginId}@${TESTING_EMAIL_DOMAIN}`,
      name: `TEST Judge ${String(index + 1).padStart(3, "0")}`,
      role: "judge" as const,
      registrationId: null,
    };
  });

  return [...participants, ...judges];
}

function createEligibility(now: Date): EligibilityRecord[] {
  return ROUND_IDENTIFIERS.map((round) => ({
    round,
    eligible: true,
    ineligibleReason: null,
    updatedAt: now,
  }));
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

function parseArguments(args: readonly string[]): ParsedTestingArguments {
  const parsed: ParsedTestingArguments = {
    target: undefined,
    apply: false,
    competitionId: undefined,
    panelName: undefined,
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

    if (
      arg === "--competition-id" ||
      arg.startsWith("--competition-id=")
    ) {
      if (parsed.competitionId !== undefined) {
        throw new SeedConfigError("--competition-id was provided more than once");
      }
      parsed.competitionId =
        arg === "--competition-id"
          ? readValue(args, index + 1, "--competition-id")
          : arg.slice("--competition-id=".length);
      if (arg === "--competition-id") {
        index += 1;
      }
      continue;
    }

    if (arg === "--panel-name" || arg.startsWith("--panel-name=")) {
      if (parsed.panelName !== undefined) {
        throw new SeedConfigError("--panel-name was provided more than once");
      }
      parsed.panelName =
        arg === "--panel-name"
          ? readValue(args, index + 1, "--panel-name")
          : arg.slice("--panel-name=".length);
      if (arg === "--panel-name") {
        index += 1;
      }
      continue;
    }

    throw new SeedConfigError(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function assertTestingSeedOptions(
  options: TestingSeedOptions,
): void {
  if (options.target !== "testing") {
    throw new SeedConfigError("This seeder only allows --target testing");
  }

  const targetConfig = SEED_TARGETS.testing;
  if (options.databaseName !== targetConfig.databaseName) {
    throw new SeedConfigError(
      `testing databaseName must be ${targetConfig.databaseName}, received ${options.databaseName}`,
    );
  }

  const uriDatabaseName = databaseNameFromUri(options.uri);
  if (uriDatabaseName !== targetConfig.databaseName) {
    throw new SeedConfigError(
      `${targetConfig.uriEnv} must target ${targetConfig.databaseName}, received ${uriDatabaseName}`,
    );
  }

  if (!OBJECT_ID_PATTERN.test(options.competitionId)) {
    throw new SeedConfigError("--competition-id must be a 24-character ObjectId");
  }

  const panelName = options.panelName.trim();
  if (panelName.length < 1 || panelName.length > 200) {
    throw new SeedConfigError("--panel-name must be between 1 and 200 characters");
  }
}

export function parseTestingSeedOptions(
  args: readonly string[],
  env: Record<string, string | undefined>,
): TestingSeedOptions {
  const parsed = parseArguments(args);

  if (parsed.target !== "testing") {
    throw new SeedConfigError("This seeder only allows --target testing");
  }
  if (parsed.competitionId === undefined) {
    throw new SeedConfigError("--competition-id is required");
  }

  const uri = env[SEED_TARGETS.testing.uriEnv]?.trim();
  if (!uri) {
    throw new SeedConfigError(`${SEED_TARGETS.testing.uriEnv} is required`);
  }

  const options: TestingSeedOptions = {
    target: "testing",
    databaseName: SEED_TARGETS.testing.databaseName,
    uri,
    apply: parsed.apply,
    competitionId: parsed.competitionId,
    panelName: parsed.panelName ?? DEFAULT_TESTING_PANEL_NAME,
  };

  assertTestingSeedOptions(options);
  return options;
}

function assertNormalizedLoginIds(users: readonly SeedUser[]): void {
  const seen = new Set<string>();

  for (const user of users) {
    const loginId = user.loginId;
    if (typeof loginId !== "string" || loginId.length === 0) {
      throw new TestingSeedConflictError("Found a null or empty loginId value");
    }

    const normalized = loginId.trim().toLowerCase();
    if (normalized !== loginId) {
      throw new TestingSeedConflictError("Found a non-normalized loginId value");
    }
    if (!LOGIN_ID_PATTERN.test(normalized)) {
      throw new TestingSeedConflictError("Found an invalid loginId value");
    }
    if (seen.has(normalized)) {
      throw new TestingSeedConflictError(`Duplicate loginId found: ${normalized}`);
    }
    seen.add(normalized);
  }
}

function assertPasswordFormat(password: string): void {
  const letters = [...password].filter((character) =>
    /[A-Za-z]/.test(character),
  ).length;
  const digits = [...password].filter((character) =>
    /[0-9]/.test(character),
  ).length;
  const specials = [...password].filter((character) =>
    PASSWORD_SPECIAL_CHARACTERS.includes(character),
  ).length;

  if (
    password.length !== PASSWORD_LENGTH ||
    letters !== PASSWORD_ALPHABETIC_COUNT ||
    digits !== PASSWORD_DIGIT_COUNT ||
    specials !== PASSWORD_SPECIAL_COUNT
  ) {
    throw new TestingSeedConflictError(
      "Generated password did not match the required format",
    );
  }
}

function assertUserState(
  accounts: readonly AccountSpec[],
  allLoginIds: readonly SeedUser[],
  loginMatchesByLoginId: ReadonlyMap<string, SeedUser[]>,
  emailMatchesByEmail: ReadonlyMap<string, SeedUser[]>,
): UserState {
  assertNormalizedLoginIds(allLoginIds);

  const existingUserIdsByLoginId = new Map<string, string>();

  for (const account of accounts) {
    if (ADMIN_LOGIN_ID_SET.has(account.loginId)) {
      throw new TestingSeedConflictError(
        `Refusing to overwrite protected admin account ${account.loginId}`,
      );
    }

    const loginMatches = loginMatchesByLoginId.get(account.loginId) ?? [];
    const emailMatches = emailMatchesByEmail.get(account.email) ?? [];

    if (loginMatches.length > 1) {
      throw new TestingSeedConflictError(
        `Multiple accounts use loginId ${account.loginId}`,
      );
    }
    if (emailMatches.length > 1) {
      throw new TestingSeedConflictError(
        `Multiple accounts use the testing email for ${account.loginId}`,
      );
    }

    const loginUser = loginMatches[0];
    const emailUser = emailMatches[0];

    if (
      loginUser &&
      emailUser &&
      idToString(loginUser._id) !== idToString(emailUser._id)
    ) {
      throw new TestingSeedConflictError(
        `loginId and email for ${account.loginId} identify different accounts`,
      );
    }

    if (emailUser && !loginUser) {
      throw new TestingSeedConflictError(
        `Testing email for ${account.loginId} is already used by another account`,
      );
    }

    if (loginUser) {
      if (loginUser.role !== account.role) {
        throw new TestingSeedConflictError(
          `Existing account ${account.loginId} has an unexpected role`,
        );
      }
      if (loginUser.isActive !== true) {
        throw new TestingSeedConflictError(
          `Existing account ${account.loginId} is not active`,
        );
      }
      if (loginUser.email !== account.email) {
        throw new TestingSeedConflictError(
          `Existing account ${account.loginId} has an unexpected email`,
        );
      }
      if (loginUser.name !== undefined && loginUser.name !== account.name) {
        throw new TestingSeedConflictError(
          `Existing account ${account.loginId} has an unexpected name`,
        );
      }
      existingUserIdsByLoginId.set(account.loginId, idToString(loginUser._id));
    }
  }

  if (
    existingUserIdsByLoginId.size > 0 &&
    existingUserIdsByLoginId.size < accounts.length
  ) {
    throw new TestingSeedConflictError(
      "Partial testing account state detected; refusing to create or modify accounts",
    );
  }

  return {
    allUsersExist: existingUserIdsByLoginId.size === accounts.length,
    existingUserIdsByLoginId,
  };
}

function assertUserIndexes(
  indexes: readonly CollectionIndex[],
  missing: Set<MissingIndexAction>,
): void {
  const loginIdIndexes = indexes.filter(
    (index) =>
      Object.keys(index.key).length === 1 && index.key["loginId"] === 1,
  );
  const incompatibleLoginIdIndex = loginIdIndexes.find(
    (index) => index.unique !== true || index.sparse !== true,
  );
  if (incompatibleLoginIdIndex) {
    throw new TestingSeedConflictError(
      "Existing loginId index is not a unique sparse single-field index",
    );
  }
  if (loginIdIndexes.length === 0) {
    missing.add("userLoginId");
  }

  const emailIndexes = indexes.filter(
    (index) => Object.keys(index.key).length === 1 && index.key["email"] === 1,
  );
  const incompatibleEmailIndex = emailIndexes.find(
    (index) => index.unique !== true,
  );
  if (incompatibleEmailIndex) {
    throw new TestingSeedConflictError(
      "Existing email index is not a unique single-field index",
    );
  }
  if (emailIndexes.length === 0) {
    missing.add("userEmail");
  }
}

function assertParticipantIndexes(
  indexes: readonly CollectionIndex[],
  missing: Set<MissingIndexAction>,
): void {
  const registrationIndexes = indexes.filter(
    (index) =>
      Object.keys(index.key).length === 2 &&
      index.key["competition"] === 1 &&
      index.key["registrationId"] === 1,
  );
  const incompatibleIndex = registrationIndexes.find(
    (index) => index.unique !== true,
  );

  if (incompatibleIndex) {
    throw new TestingSeedConflictError(
      "Existing participant competition/registrationId index is not unique",
    );
  }
  if (registrationIndexes.length === 0) {
    missing.add("participantRegistrationId");
  }
}

function assertPanelState(
  panels: readonly PanelRecord[],
  judgeIds: readonly string[],
  allUsersExist: boolean,
  panelName: string,
): PanelState {
  const namedPanels = panels.filter((panel) => panel.name === panelName);

  if (namedPanels.length > 1) {
    throw new TestingSeedConflictError(
      "Multiple panels use the configured testing panel name; refusing to choose one",
    );
  }

  const targetPanel = namedPanels[0];
  if (targetPanel) {
    if (!targetPanel.isActive) {
      throw new TestingSeedConflictError(
        "Configured testing panel is inactive; refusing to reuse it",
      );
    }

    const actualJudgeIds = new Set(targetPanel.judges.map(idToString));
    if (
      actualJudgeIds.size !== judgeIds.length ||
      judgeIds.some((judgeId) => !actualJudgeIds.has(judgeId))
    ) {
      throw new TestingSeedConflictError(
        "Configured testing panel has conflicting judge assignments",
      );
    }
    if (!allUsersExist) {
      throw new TestingSeedConflictError(
        "Testing panel exists without the complete seeded account state",
      );
    }

    return { targetPanel, createPanel: false };
  }

  if (allUsersExist) {
    throw new TestingSeedConflictError(
      "Seeded accounts exist but the configured panel is missing",
    );
  }

  for (const panel of panels) {
    const assigned = panel.judges.map(idToString);
    if (judgeIds.some((judgeId) => assigned.includes(judgeId))) {
      throw new TestingSeedConflictError(
        "A seeded judge is already assigned to another panel; refusing to change judge assignments",
      );
    }
  }

  return { targetPanel: null, createPanel: true };
}

function assertEligibilityMatches(
  actual: readonly EligibilityRecord[],
  expected: readonly EligibilityRecord[],
  registrationId: string,
): void {
  if (actual.length !== expected.length) {
    throw new TestingSeedConflictError(
      `Participant ${registrationId} has conflicting eligibility data`,
    );
  }

  for (const round of ROUND_IDENTIFIERS) {
    const actualEntry = actual.find((entry) => entry.round === round);
    const expectedEntry = expected.find((entry) => entry.round === round);
    if (
      !actualEntry ||
      !expectedEntry ||
      actualEntry.eligible !== expectedEntry.eligible ||
      actualEntry.ineligibleReason !== expectedEntry.ineligibleReason
    ) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} has conflicting eligibility data for round ${round}`,
      );
    }
  }
}

function assertParticipantsState(
  options: TestingSeedOptions,
  accounts: readonly AccountSpec[],
  participants: readonly ParticipantRecord[],
  userState: UserState,
  panelState: PanelState,
  expectedEligibility: readonly EligibilityRecord[],
): void {
  const expectedPanelId = panelState.targetPanel
    ? idToString(panelState.targetPanel._id)
    : null;
  const expectedByRegistrationId = new Map<string, AccountSpec>();
  const expectedByLoginId = new Map<string, AccountSpec>();

  for (const account of accounts) {
    if (account.role !== "participant" || !account.registrationId) {
      continue;
    }
    expectedByRegistrationId.set(account.registrationId, account);
    expectedByLoginId.set(account.loginId, account);
  }

  let existingCount = 0;

  for (const [registrationId, account] of expectedByRegistrationId) {
    const matches = participants.filter(
      (participant) => participant.registrationId === registrationId,
    );
    if (matches.length > 1) {
      throw new TestingSeedConflictError(
        `Multiple participants use registrationId ${registrationId}`,
      );
    }

    const participant = matches[0];
    if (!participant) {
      continue;
    }
    existingCount += 1;

    const expectedUserId = userState.existingUserIdsByLoginId.get(
      account.loginId,
    );
    if (!expectedUserId || idToString(participant.user) !== expectedUserId) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} has a conflicting user assignment`,
      );
    }
    if (idToString(participant.competition) !== options.competitionId) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} belongs to a different competition`,
      );
    }
    if (participant.name !== account.name) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} has an unexpected team name`,
      );
    }
    if (participant.email !== account.email) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} has an unexpected email`,
      );
    }
    if (!expectedPanelId || idToString(participant.panel) !== expectedPanelId) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} has a conflicting panel assignment`,
      );
    }
    if (
      !Array.isArray(participant.teamMembers) ||
      participant.teamMembers.length !== 0
    ) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} has unexpected team members`,
      );
    }
    if (participant.isActive !== true) {
      throw new TestingSeedConflictError(
        `Participant ${registrationId} is not active`,
      );
    }
    assertEligibilityMatches(
      participant.eligibility,
      expectedEligibility,
      registrationId,
    );
  }

  for (const participant of participants) {
    if (participant.user === null || participant.user === undefined) {
      continue;
    }
    const userId = idToString(participant.user);
    for (const [loginId, account] of expectedByLoginId) {
      const expectedUserId = userState.existingUserIdsByLoginId.get(loginId);
      if (
        expectedUserId === userId &&
        participant.registrationId !== account.registrationId
      ) {
        throw new TestingSeedConflictError(
          `Seeded participant user ${loginId} has a conflicting registrationId`,
        );
      }
    }
  }

  const participantCount = expectedByRegistrationId.size;
  if (existingCount > 0 && existingCount < participantCount) {
    throw new TestingSeedConflictError(
      "Partial participant state detected; refusing to create or modify participants",
    );
  }
  if (userState.allUsersExist && existingCount !== participantCount) {
    throw new TestingSeedConflictError(
      "Seeded users exist without complete participant records",
    );
  }
  if (!userState.allUsersExist && existingCount !== 0) {
    throw new TestingSeedConflictError(
      "Participant records exist without the complete seeded user state",
    );
  }
}

async function ensureIndexes(
  dependencies: TestingSeedDependencies,
  missing: ReadonlySet<MissingIndexAction>,
): Promise<void> {
  if (missing.has("userLoginId")) {
    await dependencies.createUserLoginIdIndex();
    dependencies.logger.info(
      `[seed] Created unique sparse loginId index ${USER_LOGIN_ID_INDEX_NAME}`,
    );
  }
  if (missing.has("userEmail")) {
    await dependencies.createUserEmailIndex();
    dependencies.logger.info("[seed] Created unique email index");
  }
  if (missing.has("participantRegistrationId")) {
    await dependencies.createParticipantRegistrationIdIndex();
    dependencies.logger.info(
      `[seed] Created unique participant registrationId index ${PARTICIPANT_REGISTRATION_INDEX_NAME}`,
    );
  }
}

function buildCredentialExport(
  options: TestingSeedOptions,
  accounts: readonly AccountSpec[],
  passwords: readonly string[],
): TestingAccountExport {
  return {
    target: "testing",
    databaseName: options.databaseName,
    competitionId: options.competitionId,
    panelName: options.panelName.trim(),
    generatedAt: new Date().toISOString(),
    notice:
      "Passwords are included for these newly created testing accounts only. Existing accounts were not modified.",
    accounts: accounts.map((account, index) => {
      const password = passwords[index];
      if (!password) {
        throw new TestingSeedConflictError("Missing generated password");
      }
      return {
        loginId: account.loginId,
        email: account.email,
        role: account.role,
        isActive: true as const,
        registrationId: account.registrationId,
        password,
        passwordStatus: "created" as const,
      };
    }),
  };
}

async function applySeed(
  options: TestingSeedOptions,
  dependencies: TestingSeedDependencies,
  accounts: readonly AccountSpec[],
  panelState: PanelState,
  missingIndexes: ReadonlySet<MissingIndexAction>,
): Promise<string> {
  const passwords = dependencies.generatePasswords(TOTAL_ACCOUNT_COUNT);
  if (passwords.length !== TOTAL_ACCOUNT_COUNT) {
    throw new TestingSeedConflictError("Incorrect number of passwords generated");
  }
  if (new Set(passwords).size !== passwords.length) {
    throw new TestingSeedConflictError("Generated passwords were not unique");
  }
  for (const password of passwords) {
    assertPasswordFormat(password);
  }

  const exportPath = await dependencies.writeExport(
    buildCredentialExport(options, accounts, passwords),
  );
  dependencies.logger.info(`[seed] Wrote credential export to ${exportPath}`);

  await ensureIndexes(dependencies, missingIndexes);

  const userIdsByLoginId = new Map<string, string>();
  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index];
    const password = passwords[index];
    if (!account || !password) {
      throw new TestingSeedConflictError("Missing account or password in seed plan");
    }
    const created = await dependencies.createUser({
      name: account.name,
      email: account.email,
      loginId: account.loginId,
      passwordHash: await dependencies.hashPassword(password),
      role: account.role,
      isActive: true,
    });
    userIdsByLoginId.set(account.loginId, idToString(created._id));
  }

  const judgeIds = JUDGE_CODES.map((judgeCode) => {
    const loginId = judgeCode.toLowerCase();
    const userId = userIdsByLoginId.get(loginId);
    if (!userId) {
      throw new TestingSeedConflictError(`Missing created judge ${loginId}`);
    }
    return userId;
  });

  const targetPanel = panelState.createPanel
    ? await dependencies.createPanel({
        competition: options.competitionId,
        name: options.panelName.trim(),
        judges: judgeIds,
        isActive: true,
      })
    : panelState.targetPanel;

  if (!targetPanel) {
    throw new TestingSeedConflictError("Seed panel was not available");
  }
  const panelId = idToString(targetPanel._id);
  const eligibility = createEligibility(dependencies.now());

  for (const account of accounts) {
    if (account.role !== "participant" || !account.registrationId) {
      continue;
    }
    const userId = userIdsByLoginId.get(account.loginId);
    if (!userId) {
      throw new TestingSeedConflictError(
        `Missing created participant ${account.loginId}`,
      );
    }
    await dependencies.createParticipant({
      competition: options.competitionId,
      user: userId,
      name: account.name,
      registrationId: account.registrationId,
      email: account.email,
      panel: panelId,
      teamMembers: [],
      isActive: true,
      eligibility,
    });
  }

  dependencies.logger.info(
    `[seed] Created ${PARTICIPANT_COUNT} participants and ${JUDGE_COUNT} judges`,
  );
  return exportPath;
}

export async function seedTestingAccounts(
  options: TestingSeedOptions,
  dependencies: TestingSeedDependencies,
): Promise<TestingSeedResult> {
  assertTestingSeedOptions(options);

  const connection = await dependencies.connect(options.uri);
  try {
    assertConnectedDatabaseName(connection.name, options.databaseName);
    dependencies.logger.info(
      `[seed] target=${options.target} database=${options.databaseName} mode=${options.apply ? "apply" : "dry-run"}`,
    );

    const competition = await dependencies.findCompetitionById(
      options.competitionId,
    );
    if (!competition) {
      throw new TestingSeedConflictError("Competition was not found");
    }
    if (competition.status !== "active") {
      throw new TestingSeedConflictError("Competition must be active");
    }

    const accounts = buildAccounts();
    const missingIndexes = new Set<MissingIndexAction>();
    assertUserIndexes(await dependencies.listUserIndexes(), missingIndexes);
    assertParticipantIndexes(
      await dependencies.listParticipantIndexes(),
      missingIndexes,
    );

    const loginIds = accounts.map((account) => account.loginId);
    const emails = accounts.map((account) => account.email);
    const allLoginIds = await dependencies.findAllUsersWithLoginId();
    const loginMatches = await dependencies.findUsersByLoginIds(loginIds);
    const emailMatches = await dependencies.findUsersByEmails(emails);

    const loginMatchesByLoginId = new Map<string, SeedUser[]>();
    for (const user of loginMatches) {
      if (typeof user.loginId !== "string") {
        throw new TestingSeedConflictError(
          "Login ID query returned an invalid value",
        );
      }
      const matches = loginMatchesByLoginId.get(user.loginId) ?? [];
      matches.push(user);
      loginMatchesByLoginId.set(user.loginId, matches);
    }

    const emailMatchesByEmail = new Map<string, SeedUser[]>();
    for (const user of emailMatches) {
      const matches = emailMatchesByEmail.get(user.email) ?? [];
      matches.push(user);
      emailMatchesByEmail.set(user.email, matches);
    }

    const userState = assertUserState(
      accounts,
      allLoginIds,
      loginMatchesByLoginId,
      emailMatchesByEmail,
    );

    const judgeIds = JUDGE_CODES.map((judgeCode) =>
      userState.existingUserIdsByLoginId.get(judgeCode.toLowerCase()),
    ).filter((value): value is string => value !== undefined);
    const existingJudgeIds =
      judgeIds.length === 0
        ? JUDGE_CODES.map((judgeCode) => judgeCode.toLowerCase())
        : judgeIds;
    const panelState = assertPanelState(
      await dependencies.findPanelsByCompetition(options.competitionId),
      existingJudgeIds,
      userState.allUsersExist,
      options.panelName.trim(),
    );

    assertParticipantsState(
      options,
      accounts,
      await dependencies.findParticipantsByCompetition(options.competitionId),
      userState,
      panelState,
      createEligibility(dependencies.now()),
    );

    if (!options.apply) {
      dependencies.logger.info(
        userState.allUsersExist
          ? "[seed] Dry run: all testing accounts already exist; no writes would be made"
          : `[seed] Dry run: would create ${PARTICIPANT_COUNT} participants, ${JUDGE_COUNT} judges, and 1 panel`,
      );
      for (const action of missingIndexes) {
        dependencies.logger.info(`[seed] Would create missing index: ${action}`);
      }
      assertConnectedDatabaseName(connection.name, options.databaseName);
      return {
        applied: false,
        createdParticipantLoginIds: [],
        createdJudgeLoginIds: [],
        panelCreated: false,
        exportPath: null,
      };
    }

    const exportPath = userState.allUsersExist
      ? null
      : await applySeed(options, dependencies, accounts, panelState, missingIndexes);
    if (userState.allUsersExist) {
      dependencies.logger.info("[seed] Already up to date; no writes were made");
    }

    assertConnectedDatabaseName(connection.name, options.databaseName);
    return {
      applied: true,
      createdParticipantLoginIds: userState.allUsersExist
        ? []
        : accounts
            .filter((account) => account.role === "participant")
            .map((account) => account.loginId),
      createdJudgeLoginIds: userState.allUsersExist
        ? []
        : accounts
            .filter((account) => account.role === "judge")
            .map((account) => account.loginId),
      panelCreated: panelState.createPanel && !userState.allUsersExist,
      exportPath,
    };
  } finally {
    await dependencies.disconnect();
  }
}

export function createTestingSeedDependencies(
  logger: SeedLogger = console,
): TestingSeedDependencies {
  return {
    connect: async (uri) => {
      await mongoose.connect(uri, CONNECTION_OPTIONS);
      return { name: mongoose.connection.name };
    },
    disconnect: async () => {
      await mongoose.disconnect();
    },
    findCompetitionById: async (id) =>
      (await Competition.findById(new Types.ObjectId(id))
        .select("status")
        .lean()) as unknown as CompetitionRecord | null,
    listUserIndexes: async () =>
      (await User.collection.indexes()) as unknown as CollectionIndex[],
    listParticipantIndexes: async () =>
      (await Participant.collection.indexes()) as unknown as CollectionIndex[],
    createUserLoginIdIndex: async () => {
      await User.collection.createIndex(
        { loginId: 1 },
        { name: USER_LOGIN_ID_INDEX_NAME, unique: true, sparse: true },
      );
    },
    createUserEmailIndex: async () => {
      await User.collection.createIndex({ email: 1 }, { unique: true });
    },
    createParticipantRegistrationIdIndex: async () => {
      await Participant.collection.createIndex(
        { competition: 1, registrationId: 1 },
        { name: PARTICIPANT_REGISTRATION_INDEX_NAME, unique: true },
      );
    },
    findAllUsersWithLoginId: async () =>
      (await User.find({ loginId: { $exists: true } })
        .select("name loginId email role isActive")
        .lean()) as unknown as SeedUser[],
    findUsersByLoginIds: async (loginIds) =>
      (await User.find({ loginId: { $in: normalizedIds(loginIds) } })
        .select("name loginId email role isActive")
        .lean()) as unknown as SeedUser[],
    findUsersByEmails: async (emails) =>
      (await User.find({ email: { $in: normalizedIds(emails) } })
        .select("name loginId email role isActive")
        .lean()) as unknown as SeedUser[],
    findPanelsByCompetition: async (competitionId) =>
      (await Panel.find({ competition: new Types.ObjectId(competitionId) })
        .select("competition name judges isActive")
        .lean()) as unknown as PanelRecord[],
    findParticipantsByCompetition: async (competitionId) =>
      (await Participant.find({
        competition: new Types.ObjectId(competitionId),
      })
        .select(
          "competition user name registrationId email panel teamMembers isActive eligibility",
        )
        .lean()) as unknown as ParticipantRecord[],
    createUser: async (input) => {
      const created = await User.create(input);
      return {
        _id: created._id,
        name: created.name,
        email: created.email,
        loginId: created.loginId,
        role: created.role,
        isActive: created.isActive,
      };
    },
    createPanel: async (input) => {
      const created = await Panel.create({
        competition: new Types.ObjectId(input.competition),
        name: input.name,
        judges: input.judges.map((judgeId) => new Types.ObjectId(String(judgeId))),
        isActive: true,
        description: null,
      });
      return {
        _id: created._id,
        competition: created.competition,
        name: created.name,
        judges: created.judges,
        isActive: created.isActive,
      };
    },
    createParticipant: async (input) => {
      const created = await Participant.create({
        competition: new Types.ObjectId(input.competition),
        user: new Types.ObjectId(input.user),
        name: input.name,
        registrationId: input.registrationId,
        email: input.email,
        panel: new Types.ObjectId(input.panel),
        teamMembers: input.teamMembers,
        isActive: true,
        eligibility: input.eligibility,
      });
      return {
        _id: created._id,
        competition: created.competition,
        user: created.user,
        name: created.name,
        registrationId: created.registrationId,
        email: created.email,
        panel: created.panel,
        teamMembers: created.teamMembers,
        isActive: created.isActive,
        eligibility: created.eligibility,
      };
    },
    hashPassword,
    generatePasswords: (count) => generateUniquePasswords(count),
    writeExport: async (exportData) => writeTestingAccountExport(exportData),
    now: () => new Date(),
    logger,
  };
}

function safeErrorMessage(error: unknown): string {
  return describeError(error).replace(
    /mongodb(?:\+srv)?:\/\/[^\s]+/g,
    "[redacted-mongodb-uri]",
  );
}

async function runCli(): Promise<void> {
  const options = parseTestingSeedOptions(process.argv.slice(2), process.env);
  const result = await seedTestingAccounts(
    options,
    createTestingSeedDependencies(),
  );

  if (!result.applied) {
    console.log("[seed] Dry run complete. No database writes or exports were made.");
    return;
  }

  console.log("[seed] Testing account seeding complete.");
}

if (require.main === module) {
  runCli().catch((error: unknown) => {
    console.error(`[seed] Failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
