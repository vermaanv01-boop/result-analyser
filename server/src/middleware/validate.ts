import type { Request, RequestHandler } from "express";
import { z, type ZodType } from "zod";
import type { ValidationIssue } from "../types/api.types";
import { ApiError, ERROR_CODES } from "../utils/api-error";

export type RequestComponent = "body" | "params" | "query";

export interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

type DefaultParams = Request["params"];
type DefaultQuery = Request["query"];

export type ValidatedParams<S extends ValidationSchemas> = S extends {
  params: infer P extends ZodType;
}
  ? z.output<P>
  : DefaultParams;

export type ValidatedBody<S extends ValidationSchemas> = S extends {
  body: infer B extends ZodType;
}
  ? z.output<B>
  : unknown;

export type ValidatedQuery<S extends ValidationSchemas> = S extends {
  query: infer Q extends ZodType;
}
  ? z.output<Q>
  : DefaultQuery;

export type ValidatedRequest<S extends ValidationSchemas> = Request<
  ValidatedParams<S>,
  unknown,
  ValidatedBody<S>,
  ValidatedQuery<S>
>;

export type ValidationMiddleware<S extends ValidationSchemas> = RequestHandler<
  ValidatedParams<S>,
  unknown,
  ValidatedBody<S>,
  ValidatedQuery<S>
>;

interface ComponentCarrier {
  body: unknown;
  params: unknown;
  query: unknown;
}

const REQUEST_COMPONENTS: readonly RequestComponent[] = ["body", "params", "query"];

const VALIDATION_MESSAGE = "Request validation failed";

function readComponent(
  req: ComponentCarrier,
  component: RequestComponent,
): unknown {
  switch (component) {
    case "body":
      return req.body;
    case "params":
      return req.params;
    case "query":
      return req.query;
  }
}

function writeComponent(
  req: ComponentCarrier,
  component: RequestComponent,
  value: unknown,
): void {
  Object.defineProperty(req, component, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function formatIssuePath(
  component: RequestComponent,
  path: readonly PropertyKey[],
): string {
  return [component, ...path.map((segment) => String(segment))].join(".");
}

function toIssues(
  component: RequestComponent,
  error: z.ZodError,
): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(component, issue.path),
    code: issue.code,
    message: issue.message,
  }));
}

export function createValidationError(issues: ValidationIssue[]): ApiError {
  return new ApiError(400, VALIDATION_MESSAGE, {
    code: ERROR_CODES.VALIDATION_ERROR,
    details: issues,
  });
}

export function validate<S extends ValidationSchemas>(
  schemas: S,
): ValidationMiddleware<S> {
  return (req, _res, next): void => {
    const issues: ValidationIssue[] = [];
    const parsed: Array<{ component: RequestComponent; value: unknown }> = [];

    for (const component of REQUEST_COMPONENTS) {
      const schema = schemas[component];

      if (schema === undefined) {
        continue;
      }

      const result = schema.safeParse(readComponent(req, component));

      if (!result.success) {
        issues.push(...toIssues(component, result.error));
        continue;
      }

      parsed.push({ component, value: result.data });
    }

    if (issues.length > 0) {
      next(createValidationError(issues));
      return;
    }

    for (const entry of parsed) {
      writeComponent(req, entry.component, entry.value);
    }

    next();
  };
}
