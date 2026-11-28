import { strict as assert } from "node:assert";
import { afterEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import { ApiError } from "../src/utils/api-error";
import { LOGIN_ID_PATTERN, User } from "../src/models/user.model";
import { login, provisionUser } from "../src/services/auth.service";
import { loginSchema } from "../src/validators/auth.validators";

type QueryFilter = Record<string, unknown>;

const CORRECT_PASSWORD = "CorrectHorseBatteryStaple123!";
const originalFindOne = User.findOne;

function createQuery(value: unknown): { select: () => Promise<unknown>; then: Promise<unknown>["then"] } {
  const promise = Promise.resolve(value);
  return {
    select: async () => value,
    then: (onFulfilled, onRejected) => promise.then(onFulfilled, onRejected),
  };
}

function mockFindOne(handler: (filter: QueryFilter) => Promise<unknown>): void {
  (User as unknown as { findOne: unknown }).findOne = (filter: QueryFilter) =>
    createQuery(handler(filter));
}

async function createUserRecord(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return {
    _id: { toString: () => "507f1f77bcf86cd799439011" },
    name: "Venture Craft Admin",
    email: "admin@example.org",
    loginId: "vc-admin",
    passwordHash: await bcrypt.hash(CORRECT_PASSWORD, 4),
    role: "admin",
    isActive: true,
    ...overrides,
  };
}

async function assertApiError(promise: Promise<unknown>, status: number): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    return error;
  }

  assert.fail(`Expected API error with status ${status}`);
}

afterEach(() => {
  (User as unknown as { findOne: unknown }).findOne = originalFindOne;
});

describe("login identifier validation", () => {
  test("accepts identifier requests", () => {
    assert.deepEqual(loginSchema.parse({ identifier: "vc-admin", password: "secret" }), {
      identifier: "vc-admin",
      password: "secret",
    });
    assert.deepEqual(loginSchema.parse({ identifier: "TEST-TEAM-001", password: "secret" }), {
      identifier: "TEST-TEAM-001",
      password: "secret",
    });
  });

  test("accepts legacy email requests", () => {
    assert.deepEqual(
      loginSchema.parse({ email: "admin@example.org", password: "secret" }),
      { identifier: "admin@example.org", password: "secret" },
    );
  });

  test("rejects missing and conflicting identifiers", () => {
    assert.throws(() => loginSchema.parse({ password: "secret" }));
    assert.throws(() =>
      loginSchema.parse({
        identifier: "vc-admin",
        email: "admin@example.org",
        password: "secret",
      }),
    );
  });

  test("uses the shared login ID pattern", () => {
    assert.match("vc-admin", LOGIN_ID_PATTERN);
    assert.doesNotMatch("not a login id", LOGIN_ID_PATTERN);
  });
});

describe("login identifier authentication", () => {
  test("authenticates an admin by login ID", async () => {
    const user = await createUserRecord();
    let capturedFilter: QueryFilter | undefined;
    mockFindOne(async (filter) => {
      capturedFilter = filter;
      return user;
    });

    const result = await login("vc-admin", CORRECT_PASSWORD);

    assert.equal(result.user.email, "admin@example.org");
    assert.equal(result.user.role, "admin");
    assert.ok(result.token);
    assert.deepEqual(capturedFilter?.$or, [
      { email: "vc-admin" },
      { loginId: "vc-admin" },
    ]);
  });

  test("authenticates an admin by email with and without a login ID", async () => {
    for (const loginId of ["vc-admin", undefined]) {
      const user = await createUserRecord(loginId ? { loginId } : { loginId: undefined });
      let capturedFilter: QueryFilter | undefined;
      mockFindOne(async (filter) => {
        capturedFilter = filter;
        return user;
      });

      const result = await login("Admin@Example.ORG", CORRECT_PASSWORD);

      assert.equal(result.user.role, "admin");
      assert.deepEqual(capturedFilter?.$or, [
        { email: "admin@example.org" },
        { loginId: "admin@example.org" },
      ]);
    }
  });

  test("authenticates judges and participants by email", async () => {
    for (const role of ["judge", "participant"] as const) {
      const user = await createUserRecord({
        email: `${role}@example.org`,
        loginId: undefined,
        role,
      });
      mockFindOne(async () => user);

      const result = await login(`${role}@example.org`, CORRECT_PASSWORD);

      assert.equal(result.user.role, role);
      assert.equal(result.user.email, `${role}@example.org`);
    }
  });

  test("rejects invalid passwords and inactive accounts", async () => {
    mockFindOne(async () => createUserRecord());
    const invalidPassword = await assertApiError(
      login("vc-admin", "wrong-password"),
      401,
    );
    assert.equal(invalidPassword.message, "Invalid identifier or password");

    mockFindOne(async () => createUserRecord({ isActive: false }));
    const inactive = await assertApiError(
      login("vc-admin", CORRECT_PASSWORD),
      403,
    );
    assert.equal(inactive.message, "Account is deactivated");
  });

  test("rejects missing accounts", async () => {
    mockFindOne(async () => null);
    const error = await assertApiError(login("vc-admin", CORRECT_PASSWORD), 401);
    assert.equal(error.message, "Invalid identifier or password");
  });
});

describe("participant login identifiers", () => {
  const PARTICIPANT_EMAIL = "test-team-001@testing.venturecraft.invalid";
  const PARTICIPANT_LOGIN_ID = "test-team-001";

  async function createParticipantRecord(
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    return createUserRecord({
      name: "TEST-TEAM-001",
      email: PARTICIPANT_EMAIL,
      loginId: PARTICIPANT_LOGIN_ID,
      role: "participant",
      ...overrides,
    });
  }

  test("authenticates a participant by email", async () => {
    const user = await createParticipantRecord();
    let capturedFilter: QueryFilter | undefined;
    mockFindOne(async (filter) => {
      capturedFilter = filter;
      return user;
    });

    const result = await login(PARTICIPANT_EMAIL.toUpperCase(), CORRECT_PASSWORD);

    assert.equal(result.user.role, "participant");
    assert.equal(result.user.email, PARTICIPANT_EMAIL);
    assert.ok(result.token);
    assert.deepEqual(capturedFilter?.$or, [
      { email: PARTICIPANT_EMAIL },
      { loginId: PARTICIPANT_EMAIL },
    ]);
  });

  test("authenticates a participant by login ID using backend normalization", async () => {
    const user = await createParticipantRecord();
    let capturedFilter: QueryFilter | undefined;
    mockFindOne(async (filter) => {
      capturedFilter = filter;
      return user;
    });

    const result = await login("  TEST-TEAM-001  ", CORRECT_PASSWORD);

    assert.equal(result.user.role, "participant");
    assert.equal(result.user.email, PARTICIPANT_EMAIL);
    assert.ok(result.token);
    assert.deepEqual(capturedFilter?.$or, [
      { email: PARTICIPANT_LOGIN_ID },
      { loginId: PARTICIPANT_LOGIN_ID },
    ]);
  });

  test("rejects invalid participant credentials", async () => {
    mockFindOne(async () => createParticipantRecord());

    const error = await assertApiError(login("TEST-TEAM-001", "wrong-password"), 401);

    assert.equal(error.message, "Invalid identifier or password");
  });

  test("rejects inactive participant accounts", async () => {
    mockFindOne(async () => createParticipantRecord({ isActive: false }));

    const error = await assertApiError(login("TEST-TEAM-001", CORRECT_PASSWORD), 403);

    assert.equal(error.message, "Account is deactivated");
  });
});

describe("judge login identifiers", () => {
  const JUDGE_EMAIL = "test-jdg-001@testing.venturecraft.invalid";
  const JUDGE_LOGIN_ID = "test-jdg-001";

  async function createJudgeRecord(
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    return createUserRecord({
      name: "TEST-JDG-001",
      email: JUDGE_EMAIL,
      loginId: JUDGE_LOGIN_ID,
      role: "judge",
      ...overrides,
    });
  }

  test("authenticates a judge by email", async () => {
    const user = await createJudgeRecord();
    let capturedFilter: QueryFilter | undefined;
    mockFindOne(async (filter) => {
      capturedFilter = filter;
      return user;
    });

    const result = await login(JUDGE_EMAIL.toUpperCase(), CORRECT_PASSWORD);

    assert.equal(result.user.role, "judge");
    assert.equal(result.user.email, JUDGE_EMAIL);
    assert.equal(result.user.isActive, true);
    assert.ok(result.token);
    assert.deepEqual(capturedFilter?.$or, [
      { email: JUDGE_EMAIL },
      { loginId: JUDGE_EMAIL },
    ]);
  });

  test("authenticates TEST-JDG-001 by login ID using backend normalization", async () => {
    const user = await createJudgeRecord();
    let capturedFilter: QueryFilter | undefined;
    mockFindOne(async (filter) => {
      capturedFilter = filter;
      return user;
    });

    const result = await login("  TEST-JDG-001  ", CORRECT_PASSWORD);

    assert.equal(result.user.role, "judge");
    assert.equal(result.user.email, JUDGE_EMAIL);
    assert.equal(result.user.isActive, true);
    assert.ok(result.token);
    assert.deepEqual(capturedFilter?.$or, [
      { email: JUDGE_LOGIN_ID },
      { loginId: JUDGE_LOGIN_ID },
    ]);
  });

  test("rejects invalid judge credentials", async () => {
    mockFindOne(async () => createJudgeRecord());

    const error = await assertApiError(login("TEST-JDG-001", "wrong-password"), 401);

    assert.equal(error.message, "Invalid identifier or password");
  });

  test("rejects inactive judge accounts", async () => {
    mockFindOne(async () => createJudgeRecord({ isActive: false }));

    const error = await assertApiError(login("TEST-JDG-001", CORRECT_PASSWORD), 403);

    assert.equal(error.message, "Account is deactivated");
  });
});

describe("login ID provisioning", () => {
  test("rejects duplicate login IDs before creating a user", async () => {
    const filtered: QueryFilter[] = [];
    mockFindOne(async (filter) => {
      filtered.push(filter);
      return "loginId" in filter ? { _id: "existing-user" } : null;
    });

    const error = await assertApiError(
      provisionUser({
        name: "Duplicate Admin",
        email: "duplicate@example.org",
        loginId: "vc-admin",
        password: CORRECT_PASSWORD,
        role: "admin",
      }),
      409,
    );

    assert.equal(error.message, "User with this login ID already exists");
    assert.deepEqual(filtered, [
      { email: "duplicate@example.org" },
      { loginId: "vc-admin" },
    ]);
  });

  test("defines a unique sparse login ID index", () => {
    const indexes = User.schema.indexes();
    const loginIdIndex = indexes.find(
      ([fields]) => (fields as Record<string, unknown>)["loginId"] === 1,
    );

    assert.ok(loginIdIndex, "loginId index is missing");
    const options = loginIdIndex[1] as Record<string, unknown>;
    assert.equal(options["unique"], true);
    assert.equal(options["sparse"], true);
    assert.equal(options["name"], "user_loginId_unique");
  });
});
