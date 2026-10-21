import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Types } from "mongoose";
import type { EvaluationCriterion } from "../src/models/evaluation.model";
import {
  aggregateParticipantRoundScores,
  calculateJudgeEvaluationScore,
  calculateParticipantOverallScore,
  rankLeaderboardEntries,
  type LeaderboardEntryInput,
  type RawJudgeEvaluation,
} from "../src/services/scoring.service";

describe("scoring and ranking service", () => {
  const param1 = new Types.ObjectId();
  const param2 = new Types.ObjectId();

  test("calculates score dynamically from criteria without assuming 100 max", () => {
    // Criterion 1: 30/40 marks (weight 1)
    // Criterion 2: 15/20 marks (weight 1)
    // Total max = 60. Raw marks = 45.
    // Normalized score percentage = (45 / 60) * 100 = 75.0%
    const criteria: EvaluationCriterion[] = [
      {
        parameter: param1,
        configVersion: 1,
        parameterName: "Coding Style",
        maxMarks: 40,
        weightage: 1,
        applicableRounds: [1],
        awardedMarks: 30,
      },
      {
        parameter: param2,
        configVersion: 1,
        parameterName: "Algorithm",
        maxMarks: 20,
        weightage: 1,
        applicableRounds: [1],
        awardedMarks: 15,
      },
    ];

    const result = calculateJudgeEvaluationScore(criteria, "derived", null);

    assert.equal(result.rawTotalMarks, 45);
    assert.equal(result.maxPossibleMarks, 60);
    assert.equal(result.normalizedScore, 75);
    assert.equal(result.criteriaScores.length, 2);
    assert.equal(result.criteriaScores[0]?.percentage, 75);
    assert.equal(result.criteriaScores[1]?.percentage, 75);
  });

  test("supports weightages and fixed total scaling", () => {
    // Criterion 1: 20/20 (100%), weight 2
    // Criterion 2: 0/10 (0%), weight 1
    // Weighted avg = (100*2 + 0*1) / 3 = 66.6667%
    // Fixed total of 50 => (66.6667 / 100) * 50 = 33.3333
    const criteria: EvaluationCriterion[] = [
      {
        parameter: param1,
        configVersion: 1,
        parameterName: "Presentation",
        maxMarks: 20,
        weightage: 2,
        applicableRounds: [1],
        awardedMarks: 20,
      },
      {
        parameter: param2,
        configVersion: 1,
        parameterName: "Q&A",
        maxMarks: 10,
        weightage: 1,
        applicableRounds: [1],
        awardedMarks: 0,
      },
    ];

    const result = calculateJudgeEvaluationScore(criteria, "fixed", 50);

    assert.equal(result.rawTotalMarks, 20);
    assert.equal(result.maxPossibleMarks, 30);
    assert.equal(result.normalizedScore, 33.3333);
  });

  test("aggregates judge scores using arithmetic mean and detects completion", () => {
    const judge1 = new Types.ObjectId().toString();
    const judge2 = new Types.ObjectId().toString();

    const eval1: RawJudgeEvaluation = {
      judgeId: judge1,
      criteria: [
        {
          parameter: param1,
          configVersion: 1,
          parameterName: "Criteria A",
          maxMarks: 50,
          weightage: 1,
          applicableRounds: [1],
          awardedMarks: 40, // 80%
        },
      ],
    };

    const eval2: RawJudgeEvaluation = {
      judgeId: judge2,
      criteria: [
        {
          parameter: param1,
          configVersion: 1,
          parameterName: "Criteria A",
          maxMarks: 50,
          weightage: 1,
          applicableRounds: [1],
          awardedMarks: 30, // 60%
        },
      ],
    };

    // Panel has 2 judges, both submitted
    const resultComplete = aggregateParticipantRoundScores(
      1,
      [eval1, eval2],
      2,
      {
        totalSource: "derived",
        fixedTotal: null,
        normalization: { method: null, parameters: {} },
        aggregation: { method: null, parameters: {} },
        weightage: { method: null, parameters: {} },
      },
    );

    assert.equal(resultComplete.roundScore, 70); // (80 + 60) / 2
    assert.equal(resultComplete.rawAverageMarks, 35); // (40 + 30) / 2
    assert.equal(resultComplete.judgeCount, 2);
    assert.equal(resultComplete.isComplete, true);

    // Only 1 judge submitted out of 2 => incomplete
    const resultIncomplete = aggregateParticipantRoundScores(
      1,
      [eval1],
      2,
    );
    assert.equal(resultIncomplete.judgeCount, 1);
    assert.equal(resultIncomplete.isComplete, false);
  });

  test("calculates overall participant score with configurable round weights", () => {
    const r1 = {
      round: 1 as const,
      roundScore: 80,
      rawAverageMarks: 40,
      maxPossibleMarks: 50,
      judgeCount: 2,
      panelJudgeCount: 2,
      isComplete: true,
      judgeScores: [],
    };
    const r2 = {
      round: 2 as const,
      roundScore: 90,
      rawAverageMarks: 45,
      maxPossibleMarks: 50,
      judgeCount: 2,
      panelJudgeCount: 2,
      isComplete: true,
      judgeScores: [],
    };

    // Default 50/50 weighting: (80*0.5 + 90*0.5) = 85
    const overallDefault = calculateParticipantOverallScore({ 1: r1, 2: r2 });
    assert.equal(overallDefault.totalScore, 85);
    assert.equal(overallDefault.rawTotalMarks, 85);

    // Custom weighting: 30% Round 1, 70% Round 2: (80*0.3 + 90*0.7) = 24 + 63 = 87
    const overallCustom = calculateParticipantOverallScore(
      { 1: r1, 2: r2 },
      { round1: 0.3, round2: 0.7 },
    );
    assert.equal(overallCustom.totalScore, 87);
  });

  test("ranks participants and deterministically resolves ties with standard competition rank", () => {
    const entries: LeaderboardEntryInput[] = [
      {
        participantId: "p1",
        registrationId: "REG-001",
        participantName: "Alice",
        panelId: "pan1",
        panelName: "Panel A",
        isEligible: true,
        totalScore: 90,
        rawTotalMarks: 45,
        roundResults: {},
      },
      {
        participantId: "p2",
        registrationId: "REG-002",
        participantName: "Bob",
        panelId: "pan1",
        panelName: "Panel A",
        isEligible: true,
        totalScore: 85,
        rawTotalMarks: 42,
        roundResults: {},
      },
      {
        participantId: "p3",
        registrationId: "REG-003",
        participantName: "Charlie",
        panelId: "pan2",
        panelName: "Panel B",
        isEligible: true,
        totalScore: 85, // Tied with Bob
        rawTotalMarks: 42,
        roundResults: {},
      },
      {
        participantId: "p4",
        registrationId: "REG-004",
        participantName: "Diana",
        panelId: "pan2",
        panelName: "Panel B",
        isEligible: true,
        totalScore: 70,
        rawTotalMarks: 35,
        roundResults: {},
      },
    ];

    const ranked = rankLeaderboardEntries(entries);

    assert.equal(ranked.length, 4);
    assert.equal(ranked[0]?.registrationId, "REG-001");
    assert.equal(ranked[0]?.rank, 1);

    // Bob and Charlie tie for rank 2
    assert.equal(ranked[1]?.rank, 2);
    assert.equal(ranked[2]?.rank, 2);

    // Diana gets rank 4 (standard competition ranking: 1, 2, 2, 4)
    assert.equal(ranked[3]?.registrationId, "REG-004");
    assert.equal(ranked[3]?.rank, 4);
  });
});
