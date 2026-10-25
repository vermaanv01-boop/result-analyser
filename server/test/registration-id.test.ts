import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { Express } from "express";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { Competition } from "../src/models/competition.model";
import { Participant } from "../src/models/participant.model";
import { User } from "../src/models/user.model";
import { hashPassword } from "../src/services/auth.service";

const TEST_DB_URI = "mongodb://127.0.0.1:27017/student_ranking_regid_test";

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
    // ignore
  }
});

describe("Automatic Registration ID", () => {
  test("student registration generates unique registrationId server-side", async () => {
    const adminPasswordHash = await hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Admin",
      email: "admin@regid.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    });

    const competition = await Competition.create({
      name: "RegID Comp",
      description: "Test",
      createdBy: admin._id,
    });

    const res = await fetch(`${baseUrl}/api/v1/auth/register-participant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: competition._id.toString(),
        name: "Test Student",
        email: "student1@regid.com",
        password: "Pass123456",
        teamMembers: [],
      }),
    });

    assert.equal(res.status, 201);
    const json: any = await res.json();
    assert.ok(json.participant);
    assert.ok(json.participant.registrationId);
    assert.ok(typeof json.participant.registrationId === "string");
    assert.ok(json.participant.registrationId.length > 0);
  });

  test("registrationId persists and is returned on repeated logins/profile", async () => {
    const adminPasswordHash = await hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Admin2",
      email: "admin2@regid.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    });

    const competition = await Competition.create({
      name: "RegID Comp2",
      description: "Test",
      createdBy: admin._id,
    });

    const regRes = await fetch(`${baseUrl}/api/v1/auth/register-participant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: competition._id.toString(),
        name: "Test Student2",
        email: "student2@regid.com",
        password: "Pass123456",
      }),
    });
    assert.equal(regRes.status, 201);
    const regJson: any = await regRes.json();
    const regId = regJson.participant.registrationId;
    const token = regJson.token;

    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student2@regid.com", password: "Pass123456" }),
    });
    assert.equal(loginRes.status, 200);

    const profileRes = await fetch(`${baseUrl}/api/v1/portal/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(profileRes.status, 200);
    const profileJson: any = await profileRes.json();
    assert.equal(profileJson.registrationId, regId);
  });

  test("legacy accounts with missing IDs get ID assigned without creating duplicate accounts", async () => {
    const adminPasswordHash = await hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Admin3",
      email: "admin3@regid.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    });

    const competition = await Competition.create({
      name: "RegID Comp3",
      description: "Test",
      createdBy: admin._id,
    });

    const passwordHash = await hashPassword("Pass123456");
    const user = await User.create({
      name: "Legacy Student",
      email: "legacy@regid.com",
      passwordHash,
      role: "participant",
      isActive: true,
    });

    await Participant.create({
      competition: competition._id,
      user: user._id,
      name: "Legacy Student",
      registrationId: "",
      email: "legacy@regid.com",
      isActive: true,
      eligibility: [
        { round: 1, eligible: true, ineligibleReason: null, updatedAt: new Date() },
        { round: 2, eligible: true, ineligibleReason: null, updatedAt: new Date() },
      ],
    });

    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "legacy@regid.com", password: "Pass123456" }),
    });
    assert.equal(loginRes.status, 200);
    const loginJson: any = await loginRes.json();

    const profileRes = await fetch(`${baseUrl}/api/v1/portal/profile`, {
      headers: { Authorization: `Bearer ${loginJson.token}` },
    });
    assert.equal(profileRes.status, 200);
    const profileJson: any = await profileRes.json();
    assert.ok(profileJson.registrationId && profileJson.registrationId.length > 0);

    const count = await Participant.countDocuments({ user: user._id, competition: competition._id });
    assert.equal(count, 1);
  });

  test("uniqueness is enforced for generated registrationIds", async () => {
    const adminPasswordHash = await hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Admin4",
      email: "admin4@regid.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    });

    const competition = await Competition.create({
      name: "RegID Comp4",
      description: "Test",
      createdBy: admin._id,
    });

    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/v1/auth/register-participant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: competition._id.toString(),
          name: `Student ${i}`,
          email: `student${i}@regid.com`,
          password: "Pass123456",
        }),
      });
      assert.equal(res.status, 201);
      const json: any = await res.json();
      ids.add(json.participant.registrationId);
    }
    assert.equal(ids.size, 5);
  });
});
