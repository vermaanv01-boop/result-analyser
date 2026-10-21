import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { env } from "../config/env";
import type { ErrorPayload, ErrorResponseBody } from "../types/api.types";
import { ApiError, defaultCodeForStatus, ERROR_CODES } from "../utils/api-error";

const GENERIC_SERVER_MESSAGE = "Internal server error";

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details: unknown;
  stack: string | undefined;
}

interface BodyParserErrorMapping {
  status: number;
  code: string;
  message: string;
}

const BODY_PARSER_ERRORS: Record<string, BodyParserErrorMapping> = {
  "entity.parse.failed": {
    status: 400,
    code: ERROR_CODES.BAD_REQUEST,
    message: "Malformed request body",
  },
  "entity.too.large": {
    status: 413,
    code: ERROR_CODES.PAYLOAD_TOO_LARGE,
    message: "Request body too large",
  },
  "charset.unsupported": {
    status: 415,
    code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    message: "Unsupported charset",
  },
  "encoding.unsupported": {
    status: 415,
    code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    message: "Unsupported content encoding",
  },
  "request.aborted": {
    status: 400,
    code: ERROR_CODES.BAD_REQUEST,
    message: "Request aborted",
  },
  "request.size.invalid": {
    status: 400,
    code: ERROR_CODES.BAD_REQUEST,
    message: "Invalid request size",
  },
  "parameters.too.many": {
    status: 413,
    code: ERROR_CODES.PAYLOAD_TOO_LARGE,
    message: "Too many parameters",
  },
};

const DUPLICATE_KEY_CODE = 11000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

function getNumericStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const candidate = error.status ?? error.statusCode;
  return typeof candidate === "number" && candidate >= 400 && candidate <= 599
    ? candidate
    : undefined;
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return typeof error.code === "number" && error.code === DUPLICATE_KEY_CODE;
}

function normalizeValidationError(
  error: mongoose.Error.ValidationError,
): NormalizedError {
  const details: Record<string, string> = {};

  for (const [field, issue] of Object.entries(error.errors)) {
    details[field] = issue?.message ?? "Invalid value";
  }

  return {
    status: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: "Request validation failed",
    details,
    stack: error.stack,
  };
}

function normalizeCastError(error: mongoose.Error.CastError): NormalizedError {
  return {
    status: 400,
    code: ERROR_CODES.BAD_REQUEST,
    message: `Invalid value for field "${error.path}"`,
    details: { [error.path]: error.message },
    stack: error.stack,
  };
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack,
    };
  }

  if (isRecord(error) && typeof error.type === "string") {
    const mapping = BODY_PARSER_ERRORS[error.type];

    if (mapping) {
      return {
        ...mapping,
        details: undefined,
        stack: getStack(error),
      };
    }
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return normalizeValidationError(error);
  }

  if (error instanceof mongoose.Error.CastError) {
    return normalizeCastError(error);
  }

  if (isDuplicateKeyError(error)) {
    return {
      status: 409,
      code: ERROR_CODES.CONFLICT,
      message: "Resource already exists",
      details: undefined,
      stack: getStack(error),
    };
  }

  const status = getNumericStatus(error);

  if (status !== undefined && status < 500) {
    return {
      status,
      code: defaultCodeForStatus(status),
      message: "Request could not be processed",
      details: undefined,
      stack: getStack(error),
    };
  }

  return {
    status: 500,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: GENERIC_SERVER_MESSAGE,
    details: undefined,
    stack: getStack(error),
  };
}

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);
  const isServerError = normalized.status >= 500;
  const clientMessage = isServerError ? GENERIC_SERVER_MESSAGE : normalized.message;

  if (isServerError) {
    console.error(
      `[error] ${req.method} ${req.path} -> ${normalized.status} ${normalized.code}`,
      error,
    );
  } else {
    console.warn(
      `[error] ${req.method} ${req.path} -> ${normalized.status} ${normalized.code}: ${clientMessage}`,
    );
  }

  const payload: ErrorPayload = {
    status: normalized.status,
    code: normalized.code,
    message: clientMessage,
    path: req.path,
    timestamp: new Date().toISOString(),
  };

  if (normalized.status < 500 && normalized.details !== undefined) {
    payload.details = normalized.details;
  }

  if (env.NODE_ENV !== "production" && normalized.stack !== undefined) {
    payload.stack = normalized.stack;
  }

  const body: ErrorResponseBody = { error: payload };

  res.status(normalized.status).json(body);
};
