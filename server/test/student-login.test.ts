import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { Express } from "express";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { Competition } from "../src/models/competition.model";
import { Participant } from "../src/models/participant.model";
import { User } from "../src/models/user.model";
import { hashPassword } from "../src/services/auth.service";

const TEST_DB_URI = "mongodb://127.0.0.1:27017/student_ranking_student_login_test";

let baseUrl = "";
let server: ReturnType<Express["listen"]>;

before(async (): Promise<void> => {
  await mongoose.connect(TEST_DB_URI);
  await User.deleteMany({});
  await Competition.deleteMany({});
  await Participant.deleteMany({});

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, (): void => {
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async (): Promise<void> => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  try {
    await User.deleteMany({});
    await Competition.deleteMany({});
    await Participant.deleteMany({});
    await mongoose.disconnect();
  } catch {
    // Ignore cleanup errors
  }
});

describe("Student Login flow", () => {
  test("successful login for registered participant with correct credentials", async () => {
    const passwordHash = await hashPassword("StudentPass123!");
    const user = await User.create({
      name: "Alice Student",
      email: "alice@student.edu",
      passwordHash,
      role: "participant",
      isActive: true,
    });
    const competition = await Competition.create({
      name: "Student Login Test",
      description: "Test",
      createdBy: user._id,
    });
    await Participant.create({
      competition: competition._id,
      user: user._id,
      name: "Alice Student",
      registrationId: "SL-001",
      email: "alice@student.edu",
      isActive: true,
      eligibility: [
        { round: 1, eligible: true, ineligibleReason: null, updatedAt: new Date() },
        { round: 2, eligible: true, ineligibleReason: null, updatedAt: new Date() },
      ],
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@student.edu", password: "StudentPass123!" }),
    });

    assert.equal(response.status, 200);
    const json = (await response.json()) as any;
    assert.ok(json.token);
    assert.equal(json.user.role, "participant");
    assert.equal(json.user.email, "alice@student.edu");
  });

  test("invalid credentials are rejected", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@student.edu", password: "wrongpass" }),
    });

    assert.equal(response.status, 401);
  });

  test("role enforcement - login returns role for admin", async () => {
    const passwordHash = await hashPassword("AdminPass123!");
    await User.create({
      name: "Admin User",
      email: "admin.studenttest@vc.org",
      passwordHash,
      role: "admin",
      isActive: true,
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin.studenttest@vc.org", password: "AdminPass123!" }),
    });

    assert.equal(response.status, 200);
    const json = (await response.json()) as any;
    assert.equal(json.user.role, "admin");
  });

  test("protected routes require authentication for participant portal", async () => {
    const response = await fetch(`${baseUrl}/api/v1/portal/profile`);
    assert.equal(response.status, 401);
  });
});
