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

function exportFileName(target: SeedTarget, generatedAt: string): string {
  const timestamp = generatedAt.replace(/[:.]/g, "-");
  const suffix = randomBytes(4).toString("hex");
  return `admin-credentials-${target}-${timestamp}-${suffix}.json`;
}

export async function writeCredentialExport(
  credentialExport: CredentialExport,
  baseDir: string = path.join(process.cwd(), ".credentials"),
): Promise<string> {
  await mkdir(baseDir, { recursive: true });

  const filePath = path.join(
    baseDir,
    exportFileName(credentialExport.target, credentialExport.generatedAt),
  );
  const tempPath = `${filePath}.${randomBytes(4).toString("hex")}.tmp`;

  await writeFile(tempPath, JSON.stringify(credentialExport, null, 2), {
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
