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
