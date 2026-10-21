export const MODEL_NAMES = [
  "User",
  "Competition",
  "Panel",
  "Participant",
  "EvaluationParameter",
  "Evaluation",
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

export const ROUND_IDENTIFIERS = [1, 2] as const;

export type RoundIdentifier = (typeof ROUND_IDENTIFIERS)[number];
