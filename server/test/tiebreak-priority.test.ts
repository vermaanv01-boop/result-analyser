import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { rankLeaderboardEntries } from "../src/services/scoring.service";

describe("Criterion priority tie-breaking", () => {
  test("total score takes precedence", () => {
    const entries = [
      {
        participantId: "1",
        registrationId: "A",
        participantName: "A",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 90,
        rawTotalMarks: 90,
        roundResults: {},
        criterionTieBreaks: [{ parameterId: "p1", priority: 1, percentage: 100, awardedMarks: 50, maxMarks: 50 }],
      },
      {
        participantId: "2",
        registrationId: "B",
        participantName: "B",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 95,
        rawTotalMarks: 95,
        roundResults: {},
        criterionTieBreaks: [{ parameterId: "p1", priority: 1, percentage: 80, awardedMarks: 40, maxMarks: 50 }],
      },
    ];
    const ranked = rankLeaderboardEntries(entries);
    assert.equal(ranked[0].participantId, "2");
    assert.equal(ranked[1].participantId, "1");
  });

  test("tie on total score broken by highest priority criterion", () => {
    const entries = [
      {
        participantId: "1",
        registrationId: "A",
        participantName: "A",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 90,
        rawTotalMarks: 90,
        roundResults: {},
        criterionTieBreaks: [{ parameterId: "p1", priority: 1, percentage: 80, awardedMarks: 40, maxMarks: 50 }],
      },
      {
        participantId: "2",
        registrationId: "B",
        participantName: "B",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 90,
        rawTotalMarks: 90,
        roundResults: {},
        criterionTieBreaks: [{ parameterId: "p1", priority: 1, percentage: 90, awardedMarks: 45, maxMarks: 50 }],
      },
    ];
    const ranked = rankLeaderboardEntries(entries);
    assert.equal(ranked[0].participantId, "2");
    assert.equal(ranked[1].participantId, "1");
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 2);
  });

  test("successive priority comparisons", () => {
    const entries = [
      {
        participantId: "1",
        registrationId: "A",
        participantName: "A",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 85,
        rawTotalMarks: 85,
        roundResults: {},
        criterionTieBreaks: [
          { parameterId: "p1", priority: 1, percentage: 90, awardedMarks: 45, maxMarks: 50 },
          { parameterId: "p2", priority: 2, percentage: 70, awardedMarks: 35, maxMarks: 50 },
        ],
      },
      {
        participantId: "2",
        registrationId: "B",
        participantName: "B",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 85,
        rawTotalMarks: 85,
        roundResults: {},
        criterionTieBreaks: [
          { parameterId: "p1", priority: 1, percentage: 90, awardedMarks: 45, maxMarks: 50 },
          { parameterId: "p2", priority: 2, percentage: 80, awardedMarks: 40, maxMarks: 50 },
        ],
      },
    ];
    const ranked = rankLeaderboardEntries(entries);
    assert.equal(ranked[0].participantId, "2");
    assert.equal(ranked[1].participantId, "1");
  });

  test("complete ties retain standard tie handling", () => {
    const entries = [
      {
        participantId: "1",
        registrationId: "B",
        participantName: "B",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 80,
        rawTotalMarks: 80,
        roundResults: {},
        criterionTieBreaks: [
          { parameterId: "p1", priority: 1, percentage: 80, awardedMarks: 40, maxMarks: 50 },
        ],
      },
      {
        participantId: "2",
        registrationId: "A",
        participantName: "A",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 80,
        rawTotalMarks: 80,
        roundResults: {},
        criterionTieBreaks: [
          { parameterId: "p1", priority: 1, percentage: 80, awardedMarks: 40, maxMarks: 50 },
        ],
      },
    ];
    const ranked = rankLeaderboardEntries(entries);
    assert.equal(ranked[0].rank, ranked[1].rank);
  });

  test("missing evaluations handled consistently", () => {
    const entries = [
      {
        participantId: "1",
        registrationId: "A",
        participantName: "A",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 80,
        rawTotalMarks: 80,
        roundResults: {},
        criterionTieBreaks: [],
      },
      {
        participantId: "2",
        registrationId: "B",
        participantName: "B",
        panelId: null,
        panelName: null,
        isEligible: true,
        totalScore: 80,
        rawTotalMarks: 80,
        roundResults: {},
        criterionTieBreaks: [],
      },
    ];
    const ranked = rankLeaderboardEntries(entries);
    assert.equal(ranked[0].rank, ranked[1].rank);
  });
});
