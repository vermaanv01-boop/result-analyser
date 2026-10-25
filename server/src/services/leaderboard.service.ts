import { Competition } from "../models/competition.model";
import { Evaluation } from "../models/evaluation.model";
import { EvaluationParameter } from "../models/evaluation-parameter.model";
import { Panel } from "../models/panel.model";
import { Participant } from "../models/participant.model";
import type { RoundIdentifier } from "../types/domain.types";
import { ApiError } from "../utils/api-error";
import {
  aggregateParticipantRoundScores,
  calculateParticipantOverallScore,
  rankLeaderboardEntries,
  type CriterionTieBreakInfo,
  type LeaderboardEntryInput,
  type RankedLeaderboardEntry,
  type RawJudgeEvaluation,
} from "./scoring.service";

export interface LeaderboardResult {
  competition: {
    id: string;
    name: string;
    status: string;
    parameterConfigVersion: number;
  };
  filter: {
    round: RoundIdentifier | "overall";
    panelId: string | null;
  };
  generatedAt: string;
  leaderboard: RankedLeaderboardEntry[];
}

export async function getLeaderboard(
  competitionId: string,
  options: {
    round?: RoundIdentifier;
    panelId?: string;
  } = {},
): Promise<LeaderboardResult> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw ApiError.notFound("Competition not found");
  }

  const panels = await Panel.find({ competition: competition._id });
  const panelMap = new Map<string, (typeof panels)[0]>();
  const panelJudgeCounts = new Map<string, number>();

  panels.forEach((p) => {
    panelMap.set(p._id.toString(), p);
    panelJudgeCounts.set(p._id.toString(), p.judges.length);
  });

  const parameters = await EvaluationParameter.find({ competition: competition._id, isActive: true })
    .sort({ priority: 1, _id: 1 });
  const priorityParams = parameters.filter((p) => p.priority !== null && p.priority !== undefined);

  const participantQuery: Record<string, unknown> = {
    competition: competition._id,
    isActive: true,
  };
  if (options.panelId) {
    participantQuery["panel"] = options.panelId;
  }

  const participants = await Participant.find(participantQuery).sort({
    registrationId: 1,
  });

  const evalQuery: Record<string, unknown> = {
    competition: competition._id,
    status: "submitted",
  };
  if (options.panelId) {
    evalQuery["panel"] = options.panelId;
  }
  if (options.round) {
    evalQuery["round"] = options.round;
  }

  const evaluations = await Evaluation.find(evalQuery);

  // Group evaluations by participant and round
  // participantId -> round -> RawJudgeEvaluation[]
  const evalsMap = new Map<string, Map<RoundIdentifier, RawJudgeEvaluation[]>>();

  for (const e of evaluations) {
    const pId = e.participant.toString();
    const r = e.round as RoundIdentifier;
    let pRounds = evalsMap.get(pId);
    if (!pRounds) {
      pRounds = new Map<RoundIdentifier, RawJudgeEvaluation[]>();
      evalsMap.set(pId, pRounds);
    }
    const list = pRounds.get(r) ?? [];
    list.push({
      judgeId: e.judge.toString(),
      criteria: e.criteria,
    });
    pRounds.set(r, list);
  }

  // Build leaderboard entries
  const entries: LeaderboardEntryInput[] = [];

  for (const p of participants) {
    const pId = p._id.toString();
    const pPanelId = p.panel ? p.panel.toString() : null;
    const panelObj = pPanelId ? panelMap.get(pPanelId) : null;
    const judgeCount = pPanelId ? panelJudgeCounts.get(pPanelId) ?? 0 : 0;

    const pRounds = evalsMap.get(pId);
    const round1Evals = pRounds?.get(1) ?? [];
    const round2Evals = pRounds?.get(2) ?? [];

    const r1Result = aggregateParticipantRoundScores(
      1,
      round1Evals,
      judgeCount,
      competition.scoringPolicy,
    );
    const r2Result = aggregateParticipantRoundScores(
      2,
      round2Evals,
      judgeCount,
      competition.scoringPolicy,
    );

    const roundResults: LeaderboardEntryInput["roundResults"] = {};
    if (round1Evals.length > 0 || !options.round || options.round === 1) {
      roundResults[1] = r1Result;
    }
    if (round2Evals.length > 0 || options.round === 2) {
      roundResults[2] = r2Result;
    }

    // Build criterion tie-breaks from submitted evaluations
    const buildTieBreaks = (evals: RawJudgeEvaluation[]): CriterionTieBreakInfo[] => {
      if (priorityParams.length === 0 || evals.length === 0) {
        return [];
      }
      const tieBreakMap = new Map<string, { sumPct: number; sumAwarded: number; count: number }>();
      for (const ev of evals) {
        for (const crit of ev.criteria) {
          const critId = crit.parameter.toString();
          if (!tieBreakMap.has(critId)) {
            tieBreakMap.set(critId, { sumPct: 0, sumAwarded: 0, count: 0 });
          }
          const bucket = tieBreakMap.get(critId)!;
          const pct = crit.maxMarks > 0 ? (crit.awardedMarks / crit.maxMarks) * 100 : 0;
          bucket.sumPct += pct;
          bucket.sumAwarded += crit.awardedMarks;
          bucket.count += 1;
        }
      }
      const result: CriterionTieBreakInfo[] = [];
      for (const param of priorityParams) {
        const pid = param._id.toString();
        const bucket = tieBreakMap.get(pid);
        if (bucket && bucket.count > 0) {
          result.push({
            parameterId: pid,
            priority: param.priority as number,
            percentage: Number((bucket.sumPct / bucket.count).toFixed(6)),
            awardedMarks: Number((bucket.sumAwarded / bucket.count).toFixed(6)),
            maxMarks: param.maxMarks,
          });
        } else {
          // Missing/incomplete evaluation for this criterion - do not treat as zero unless required; skip in comparison
        }
      }
      return result.sort((a, b) => a.priority - b.priority);
    };

    if (options.round !== undefined) {
      // Round-specific leaderboard
      const targetResult = options.round === 1 ? r1Result : r2Result;
      const targetEvals = options.round === 1 ? round1Evals : round2Evals;
      const isEligible =
        p.eligibility.find((e) => e.round === options.round)?.eligible ?? false;

      entries.push({
        participantId: pId,
        registrationId: p.registrationId,
        participantName: p.name,
        panelId: pPanelId,
        panelName: panelObj ? panelObj.name : null,
        isEligible,
        totalScore: targetResult.roundScore,
        rawTotalMarks: targetResult.rawAverageMarks,
        roundResults: { [options.round]: targetResult },
        criterionTieBreaks: buildTieBreaks(targetEvals),
      });
    } else {
      // Overall leaderboard
      const overall = calculateParticipantOverallScore(roundResults);
      const isEligible = p.eligibility.some((e) => e.eligible);
      const allEvals = [...round1Evals, ...round2Evals];

      entries.push({
        participantId: pId,
        registrationId: p.registrationId,
        participantName: p.name,
        panelId: pPanelId,
        panelName: panelObj ? panelObj.name : null,
        isEligible,
        totalScore: overall.totalScore,
        rawTotalMarks: overall.rawTotalMarks,
        roundResults,
        criterionTieBreaks: buildTieBreaks(allEvals),
      });
    }
  }

  const rankedLeaderboard = rankLeaderboardEntries(entries);

  return {
    competition: {
      id: competition._id.toString(),
      name: competition.name,
      status: competition.status,
      parameterConfigVersion: competition.parameterConfigVersion,
    },
    filter: {
      round: options.round ?? "overall",
      panelId: options.panelId ?? null,
    },
    generatedAt: new Date().toISOString(),
    leaderboard: rankedLeaderboard,
  };
}
