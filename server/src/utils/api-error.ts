export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: ERROR_CODES.BAD_REQUEST,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  413: ERROR_CODES.PAYLOAD_TOO_LARGE,
  415: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
  422: ERROR_CODES.VALIDATION_ERROR,
  500: ERROR_CODES.INTERNAL_SERVER_ERROR,
};

export function defaultCodeForStatus(status: number): ErrorCode {
  return STATUS_TO_CODE[status] ?? ERROR_CODES.INTERNAL_SERVER_ERROR;
}

export interface ApiErrorOptions {
  code?: ErrorCode;
  details?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = "ApiError";
    this.status = status;
    this.code = options.code ?? defaultCodeForStatus(status);
    this.details = options.details;
  }

  static badRequest(message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(400, message, options);
  }

  static unauthorized(message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(401, message, options);
  }

  static forbidden(message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(403, message, options);
  }

  static notFound(message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(404, message, options);
  }

  static conflict(message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(409, message, options);
  }
}
