export { User, USER_ROLES } from "./user.model";
export type { UserDocument, UserRole } from "./user.model";

export {
  Competition,
  COMPETITION_STATUSES,
  ROUND_STATUSES,
  SCORING_TOTAL_SOURCES,
} from "./competition.model";
export type {
  CompetitionDocument,
  CompetitionRound,
  CompetitionScoringPolicy,
  CompetitionStatus,
  PopulatedCompetition,
  RoundStatus,
  ScoringStrategyConfig,
  ScoringTotalSource,
} from "./competition.model";

export { Panel } from "./panel.model";
export type { PanelDocument } from "./panel.model";

export { Participant } from "./participant.model";
export type {
  ParticipantDocument,
  ParticipantEligibility,
} from "./participant.model";

export { EvaluationParameter } from "./evaluation-parameter.model";
export type {
  EvaluationParameterDocument,
} from "./evaluation-parameter.model";

export { Evaluation, EVALUATION_STATUSES } from "./evaluation.model";
export type {
  EvaluationCriterion,
  EvaluationDocument,
  EvaluationStatus,
} from "./evaluation.model";
