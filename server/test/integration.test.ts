import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { Express } from "express";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { Competition } from "../src/models/competition.model";
import { EvaluationParameter } from "../src/models/evaluation-parameter.model";
import { Evaluation } from "../src/models/evaluation.model";
import { Panel } from "../src/models/panel.model";
import { Participant } from "../src/models/participant.model";
import { User } from "../src/models/user.model";

const TEST_DB_URI = "mongodb://127.0.0.1:27017/student_ranking_integration_test";

let baseUrl = "";
let server: ReturnType<Express["listen"]>;
let adminToken = "";
let judgeToken = "";
let otherJudgeToken = "";
let adminId = "";
let judgeId = "";
let otherJudgeId = "";

before(async (): Promise<void> => {
  await mongoose.connect(TEST_DB_URI);
  // Clear any existing test collections non-destructively
  await User.deleteMany({});
  await Competition.deleteMany({});
  await Panel.deleteMany({});
  await Participant.deleteMany({});
  await EvaluationParameter.deleteMany({});
  await Evaluation.deleteMany({});

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
  // Clean up test database
  try {
    await User.deleteMany({});
    await Competition.deleteMany({});
    await Panel.deleteMany({});
    await Participant.deleteMany({});
    await EvaluationParameter.deleteMany({});
    await Evaluation.deleteMany({});
    await mongoose.disconnect();
  } catch {
    // Ignore cleanup errors on disconnect
  }
});

describe("Integration: Authentication, RBAC, and Provisioning", () => {
  test("provisions initial admin user directly in DB and logs in", async () => {
    const { hashPassword } = await import("../src/services/auth.service");
    const passwordHash = await hashPassword("AdminSecret123!");
    const adminUser = await User.create({
      name: "Super Admin",
      email: "admin@karvaan.org",
      passwordHash,
      role: "admin",
      isActive: true,
    });
    adminId = adminUser._id.toString();

    // Login with valid credentials
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@karvaan.org",
        password: "AdminSecret123!",
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as any;
    assert.ok(loginData.token);
    assert.equal(loginData.user.email, "admin@karvaan.org");
    assert.equal(loginData.user.role, "admin");
    adminToken = loginData.token;

    // Login with invalid password fails (401)
    const badLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@karvaan.org",
        password: "WrongPassword!",
      }),
    });
    assert.equal(badLogin.status, 401);

    // Verify /auth/me returns current authenticated principal
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(meRes.status, 200);
    const meData = (await meRes.json()) as any;
    assert.equal(meData.user.id, adminId);
  });

  test("admin provisions judges and non-admin cannot provision users", async () => {
    // Admin provisions Judge 1
    const createJudge1 = await fetch(`${baseUrl}/api/v1/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Judge Smith",
        email: "judge.smith@karvaan.org",
        password: "JudgePassword123!",
        role: "judge",
      }),
    });
    assert.equal(createJudge1.status, 201);
    const j1Data = (await createJudge1.json()) as any;
    judgeId = j1Data.user.id;
    assert.equal(j1Data.user.role, "judge");

    // Admin provisions Judge 2
    const createJudge2 = await fetch(`${baseUrl}/api/v1/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Judge Doe",
        email: "judge.doe@karvaan.org",
        password: "JudgePassword123!",
        role: "judge",
      }),
    });
    assert.equal(createJudge2.status, 201);
    const j2Data = (await createJudge2.json()) as any;
    otherJudgeId = j2Data.user.id;

    // Judge 1 logs in
    const jLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "judge.smith@karvaan.org",
        password: "JudgePassword123!",
      }),
    });
    assert.equal(jLogin.status, 200);
    const jLoginData = (await jLogin.json()) as any;
    judgeToken = jLoginData.token;

    // Judge 2 logs in
    const j2Login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "judge.doe@karvaan.org",
        password: "JudgePassword123!",
      }),
    });
    const j2LoginData = (await j2Login.json()) as any;
    otherJudgeToken = j2LoginData.token;

    // Judge tries to provision a user -> 403 Forbidden
    const forbiddenRes = await fetch(`${baseUrl}/api/v1/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        name: "Unauthorized User",
        email: "unauth@karvaan.org",
        password: "Password123!",
        role: "judge",
      }),
    });
    assert.equal(forbiddenRes.status, 403);
  });

  test("admin lists judge accounts with readable selector fields", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/judges`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(response.status, 200);

    const data = (await response.json()) as any;
    assert.equal(Array.isArray(data.judges), true);
    assert.equal(data.judges.length, 2);

    for (const judge of data.judges) {
      assert.equal(judge.role, "judge");
      assert.equal(typeof judge.id, "string");
      assert.equal(typeof judge.name, "string");
      assert.equal(typeof judge.email, "string");
      assert.equal(typeof judge.isActive, "boolean");
    }
  });

  test("enforces account deactivation on login and authenticated requests", async () => {
    // Provision temporary user
    const createRes = await fetch(`${baseUrl}/api/v1/auth/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Temp Judge",
        email: "temp.judge@karvaan.org",
        password: "TempPassword123!",
        role: "judge",
      }),
    });
    const created = (await createRes.json()) as any;
    const tempId = created.user.id;

    // Login to get token
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "temp.judge@karvaan.org",
        password: "TempPassword123!",
      }),
    });
    const { token: tempToken } = (await loginRes.json()) as any;

    // Deactivate user in DB
    await User.findByIdAndUpdate(tempId, { isActive: false });

    // Login now fails (403 Forbidden: Account is deactivated)
    const loginAfterDeactivation = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "temp.judge@karvaan.org",
        password: "TempPassword123!",
      }),
    });
    assert.equal(loginAfterDeactivation.status, 403);

    // Request with previously issued token fails (403 Forbidden)
    const requestWithOldToken = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert.equal(requestWithOldToken.status, 403);
  });
});

describe("Integration: Competition, Panel, Participant, Parameter, Evaluation & Leaderboard", () => {
  let competitionId = "";
  let panel1Id = "";
  let panel2Id = "";
  let participant1Id = "";
  let participant2Id = "";
  let param1Id = "";
  let param2Id = "";

  test("creates competition and validates initial round progression constraints", async () => {
    const res = await fetch(`${baseUrl}/api/v1/competitions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "KARVAAN 2026 Annual Hackathon",
        description: "Premier student technology competition",
      }),
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    competitionId = data.competition._id;
    assert.equal(data.competition.status, "draft");
    assert.equal(data.competition.rounds.length, 2);

    // Attempting to activate Round 2 while Round 1 is pending fails (400 Bad Request)
    const invalidRoundRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/rounds/2/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: "active" }),
      },
    );
    assert.equal(invalidRoundRes.status, 400);
  });

  test("creates evaluation parameters and increments configuration versioning", async () => {
    // Parameter 1: Technical Depth (maxMarks 40, weightage 1)
    const p1Res = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/parameters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Technical Depth",
          maxMarks: 40,
          weightage: 1,
          applicableRounds: [1, 2],
        }),
      },
    );
    assert.equal(p1Res.status, 201);
    const p1Data = (await p1Res.json()) as any;
    param1Id = p1Data.parameter._id;
    assert.equal(p1Data.parameter.configVersion, 1);

    // Parameter 2: Innovation & Creativity (maxMarks 60, weightage 1)
    const p2Res = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/parameters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Innovation & Creativity",
          maxMarks: 60,
          weightage: 1,
          applicableRounds: [1, 2],
        }),
      },
    );
    assert.equal(p2Res.status, 201);
    const p2Data = (await p2Res.json()) as any;
    param2Id = p2Data.parameter._id;
  });

  test("creates panels and assigns judges", async () => {
    // Panel 1 with Judge 1
    const panel1Res = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Web & Cloud Panel",
          judges: [judgeId],
        }),
      },
    );
    assert.equal(panel1Res.status, 201);
    const p1Data = (await panel1Res.json()) as any;
    panel1Id = p1Data.panel._id;

    // Panel 2 with Judge 2
    const panel2Res = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "AI & ML Panel",
          judges: [otherJudgeId],
        }),
      },
    );
    assert.equal(panel2Res.status, 201);
    const p2Data = (await panel2Res.json()) as any;
    panel2Id = p2Data.panel._id;
  });

  test("updates panel judges and rejects invalid, duplicate, and unauthorized assignments", async () => {
    const assignRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels/${panel2Id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ judges: [judgeId] }),
      },
    );
    assert.equal(assignRes.status, 200);
    const assignData = (await assignRes.json()) as any;
    assert.deepEqual(
      assignData.panel.judges.map((judge: any) => String(judge)),
      [judgeId],
    );

    const restoreRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels/${panel2Id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ judges: [otherJudgeId] }),
      },
    );
    assert.equal(restoreRes.status, 200);

    const duplicateRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Duplicate Judge Panel",
          judges: [judgeId, judgeId],
        }),
      },
    );
    assert.equal(duplicateRes.status, 400);

    const nonJudgeRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Invalid Role Panel",
          judges: [adminId],
        }),
      },
    );
    assert.equal(nonJudgeRes.status, 400);

    const missingJudgeRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Missing Judge Panel",
          judges: [new mongoose.Types.ObjectId().toString()],
        }),
      },
    );
    assert.equal(missingJudgeRes.status, 400);

    const unauthorizedRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels/${panel1Id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${judgeToken}`,
        },
        body: JSON.stringify({ judges: [otherJudgeId] }),
      },
    );
    assert.equal(unauthorizedRes.status, 403);
  });

  test("registers participants and rejects duplicate registrationId within competition", async () => {
    // Register Participant 1 in Panel 1
    const p1Res = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Alice Developer",
          registrationId: "KVN-2026-001",
          email: "alice@student.edu",
          panel: panel1Id,
        }),
      },
    );
    assert.equal(p1Res.status, 201);
    const p1Data = (await p1Res.json()) as any;
    participant1Id = p1Data.participant._id;

    // Duplicate registrationId in same competition is rejected (409 Conflict)
    const duplicateRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Imposter",
          registrationId: "KVN-2026-001",
          email: "imposter@student.edu",
        }),
      },
    );
    assert.equal(duplicateRes.status, 409);

    // Register Participant 2 in Panel 1
    const p2Res = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: "Bob Engineer",
          registrationId: "KVN-2026-002",
          email: "bob@student.edu",
          panel: panel1Id,
        }),
      },
    );
    assert.equal(p2Res.status, 201);
    const p2Data = (await p2Res.json()) as any;
    participant2Id = p2Data.participant._id;
  });

  test("activates Round 1 and verifies judge panel portal", async () => {
    const startR1 = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/rounds/1/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: "active" }),
      },
    );
    assert.equal(startR1.status, 200);

    // Judge 1 retrieves assigned panels
    const judgePanels = await fetch(`${baseUrl}/api/v1/judge/panels`, {
      headers: { Authorization: `Bearer ${judgeToken}` },
    });
    assert.equal(judgePanels.status, 200);
    const jpData = (await judgePanels.json()) as any;
    assert.equal(jpData.panels.length, 1);
    assert.equal(jpData.panels[0]._id, panel1Id);

    // Administrators cannot use judge-only endpoints
    const adminJudgePanels = await fetch(`${baseUrl}/api/v1/judge/panels`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminJudgePanels.status, 403);

    // Judge 1 retrieves participants for assigned panel
    const panelParticipants = await fetch(
      `${baseUrl}/api/v1/judge/panels/${panel1Id}/participants`,
      {
        headers: { Authorization: `Bearer ${judgeToken}` },
      },
    );
    assert.equal(panelParticipants.status, 200);
    const ppData = (await panelParticipants.json()) as any;
    assert.equal(ppData.activeRound, 1);
    assert.equal(ppData.participants.length, 2);
  });

  test("enforces evaluation validation, authorization, submission lock, and snapshot immutability", async () => {
    // Judge 2 (assigned to Panel 2) attempts to evaluate Participant 1 (assigned to Panel 1) -> 403 Forbidden
    const unauthEval = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherJudgeToken}`,
      },
      body: JSON.stringify({
        competition: competitionId,
        participant: participant1Id,
        panel: panel1Id,
        round: 1,
        scores: [
          { parameter: param1Id, awardedMarks: 35 },
          { parameter: param2Id, awardedMarks: 50 },
        ],
      }),
    });
    assert.equal(unauthEval.status, 403);

    // Validation: awardedMarks exceeding maxMarks is rejected (400)
    const exceedMarks = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        competition: competitionId,
        participant: participant1Id,
        panel: panel1Id,
        round: 1,
        scores: [
          { parameter: param1Id, awardedMarks: 999 }, // max is 40
          { parameter: param2Id, awardedMarks: 50 },
        ],
      }),
    });
    assert.equal(exceedMarks.status, 400);

    // Judge 1 submits valid evaluation for Participant 1: 30/40 and 45/60 -> Total: 75/100 (75%)
    const submitP1 = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        competition: competitionId,
        participant: participant1Id,
        panel: panel1Id,
        round: 1,
        scores: [
          { parameter: param1Id, awardedMarks: 30 },
          { parameter: param2Id, awardedMarks: 45 },
        ],
      }),
    });
    assert.equal(submitP1.status, 201);
    const evalP1 = (await submitP1.json()) as any;
    assert.equal(evalP1.evaluation.status, "submitted");
    assert.ok(evalP1.evaluation.submittedAt);
    assert.equal(evalP1.evaluation.criteria.length, 2);

    // Duplicate submission: attempting to submit again is locked (409 Conflict)
    const duplicateSubmit = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        competition: competitionId,
        participant: participant1Id,
        panel: panel1Id,
        round: 1,
        scores: [
          { parameter: param1Id, awardedMarks: 35 },
          { parameter: param2Id, awardedMarks: 50 },
        ],
      }),
    });
    assert.equal(duplicateSubmit.status, 409);

    // Judge 1 submits evaluation for Participant 2: 36/40 and 54/60 -> Total: 90/100 (90%)
    const submitP2 = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        competition: competitionId,
        participant: participant2Id,
        panel: panel1Id,
        round: 1,
        scores: [
          { parameter: param1Id, awardedMarks: 36 },
          { parameter: param2Id, awardedMarks: 54 },
        ],
      }),
    });
    assert.equal(submitP2.status, 201);
  });

  test("closes Round 1, rejects post-closure submissions, and qualifies participants for Round 2", async () => {
    // Close Round 1
    const closeR1 = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/rounds/1/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: "closed" }),
      },
    );
    assert.equal(closeR1.status, 200);

    // Post-closure submission attempt for Round 1 fails (400 Bad Request)
    const postClosureRes = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${judgeToken}`,
      },
      body: JSON.stringify({
        competition: competitionId,
        participant: participant1Id,
        panel: panel1Id,
        round: 1,
        scores: [
          { parameter: param1Id, awardedMarks: 30 },
          { parameter: param2Id, awardedMarks: 45 },
        ],
      }),
    });
    assert.equal(postClosureRes.status, 400);

    // Qualify top 1 participant for Round 2 based on Round 1 score (Participant 2 had 90%, Participant 1 had 75%)
    const qualifyRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/participants/qualify-round-2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          method: "topN",
          topN: 1,
        }),
      },
    );
    assert.equal(qualifyRes.status, 200);
    const qData = (await qualifyRes.json()) as any;
    assert.equal(qData.qualifiedCount, 1);

    // Verify Participant 2 is eligible for Round 2 and Participant 1 is ineligible
    const p1 = await Participant.findById(participant1Id);
    const p2 = await Participant.findById(participant2Id);
    assert.equal(p1?.eligibility.find((e) => e.round === 2)?.eligible, false);
    assert.equal(p2?.eligibility.find((e) => e.round === 2)?.eligible, true);
  });

  test("retrieves overall, round-specific, and panel-specific leaderboards", async () => {
    // Overall Leaderboard: Participant 2 (90%) should be rank 1, Participant 1 (75%) rank 2
    const leaderboardRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/leaderboard`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(leaderboardRes.status, 200);
    const lbData = (await leaderboardRes.json()) as any;
    assert.equal(lbData.leaderboard.length, 2);
    assert.equal(lbData.leaderboard[0].participantId, participant2Id);
    assert.equal(lbData.leaderboard[0].rank, 1);
    assert.equal(lbData.leaderboard[0].totalScore, 90);

    assert.equal(lbData.leaderboard[1].participantId, participant1Id);
    assert.equal(lbData.leaderboard[1].rank, 2);
    assert.equal(lbData.leaderboard[1].totalScore, 75);

    // Round 1 Leaderboard
    const r1Leaderboard = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/leaderboard/round/1`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(r1Leaderboard.status, 200);
    const r1LbData = (await r1Leaderboard.json()) as any;
    assert.equal(r1LbData.filter.round, 1);
    assert.equal(r1LbData.leaderboard[0].rank, 1);

    // Panel 1 Leaderboard
    const panelLeaderboard = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/leaderboard/panel/${panel1Id}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(panelLeaderboard.status, 200);
    const pLbData = (await panelLeaderboard.json()) as any;
    assert.equal(pLbData.leaderboard.length, 2);

    // Administrative progress report
    const progressRes = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/progress`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(progressRes.status, 200);
    const progData = (await progressRes.json()) as any;
    assert.equal(progData.progress.totalParticipants, 2);
    assert.equal(progData.progress.totalPanels, 2);
    const p1Progress = progData.progress.panelProgress.find(
      (p: any) => p.panelId === panel1Id,
    );
    assert.ok(p1Progress);
    assert.equal(p1Progress.round1.submitted, 2);
    assert.equal(p1Progress.round1.isComplete, true);
  });

  test("participant self-registration, re-login, profile, team update, and published results", async () => {
    const password = "ParticipantPass123!";
    const registerRes = await fetch(`${baseUrl}/api/v1/auth/register-participant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId,
        name: "Alice Developer",
        registrationId: "KVN-2026-001",
        email: "alice@student.edu",
        password,
        teamMembers: ["Alice Developer"],
      }),
    });
    assert.equal(registerRes.status, 201);
    const registerData = (await registerRes.json()) as any;
    assert.ok(registerData.token);
    assert.equal(registerData.user.role, "participant");
    assert.equal(registerData.user.passwordHash, undefined);
    assert.equal(registerData.participant.id, participant1Id);

    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@student.edu", password }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as any;
    assert.equal(loginData.user.role, "participant");

    const profileRes = await fetch(`${baseUrl}/api/v1/portal/profile`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(profileRes.status, 200);
    const profileData = (await profileRes.json()) as any;
    assert.equal(profileData.participant.id, participant1Id);
    assert.equal(profileData.participant.registrationId, "KVN-2026-001");
    assert.deepEqual(profileData.participant.teamMembers, ["Alice Developer"]);

    const teamRes = await fetch(`${baseUrl}/api/v1/portal/team`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({ teamMembers: ["Alice Developer", "Carol Analyst"] }),
    });
    assert.equal(teamRes.status, 200);
    const teamData = (await teamRes.json()) as any;
    assert.deepEqual(teamData.participant.teamMembers, [
      "Alice Developer",
      "Carol Analyst",
    ]);

    const resultsRes = await fetch(`${baseUrl}/api/v1/portal/results`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(resultsRes.status, 200);
    const resultsData = (await resultsRes.json()) as any;
    assert.equal(resultsData.competition.id, competitionId);
    assert.equal(resultsData.rounds.length, 2);
    assert.equal(resultsData.overallScore, 75);
    assert.equal(resultsData.rawTotalMarks, 75);

    const round1 = resultsData.rounds.find((round: any) => round.round === 1);
    assert.ok(round1);
    assert.equal(round1.judgeCount, 1);
    assert.equal(round1.roundScore, 75);
    assert.equal(round1.criteriaScores.length, 2);
    assert.equal(round1.criteriaScores[0].parameterName, "Technical Depth");

    const aliasRes = await fetch(`${baseUrl}/api/v1/participant/profile`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(aliasRes.status, 200);
  });
});
