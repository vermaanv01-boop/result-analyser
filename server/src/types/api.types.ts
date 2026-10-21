export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationIssueList = ValidationIssue[];

export interface ErrorPayload {
  status: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details?: unknown;
  stack?: string;
}

export interface ErrorResponseBody {
  error: ErrorPayload;
}
