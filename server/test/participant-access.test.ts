import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { Express } from "express";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { Panel } from "../src/models/panel.model";
import { Participant } from "../src/models/participant.model";
import { User } from "../src/models/user.model";
import { signToken } from "../src/services/auth.service";
import { ERROR_CODES } from "../src/utils/api-error";

const competitionId = new Types.ObjectId();
const panelId = new Types.ObjectId();
const ownerUserId = new Types.ObjectId();
const otherUserId = new Types.ObjectId();
const judgeUserId = new Types.ObjectId();
const otherJudgeUserId = new Types.ObjectId();
const adminUserId = new Types.ObjectId();
const privateEmail = "private-team@testing.venturecraft.invalid";
const privateRegistrationId = "PRIVATE-001";
const privateTeamMember = "Private Member One";

let baseUrl = "";
let server: ReturnType<Express["listen"]>;
let currentParticipant: any;
let currentPanel: any;
let participantToken = "";
let otherParticipantToken = "";
let judgeToken = "";
let otherJudgeToken = "";
let adminToken = "";

const originalParticipantFindOne = Participant.findOne;
const originalPanelFindById = Panel.findById;
const originalUserFindById = User.findById;

function participantDocument(overrides: Record<string, unknown> = {}): any {
  return {
    _id: new Types.ObjectId(),
    competition: competitionId,
    user: ownerUserId,
    name: "Private Team",
    registrationId: privateRegistrationId,
    email: privateEmail,
    panel: { _id: panelId, name: "Assigned Panel", isActive: true, judges: [judgeUserId] },
    teamMembers: [privateTeamMember],
    isActive: true,
    eligibility: [
      { round: 1, eligible: true, ineligibleReason: null, updatedAt: new Date() },
      { round: 2, eligible: true, ineligibleReason: null, updatedAt: new Date() },
    ],
    ...overrides,
  };
}

function panelDocument(judges: Types.ObjectId[]): any {
  return {
    _id: panelId,
    competition: competitionId,
    judges,
    isActive: true,
  };
}

async function get(path: string, token?: string): Promise<{ status: number; body: any; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, body, text };
}

function assertNoPrivateData(text: string): void {
  assert.equal(text.includes(privateEmail), false, "unauthorized response exposed email");
  assert.equal(text.includes(privateRegistrationId), false, "unauthorized response exposed registration ID");
  assert.equal(text.includes(privateTeamMember), false, "unauthorized response exposed team member");
}

before(async (): Promise<void> => {
  participantToken = signToken({
    sub: ownerUserId.toString(),
    email: "participant-a@testing.venturecraft.invalid",
    role: "participant",
  });
  otherParticipantToken = signToken({
    sub: otherUserId.toString(),
    email: "participant-b@testing.venturecraft.invalid",
    role: "participant",
  });
  judgeToken = signToken({
    sub: judgeUserId.toString(),
    email: "assigned-judge@testing.venturecraft.invalid",
    role: "judge",
  });
  otherJudgeToken = signToken({
    sub: otherJudgeUserId.toString(),
    email: "other-judge@testing.venturecraft.invalid",
    role: "judge",
  });
  adminToken = signToken({
    sub: adminUserId.toString(),
    email: "admin@testing.venturecraft.invalid",
    role: "admin",
  });

  const usersById = new Map<string, any>([
    [
      ownerUserId.toString(),
      { _id: ownerUserId, role: "participant", isActive: true, name: "Participant A", email: "participant-a@testing.venturecraft.invalid" },
    ],
    [
      otherUserId.toString(),
      { _id: otherUserId, role: "participant", isActive: true, name: "Participant B", email: "participant-b@testing.venturecraft.invalid" },
    ],
    [
      judgeUserId.toString(),
      { _id: judgeUserId, role: "judge", isActive: true, name: "Assigned Judge", email: "assigned-judge@testing.venturecraft.invalid" },
    ],
    [
      otherJudgeUserId.toString(),
      { _id: otherJudgeUserId, role: "judge", isActive: true, name: "Other Judge", email: "other-judge@testing.venturecraft.invalid" },
    ],
    [
      adminUserId.toString(),
      { _id: adminUserId, role: "admin", isActive: true, name: "Admin", email: "admin@testing.venturecraft.invalid" },
    ],
  ]);

  currentParticipant = participantDocument();
  currentPanel = panelDocument([judgeUserId]);

  (Participant as any).findOne = () => ({
    populate: async () => currentParticipant,
  });
  (Panel as any).findById = async () => currentPanel;
  (User as any).findById = async (id: unknown) => usersById.get(String(id)) ?? null;

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
  (Participant as any).findOne = originalParticipantFindOne;
  (Panel as any).findById = originalPanelFindById;
  (User as any).findById = originalUserFindById;
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error): void => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

describe("participant detail authorization", (): void => {
  const detailPath = `/api/v1/competitions/${competitionId.toString()}/participants/${new Types.ObjectId().toString()}`;

  test("owner can retrieve their own participant record", async (): Promise<void> => {
    currentParticipant = participantDocument();
    const response = await get(detailPath, participantToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.participant.registrationId, privateRegistrationId);
    assert.equal(response.body.participant.email, privateEmail);
  });

  test("participant cannot retrieve another participant's private details", async (): Promise<void> => {
    currentParticipant = participantDocument({ user: otherUserId });
    const response = await get(detailPath, participantToken);
    assert.equal(response.status, 404);
    assert.equal(
      (response.body.error as Record<string, unknown>)["code"],
      ERROR_CODES.NOT_FOUND,
    );
    assertNoPrivateData(response.text);
  });

  test("unauthenticated requests are rejected", async (): Promise<void> => {
    currentParticipant = participantDocument();
    const response = await get(detailPath);
    assert.equal(response.status, 401);
    assert.equal(
      (response.body.error as Record<string, unknown>)["code"],
      ERROR_CODES.UNAUTHORIZED,
    );
    assertNoPrivateData(response.text);
  });

  test("admin access remains functional", async (): Promise<void> => {
    currentParticipant = participantDocument({ user: otherUserId });
    const response = await get(detailPath, adminToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.participant.registrationId, privateRegistrationId);
  });

  test("assigned judge access remains functional", async (): Promise<void> => {
    currentParticipant = participantDocument();
    currentPanel = panelDocument([judgeUserId]);
    const response = await get(detailPath, judgeToken);
    assert.equal(response.status, 200);
    assert.equal(response.body.participant.registrationId, privateRegistrationId);
  });

  test("non-assigned judge access is denied", async (): Promise<void> => {
    currentParticipant = participantDocument();
    currentPanel = panelDocument([otherJudgeUserId]);
    const response = await get(detailPath, judgeToken);
    assert.equal(response.status, 403);
    assert.equal(
      (response.body.error as Record<string, unknown>)["code"],
      ERROR_CODES.FORBIDDEN,
    );
    assertNoPrivateData(response.text);
  });

  test("participant cannot use the bulk participant list to read private details", async (): Promise<void> => {
    currentParticipant = participantDocument();
    const response = await get(`/api/v1/competitions/${competitionId.toString()}/participants`, participantToken);
    assert.equal(response.status, 403);
    assertNoPrivateData(response.text);
  });

  test("participant cannot access admin-only evaluation details", async (): Promise<void> => {
    const response = await get(`/api/v1/evaluations/participant/${new Types.ObjectId().toString()}`, participantToken);
    assert.equal(response.status, 403);
    assertNoPrivateData(response.text);
  });

  test("participant cannot access judge-only panel participants", async (): Promise<void> => {
    const response = await get(`/api/v1/judge/panels/${panelId.toString()}/participants`, participantToken);
    assert.equal(response.status, 403);
    assertNoPrivateData(response.text);
  });

  test("participant identity is not accepted when the participant.user reference is absent", async (): Promise<void> => {
    currentParticipant = participantDocument({ user: null });
    const response = await get(detailPath, participantToken);
    assert.equal(response.status, 404);
    assertNoPrivateData(response.text);
  });
});
