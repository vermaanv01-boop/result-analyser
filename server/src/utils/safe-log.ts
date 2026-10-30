const MONGODB_URI_PATTERN = /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(JWT_SECRET|MONGODB_URI|SMTP_PASS|SMTP_USER|PASSWORD|TOKEN|SECRET)\b\s*[:=]\s*[^\s,;]+/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function redactSecrets(value: string): string {
  return value
    .replace(MONGODB_URI_PATTERN, "mongodb://<redacted>")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=<redacted>")
    .replace(BEARER_TOKEN_PATTERN, "Bearer <redacted>");
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${redactSecrets(error.message)}`;
  }

  return redactSecrets(String(error));
}
