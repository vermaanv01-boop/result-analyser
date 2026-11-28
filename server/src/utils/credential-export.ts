import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SeedTarget } from "../config/seed-target";

export interface CredentialRecord {
  loginId: string;
  email: string;
  role: "admin";
  isActive: true;
  password: string | null;
  passwordStatus: "created" | "preserved-not-exported";
}

export interface CredentialExport {
  target: SeedTarget;
  databaseName: string;
  generatedAt: string;
  notice: string;
  accounts: CredentialRecord[];
}

export interface RotatedCredentialRecord {
  loginId: string;
  email: string;
  role: "admin";
  isActive: true;
  password: string;
  passwordStatus: "rotated";
}

export interface PasswordRotationExport {
  target: SeedTarget;
  databaseName: string;
  generatedAt: string;
  notice: string;
  accounts: RotatedCredentialRecord[];
}

export interface TestingAccountCredentialRecord {
  loginId: string;
  email: string;
  role: "judge" | "participant";
  isActive: true;
  registrationId: string | null;
  password: string;
  passwordStatus: "created";
}

export interface TestingAccountExport {
  target: "testing";
  databaseName: string;
  competitionId: string;
  panelName: string;
  generatedAt: string;
  notice: string;
  accounts: TestingAccountCredentialRecord[];
}

function exportFileName(target: SeedTarget, generatedAt: string): string {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const suffix = randomBytes(4).toString("hex");
  return `admin-credentials-${target}-${timestamp}-${suffix}.json`;
}

function passwordRotationFileName(
  target: SeedTarget,
  generatedAt: string,
): string {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const suffix = randomBytes(4).toString("hex");
  return `admin-password-rotation-${target}-${timestamp}-${suffix}.json`;
}

function testingAccountFileName(generatedAt: string): string {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const suffix = randomBytes(4).toString("hex");
  return `testing-accounts-testing-${timestamp}-${suffix}.json`;
}

async function writeJsonFileAtomic(
  value: unknown,
  baseDir: string,
  fileName: string,
): Promise<string> {
  await mkdir(baseDir, { recursive: true });

  const filePath = path.join(baseDir, fileName);
  const tempPath = `${filePath}.${randomBytes(4).toString("hex")}.tmp`;

  await writeFile(tempPath, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }

  return filePath;
}

export async function writeCredentialExport(
  credentialExport: CredentialExport,
  baseDir: string = path.join(process.cwd(), ".credentials"),
): Promise<string> {
  return writeJsonFileAtomic(
    credentialExport,
    baseDir,
    exportFileName(credentialExport.target, credentialExport.generatedAt),
  );
}

export async function writePasswordRotationExport(
  passwordRotationExport: PasswordRotationExport,
  baseDir: string = path.join(process.cwd(), ".credentials"),
): Promise<string> {
  return writeJsonFileAtomic(
    passwordRotationExport,
    baseDir,
    passwordRotationFileName(
      passwordRotationExport.target,
      passwordRotationExport.generatedAt,
    ),
  );
}

export async function writeTestingAccountExport(
  testingAccountExport: TestingAccountExport,
  baseDir: string = path.join(process.cwd(), ".credentials"),
): Promise<string> {
  return writeJsonFileAtomic(
    testingAccountExport,
    baseDir,
    testingAccountFileName(testingAccountExport.generatedAt),
  );
}
