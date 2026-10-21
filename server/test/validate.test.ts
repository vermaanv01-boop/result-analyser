import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../src/config/env";
import { corsMiddleware } from "../src/middleware/cors";
import { errorHandler } from "../src/middleware/error-handler";
import { notFoundHandler } from "../src/middleware/not-found";
import {
  validate,
  type ValidatedRequest,
} from "../src/middleware/validate";
import { ApiError, ERROR_CODES } from "../src/utils/api-error";
import {
  idParamsSchema,
  objectIdSchema,
  roundIdentifierSchema,
} from "../src/validators";

const bodySchema = z.object({
  name: z.string().trim().min(1, "name must not be empty"),
  count: z.coerce.number().int(),
});

const paramsSchema = z.object({
  id: objectIdSchema,
});

const querySchema = z.object({
  round: z.coerce.number().int(),
  page: z.coerce.number().int().optional(),
});

let handlerCalls = 0;
let baseUrl = "";
let server: ReturnType<Express["listen"]>;

function buildApp(): Express {
  const app: Express = express();

  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post(
    "/echo/body",
    validate({ body: bodySchema }),
    (req: ValidatedRequest<{ body: typeof bodySchema }>, res: Response): void => {
      handlerCalls += 1;
      res.status(200).json({ body: req.body });
    },
  );

  app.get(
    "/echo/params/:id",
    validate({ params: paramsSchema }),
    (
      req: ValidatedRequest<{ params: typeof paramsSchema }>,
      res: Response,
    ): void => {
      handlerCalls += 1;
      res.status(200).json({ params: req.params });
    },
  );

  app.get(
    "/echo/query",
    validate({ query: querySchema }),
    (
      req: ValidatedRequest<{ query: typeof querySchema }>,
      res: Response,
    ): void => {
      handlerCalls += 1;
      res.status(200).json({ query: req.query });
    },
  );

  app.post(
    "/echo/all/:id",
    validate({ body: bodySchema, params: paramsSchema, query: querySchema }),
    (
      req: ValidatedRequest<{
        body: typeof bodySchema;
        params: typeof paramsSchema;
        query: typeof querySchema;
      }>,
      res: Response,
    ): void => {
      handlerCalls += 1;
      res.status(200).json({
        body: req.body,
        params: req.params,
        query: req.query,
      });
    },
  );

  app.get("/plain", (_req: Request, res: Response): void => {
    handlerCalls += 1;
    res.status(200).json({ plain: true });
  });

  app.post("/boom", (_req: Request, _res: Response): void => {
    handlerCalls += 1;
    throw new Error("internal detail: mongodb://user:hunter2@host/db");
  });

  app.post("/conflict", (_req: Request, _res: Response): void => {
    handlerCalls += 1;
    throw new ApiError(409, "Resource already exists", {
      code: ERROR_CODES.CONFLICT,
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const init: RequestInit = { method };

  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, init);

  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>,
  };
}

function errorPayload(json: Record<string, unknown>): Record<string, unknown> {
  const error = json["error"];
  assert.equal(typeof error, "object", "response body must contain an error object");
  assert.notEqual(error, null);
  return error as Record<string, unknown>;
}

function issuesOf(json: Record<string, unknown>): Array<Record<string, unknown>> {
  const details = errorPayload(json)["details"];
  assert.ok(Array.isArray(details), "details must be an array of validation issues");
  return details as Array<Record<string, unknown>>;
}

before(async (): Promise<void> => {
  const app = buildApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, (): void => {
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe("request validation middleware", (): void => {
  test("accepts valid input and normalizes it", async (): Promise<void> => {
    const before = handlerCalls;
    const response = await request("POST", "/echo/body", {
      name: "  Ada Lovelace  ",
      count: "3",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { body: { name: "Ada Lovelace", count: 3 } });
    assert.equal(handlerCalls, before + 1);
  });

  test("rejects an invalid body", async (): Promise<void> => {
    const before = handlerCalls;
    const response = await request("POST", "/echo/body", {
      name: "   ",
      count: "not-a-number",
    });

    assert.equal(response.status, 400);

    const payload = errorPayload(response.json);
    assert.equal(payload["status"], 400);
    assert.equal(payload["code"], ERROR_CODES.VALIDATION_ERROR);
    assert.equal(payload["message"], "Request validation failed");

    const issues = issuesOf(response.json);
    assert.equal(issues.length, 2);
    assert.deepEqual(
      issues.map((issue) => issue["path"]).sort(),
      ["body.count", "body.name"],
    );
    assert.equal(
      issues.find((issue) => issue["path"] === "body.name")?.["code"],
      "too_small",
    );
    assert.equal(
      issues.find((issue) => issue["path"] === "body.count")?.["code"],
      "invalid_type",
    );
    assert.equal(handlerCalls, before, "downstream handler must not run");
  });

  test("rejects invalid path parameters", async (): Promise<void> => {
    const before = handlerCalls;
    const response = await request("GET", "/echo/params/not-an-object-id");

    assert.equal(response.status, 400);
    assert.equal(errorPayload(response.json)["code"], ERROR_CODES.VALIDATION_ERROR);

    const issues = issuesOf(response.json);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.["path"], "params.id");
    assert.equal(typeof issues[0]?.["message"], "string");
    assert.equal(handlerCalls, before, "downstream handler must not run");
  });

  test("rejects invalid query parameters", async (): Promise<void> => {
    const before = handlerCalls;
    const response = await request("GET", "/echo/query?round=abc");

    assert.equal(response.status, 400);
    assert.equal(errorPayload(response.json)["code"], ERROR_CODES.VALIDATION_ERROR);

    const issues = issuesOf(response.json);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.["path"], "query.round");
    assert.equal(handlerCalls, before, "downstream handler must not run");
  });

  test("validates multiple request components together", async (): Promise<void> => {
    const validId = "507f1f77bcf86cd799439011";
    const response = await request("POST", `/echo/all/${validId}?round=2`, {
      name: "Grace",
      count: 1,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      body: { name: "Grace", count: 1 },
      params: { id: validId },
      query: { round: 2 },
    });
  });

  test("reports issues from every failing component", async (): Promise<void> => {
    const response = await request("POST", "/echo/all/bad-id?round=abc", {
      name: "",
      count: "x",
    });

    assert.equal(response.status, 400);

    const paths = issuesOf(response.json).map((issue) => issue["path"]);
    assert.ok(paths.includes("body.name"));
    assert.ok(paths.includes("body.count"));
    assert.ok(paths.includes("params.id"));
    assert.ok(paths.includes("query.round"));
  });

  test("uses the documented error envelope", async (): Promise<void> => {
    const response = await fetch(
      `${baseUrl}/echo/query?round=abc&token=secret`,
      { method: "GET" },
    );
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 400);
    assert.equal(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
    );

    const payload = errorPayload(json);

    for (const key of ["code", "details", "message", "path", "status", "timestamp"]) {
      assert.ok(key in payload, `envelope must contain "${key}"`);
    }

    assert.equal(payload["status"], 400);
    assert.equal(payload["code"], ERROR_CODES.VALIDATION_ERROR);
    assert.equal(payload["message"], "Request validation failed");
    assert.equal(payload["path"], "/echo/query");
    assert.equal(typeof payload["timestamp"], "string");
    assert.equal(JSON.stringify(json).includes("secret"), false);
    assert.equal(
      "stack" in payload,
      env.NODE_ENV !== "production",
      "stack is only exposed outside production",
    );
  });

  test("never echoes submitted values in validation errors", async (): Promise<void> => {
    const response = await request("POST", "/echo/body", {
      name: "s3cr3t-submitted-value",
      count: "s3cr3t-submitted-value",
    });

    assert.equal(response.status, 400);
    assert.equal(
      JSON.stringify(response.json).includes("s3cr3t-submitted-value"),
      false,
    );
  });

  test("does not run the handler when validation fails", async (): Promise<void> => {
    const before = handlerCalls;
    await request("POST", "/echo/body", { name: "", count: 1 });
    assert.equal(handlerCalls, before);
  });

  test("keeps unexpected errors distinguishable from validation errors", async (): Promise<void> => {
    const response = await request("POST", "/boom", { any: "payload" });

    assert.equal(response.status, 500);

    const payload = errorPayload(response.json);
    assert.equal(payload["code"], ERROR_CODES.INTERNAL_SERVER_ERROR);
    assert.equal(payload["message"], "Internal server error");
    assert.equal(payload["details"], undefined);
    assert.equal(String(payload["message"]).includes("hunter2"), false);
  });

  test("leaves application errors raised after validation intact", async (): Promise<void> => {
    const response = await request("POST", "/conflict", { any: "payload" });

    assert.equal(response.status, 409);
    assert.equal(errorPayload(response.json)["code"], ERROR_CODES.CONFLICT);
  });

  test("does not interfere with routes that do not validate", async (): Promise<void> => {
    const response = await request("GET", "/plain");

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { plain: true });
  });

  test("strips unknown keys from validated input", async (): Promise<void> => {
    const response = await request("POST", "/echo/body", {
      name: "Ada",
      count: 1,
      role: "admin",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { body: { name: "Ada", count: 1 } });
  });

  test("rejects a missing body", async (): Promise<void> => {
    const response = await request("POST", "/echo/body");

    assert.equal(response.status, 400);

    const issues = issuesOf(response.json);
    assert.deepEqual(
      issues.map((issue) => issue["path"]).sort(),
      ["body.count", "body.name"],
    );
    assert.ok(
      issues.every((issue) => issue["code"] === "invalid_type"),
      "missing members are reported as invalid_type",
    );
  });

  test("keeps the 404 contract for unmatched routes", async (): Promise<void> => {
    const response = await request("GET", "/does-not-exist");

    assert.equal(response.status, 404);
    assert.equal(errorPayload(response.json)["code"], ERROR_CODES.NOT_FOUND);
  });

  test("keeps malformed JSON a body-parser error", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/echo/body`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 400);

    const payload = errorPayload(json);
    assert.equal(payload["code"], ERROR_CODES.BAD_REQUEST);
    assert.equal(payload["message"], "Malformed request body");
  });
});

describe("shared validation utilities", (): void => {
  test("reuses the domain round vocabulary", (): void => {
    assert.equal(roundIdentifierSchema.safeParse(1).success, true);
    assert.equal(roundIdentifierSchema.safeParse(2).success, true);
    assert.equal(roundIdentifierSchema.safeParse(3).success, false);
    assert.equal(roundIdentifierSchema.safeParse("1").success, false);
  });

  test("reuses the shared object id pattern", (): void => {
    assert.equal(idParamsSchema.safeParse({ id: "507f1f77bcf86cd799439011" }).success, true);
    assert.equal(idParamsSchema.safeParse({ id: "507f1f77bcf86cd79943901" }).success, false);
    assert.equal(idParamsSchema.safeParse({}).success, false);
  });
});

function typedHandler(
  req: ValidatedRequest<{ body: typeof bodySchema }>,
  _res: Response,
): void {
  const name: string = req.body.name;
  const count: number = req.body.count;
  void name;
  void count;

  // @ts-expect-error unknown body members are not reachable from a typed handler
  void req.body.unknownField;
}

describe("handler typing", (): void => {
  test("narrows the request type from the schema", (): void => {
    assert.equal(typeof typedHandler, "function");
  });
});
