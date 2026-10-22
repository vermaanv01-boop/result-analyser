import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { Types } from "mongoose";
import {
  assertEligibleJudgeCandidates,
  normalizeJudgeIds,
} from "../src/services/panel.service";
import { ApiError } from "../src/utils/api-error";
import {
  createPanelSchema,
  updatePanelSchema,
} from "../src/validators/panel.validators";
import { createParticipantSchema } from "../src/validators/participant.validators";

const judgeId = new Types.ObjectId().toString();
const otherJudgeId = new Types.ObjectId().toString();
const missingJudgeId = new Types.ObjectId().toString();
const participantId = new Types.ObjectId().toString();

function throwsApiError(message: string): (error: unknown) => boolean {
  return (error: unknown): boolean => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, message);
    return true;
  };
}

describe("panel judge assignment validation", () => {
  test("normalizes valid judge IDs", () => {
    const normalized = normalizeJudgeIds([judgeId.toUpperCase(), otherJudgeId]);
    assert.deepEqual(normalized, [judgeId, otherJudgeId]);
  });

  test("rejects malformed judge IDs", () => {
    assert.throws(
      () => normalizeJudgeIds(["not-an-object-id"]),
      throwsApiError("One or more selected judge IDs are invalid."),
    );
  });

  test("rejects duplicate judge IDs case-insensitively", () => {
    assert.throws(
      () => normalizeJudgeIds([judgeId, judgeId.toUpperCase()]),
      throwsApiError("Duplicate judge IDs are not allowed."),
    );
  });

  test("rejects an empty judge selection", () => {
    assert.throws(
      () => normalizeJudgeIds([]),
      throwsApiError("Select at least one judge for the panel."),
    );
  });

  test("accepts active judge candidates", () => {
    assert.doesNotThrow(() =>
      assertEligibleJudgeCandidates([judgeId, otherJudgeId], [
        { _id: new Types.ObjectId(judgeId), role: "judge", isActive: true },
        { _id: new Types.ObjectId(otherJudgeId), role: "judge", isActive: true },
      ]),
    );
  });

  test("rejects nonexistent judge candidates", () => {
    assert.throws(
      () =>
        assertEligibleJudgeCandidates([missingJudgeId], [
          { _id: new Types.ObjectId(judgeId), role: "judge", isActive: true },
        ]),
      throwsApiError("One or more selected judge accounts do not exist."),
    );
  });

  test("rejects accounts without the judge role", () => {
    assert.throws(
      () =>
        assertEligibleJudgeCandidates([participantId], [
          { _id: new Types.ObjectId(participantId), role: "participant", isActive: true },
        ]),
      throwsApiError("One or more selected accounts do not have the judge role."),
    );
  });

  test("rejects inactive judge candidates", () => {
    assert.throws(
      () =>
        assertEligibleJudgeCandidates([judgeId], [
          { _id: new Types.ObjectId(judgeId), role: "judge", isActive: false },
        ]),
      throwsApiError("Inactive judge accounts cannot be assigned to a panel."),
    );
  });
});

describe("panel request schemas", () => {
  test("accepts readable selection payloads with valid IDs", () => {
    const result = createPanelSchema.safeParse({
      name: "Web & Cloud Panel",
      judges: [judgeId, otherJudgeId],
    });
    assert.equal(result.success, true);
  });

  test("rejects empty and duplicate judge selections on create", () => {
    assert.equal(
      createPanelSchema.safeParse({ name: "No Judges", judges: [] }).success,
      false,
    );
    assert.equal(
      createPanelSchema.safeParse({
        name: "Duplicate Judges",
        judges: [judgeId, judgeId],
      }).success,
      false,
    );
  });

  test("rejects duplicate judge selections on update", () => {
    assert.equal(
      updatePanelSchema.safeParse({
        judges: [judgeId, judgeId.toUpperCase()],
      }).success,
      false,
    );
  });

  test("rejects malformed participant panel IDs", () => {
    assert.equal(
      createParticipantSchema.safeParse({
        name: "Team One",
        registrationId: "KVN-001",
        panel: "panel-object-id",
      }).success,
      false,
    );
  });
});
