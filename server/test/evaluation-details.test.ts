import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  buildParticipantEvaluationDetails,
  type EvaluationViewInput,
  type ParameterViewInput,
  type ParticipantViewInput,
  type RoundViewInput,
} from "../src/services/evaluation-details.service";

const participant: ParticipantViewInput = {
  id: "participant-1",
  name: "Alice Developer",
  registrationId: "KVN-2026-001",
  panelId: "panel-1",
  panelName: "Web & Cloud Panel",
};

const rounds: RoundViewInput[] = [
  { round: 1, status: "closed" },
  { round: 2, status: "active" },
];

const parameters: ParameterViewInput[] = [
  {
    id: "param-technical",
    name: "Technical Depth",
    maxMarks: 40,
    weightage: 1,
    applicableRounds: [1, 2],
    isActive: true,
    configVersion: 1,
    priority: 1,
  },
  {
    id: "param-innovation",
    name: "Innovation & Creativity",
    maxMarks: 60,
    weightage: 1,
    applicableRounds: [1, 2],
    isActive: true,
    configVersion: 1,
    priority: 2,
  },
];

function evaluation(
  overrides: Partial<EvaluationViewInput> = {},
): EvaluationViewInput {
  return {
    id: "evaluation-1",
    judgeId: "judge-1",
    judgeName: "Judge Smith",
    judgeEmail: "judge.smith@venturecraft.org",
    round: 1,
    status: "submitted",
    submittedAt: "2026-10-24T10:00:00.000Z",
    updatedAt: "2026-10-24T10:00:00.000Z",
    criteria: [
      {
        parameterId: "param-technical",
        parameterName: "Technical Depth",
        maxMarks: 40,
        weightage: 1,
        applicableRounds: [1, 2],
        configVersion: 1,
        awardedMarks: 30,
      },
      {
        parameterId: "param-innovation",
        parameterName: "Innovation & Creativity",
        maxMarks: 60,
        weightage: 1,
        applicableRounds: [1, 2],
        configVersion: 1,
        awardedMarks: 45,
      },
    ],
    ...overrides,
  };
}

describe("participant evaluation details", () => {
  test("returns every configured criterion in obtained / max format", () => {
    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      parameters,
      [evaluation()],
    );

    const round1 = details.rounds.find((round) => round.round === 1);
    assert.ok(round1);
    assert.equal(round1.configuredCriteria.length, 2);
    assert.deepEqual(
      round1.configuredCriteria.map((criterion) => criterion.parameterName),
      ["Technical Depth", "Innovation & Creativity"],
    );

    const evaluationMarks = round1.evaluations[0];
    assert.ok(evaluationMarks);
    assert.equal(evaluationMarks.criteria.length, 2);
    assert.equal(evaluationMarks.criteria[0]?.awardedMarks, 30);
    assert.equal(evaluationMarks.criteria[0]?.maxMarks, 40);
    assert.equal(evaluationMarks.criteria[1]?.awardedMarks, 45);
    assert.equal(evaluationMarks.criteria[1]?.maxMarks, 60);
    assert.equal(evaluationMarks.recordedTotalMarks, 75);
    assert.equal(evaluationMarks.maxPossibleMarks, 100);
    assert.equal(evaluationMarks.isComplete, true);
  });

  test("shows missing criteria as not evaluated instead of zero", () => {
    const draft = evaluation({
      id: "draft-1",
      status: "draft",
      submittedAt: null,
      criteria: [
        {
          parameterId: "param-technical",
          parameterName: "Technical Depth",
          maxMarks: 40,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 30,
        },
      ],
    });

    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      parameters,
      [draft],
    );

    const round1 = details.rounds.find((round) => round.round === 1);
    assert.ok(round1);
    assert.equal(round1.status, "draft_only");
    assert.equal(round1.submittedEvaluationCount, 0);
    assert.equal(round1.draftEvaluationCount, 1);
    assert.equal(round1.submittedTotalMarks, null);

    const criteria = round1.evaluations[0]?.criteria ?? [];
    const innovation = criteria.find(
      (criterion) => criterion.parameterId === "param-innovation",
    );
    assert.ok(innovation);
    assert.equal(innovation.awardedMarks, null);
    assert.equal(innovation.isEvaluated, false);

    assert.equal(round1.evaluations[0]?.recordedTotalMarks, 30);
    assert.equal(round1.evaluations[0]?.maxPossibleMarks, 100);
    assert.equal(round1.evaluations[0]?.missingCriterionCount, 1);
    assert.equal(round1.evaluations[0]?.isComplete, false);
    assert.equal(details.overall.submittedTotalMarks, null);
    assert.deepEqual(details.overall.evaluatedRounds, []);
  });

  test("keeps an explicitly recorded zero as evaluated", () => {
    const withZero = evaluation({
      criteria: [
        {
          parameterId: "param-technical",
          parameterName: "Technical Depth",
          maxMarks: 40,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 0,
        },
        {
          parameterId: "param-innovation",
          parameterName: "Innovation & Creativity",
          maxMarks: 60,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 20,
        },
      ],
    });

    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      parameters,
      [withZero],
    );

    const technical = details.rounds[0]?.evaluations[0]?.criteria.find(
      (criterion) => criterion.parameterId === "param-technical",
    );
    assert.ok(technical);
    assert.equal(technical.awardedMarks, 0);
    assert.equal(technical.isEvaluated, true);
    assert.equal(details.rounds[0]?.evaluations[0]?.recordedTotalMarks, 20);
    assert.equal(details.rounds[0]?.evaluations[0]?.isComplete, true);
    assert.equal(details.rounds[0]?.status, "complete");
  });

  test("averages submitted evaluation totals and excludes drafts", () => {
    const submittedA = evaluation({
      id: "submitted-a",
      criteria: [
        {
          parameterId: "param-technical",
          parameterName: "Technical Depth",
          maxMarks: 40,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 20,
        },
        {
          parameterId: "param-innovation",
          parameterName: "Innovation & Creativity",
          maxMarks: 60,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 40,
        },
      ],
    });
    const submittedB = evaluation({
      id: "submitted-b",
      judgeId: "judge-2",
      criteria: [
        {
          parameterId: "param-technical",
          parameterName: "Technical Depth",
          maxMarks: 40,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 40,
        },
        {
          parameterId: "param-innovation",
          parameterName: "Innovation & Creativity",
          maxMarks: 60,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 40,
        },
      ],
    });
    const draft = evaluation({
      id: "draft-c",
      judgeId: "judge-3",
      status: "draft",
      submittedAt: null,
      criteria: [
        {
          parameterId: "param-technical",
          parameterName: "Technical Depth",
          maxMarks: 40,
          weightage: 1,
          applicableRounds: [1, 2],
          configVersion: 1,
          awardedMarks: 40,
        },
      ],
    });

    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      parameters,
      [submittedA, submittedB, draft],
    );

    const round1 = details.rounds[0];
    assert.ok(round1);
    assert.equal(round1.status, "in_progress");
    assert.equal(round1.submittedEvaluationCount, 2);
    assert.equal(round1.draftEvaluationCount, 1);
    assert.equal(round1.submittedTotalMarks, 70);
    assert.equal(round1.maxPossibleMarks, 100);
    assert.equal(details.overall.submittedTotalMarks, 70);
    assert.equal(details.overall.maxPossibleMarks, 100);
    assert.deepEqual(details.overall.evaluatedRounds, [1]);
  });

  test("includes historical snapshot criteria that are no longer configured", () => {
    const legacy = evaluation({
      criteria: [
        {
          parameterId: "param-legacy",
          parameterName: "Retired Criterion",
          maxMarks: 25,
          weightage: 1,
          applicableRounds: [1],
          configVersion: 1,
          awardedMarks: 18,
        },
      ],
    });

    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      parameters,
      [legacy],
    );

    const criteria = details.rounds[0]?.evaluations[0]?.criteria ?? [];
    const legacyRow = criteria.find(
      (criterion) => criterion.parameterId === "param-legacy",
    );
    assert.ok(legacyRow);
    assert.equal(legacyRow.source, "snapshot");
    assert.equal(legacyRow.awardedMarks, 18);
    assert.equal(legacyRow.maxMarks, 25);
    assert.equal(
      criteria.find((criterion) => criterion.parameterId === "param-technical")
        ?.awardedMarks,
      null,
    );
    assert.equal(details.rounds[0]?.evaluations[0]?.recordedTotalMarks, 18);
  });

  test("lists configured criteria with no evaluations as unevaluated", () => {
    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      parameters,
      [],
    );

    const round2 = details.rounds.find((round) => round.round === 2);
    assert.ok(round2);
    assert.equal(round2.status, "unevaluated");
    assert.equal(round2.evaluations.length, 0);
    assert.equal(round2.configuredCriteria.length, 2);
    assert.equal(round2.submittedTotalMarks, null);
    assert.equal(details.overall.submittedTotalMarks, null);
  });

  test("includes inactive configured criteria for visibility", () => {
    const inactive: ParameterViewInput = {
      id: "param-inactive",
      name: "Archived Criterion",
      maxMarks: 10,
      weightage: 1,
      applicableRounds: [1],
      isActive: false,
      configVersion: 2,
      priority: null,
    };

    const details = buildParticipantEvaluationDetails(
      participant,
      rounds,
      [...parameters, inactive],
      [],
    );

    const round1 = details.rounds.find((round) => round.round === 1);
    assert.ok(round1);
    assert.equal(round1.configuredCriteria.length, 3);
    const inactiveRow = round1.configuredCriteria.find(
      (criterion) => criterion.parameterId === "param-inactive",
    );
    assert.ok(inactiveRow);
    assert.equal(inactiveRow.isActive, false);
  });
});
