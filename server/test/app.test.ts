import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import type { Express } from "express";
import { createApp } from "../src/app";
import { ERROR_CODES } from "../src/utils/api-error";

let baseUrl = "";
let server: ReturnType<Express["listen"]>;

before(async (): Promise<void> => {
  const app = createApp();
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

describe("health endpoints", (): void => {
  test("liveness stays operational", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(json["status"], "ok");
    assert.equal(typeof json["timestamp"], "string");
    assert.equal(typeof json["uptime"], "number");
    assert.equal(json["error"], undefined, "health payloads contain no error key");
  });

  test("readiness reports the disconnected state", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 503);
    assert.equal(json["status"], "not_ready");
    assert.equal(json["database"], "disconnected");
    assert.equal(json["error"], undefined, "health payloads contain no error key");
  });
});

describe("cors policy", (): void => {
  test("allows the configured client origin", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { Origin: "http://localhost:5173" },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
  });

  test("allows loopback origins outside production", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { Origin: "http://localhost:4200" },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:4200",
    );
  });

  test("withholds headers from disallowed origins", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      headers: { Origin: "https://evil.example" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });

  test("answers preflight requests", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
    assert.equal(
      response.headers.get("access-control-allow-methods"),
      "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    assert.equal(
      response.headers.get("access-control-allow-headers"),
      "Content-Type,Authorization",
    );
  });

  test("serves non browser clients without cors headers", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });
});

describe("error contract", (): void => {
  test("keeps the not found envelope", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 404);

    const error = json["error"] as Record<string, unknown>;
    assert.equal(error["status"], 404);
    assert.equal(error["code"], ERROR_CODES.NOT_FOUND);
    assert.equal(error["path"], "/api/v1/does-not-exist");
  });
});

describe("judge portal routing", (): void => {
  test("requires authentication for judge endpoints", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/judge/panels`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 401);
    const error = json["error"] as Record<string, unknown>;
    assert.equal(error["code"], ERROR_CODES.UNAUTHORIZED);
  });
});

describe("judge evaluation routing", (): void => {
  const validBody = JSON.stringify({
    competition: "507f1f77bcf86cd799439011",
    participant: "507f1f77bcf86cd799439012",
    panel: "507f1f77bcf86cd799439013",
    round: 1,
    scores: [{ parameter: "507f1f77bcf86cd799439014", awardedMarks: 10 }],
  });

  test("requires authentication to save or submit evaluations", async (): Promise<void> => {
    const draftResponse = await fetch(`${baseUrl}/api/v1/evaluations/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: validBody,
    });
    const draftJson = (await draftResponse.json()) as Record<string, unknown>;
    assert.equal(draftResponse.status, 401);
    assert.equal(
      (draftJson["error"] as Record<string, unknown>)["code"],
      ERROR_CODES.UNAUTHORIZED,
    );

    const submitResponse = await fetch(`${baseUrl}/api/v1/evaluations/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: validBody,
    });
    assert.equal(submitResponse.status, 401);
  });

  test("rejects malformed evaluation IDs before reaching the handler", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/evaluations/not-an-object-id`, {
      headers: { Authorization: "Bearer invalid.token.value" },
    });
    assert.equal(response.status, 401);
  });

  test("requires authentication to read a single evaluation", async (): Promise<void> => {
    const response = await fetch(
      `${baseUrl}/api/v1/evaluations/507f1f77bcf86cd799439011`,
    );
    assert.equal(response.status, 401);
  });
});

describe("admin management routing", (): void => {
  const competitionId = "507f1f77bcf86cd799439011";
  const panelId = "507f1f77bcf86cd799439012";

  test("requires authentication to list judge selector options", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/auth/judges`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 401);
    const error = json["error"] as Record<string, unknown>;
    assert.equal(error["code"], ERROR_CODES.UNAUTHORIZED);
  });

  test("requires authentication to create or update panel assignments", async (): Promise<void> => {
    const createResponse = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Unauthorized Panel",
          judges: ["507f1f77bcf86cd799439013"],
        }),
      },
    );
    assert.equal(createResponse.status, 401);

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/panels/${panelId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judges: ["507f1f77bcf86cd799439013"] }),
      },
    );
    assert.equal(updateResponse.status, 401);
  });
});

describe("participant portal routing", (): void => {
  test("mounts the documented /portal path behind authentication", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/portal/profile`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 401);
    const error = json["error"] as Record<string, unknown>;
    assert.equal(error["code"], ERROR_CODES.UNAUTHORIZED);
  });

  test("keeps the /participant alias behind authentication", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/participant/profile`);
    const json = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 401);
    const error = json["error"] as Record<string, unknown>;
    assert.equal(error["code"], ERROR_CODES.UNAUTHORIZED);
  });
});

describe("leaderboard routing", (): void => {
  const competitionId = "507f1f77bcf86cd799439011";

  test("exposes documented leaderboard routes without authentication", async (): Promise<void> => {
    const overall = await fetch(
      `${baseUrl}/api/v1/competitions/not-an-object-id/leaderboard`,
    );
    const overallJson = (await overall.json()) as Record<string, unknown>;
    assert.equal(overall.status, 400);
    assert.equal(
      (overallJson["error"] as Record<string, unknown>)["code"],
      ERROR_CODES.VALIDATION_ERROR,
    );

    const round = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/leaderboard/round/3`,
    );
    const roundJson = (await round.json()) as Record<string, unknown>;
    assert.equal(round.status, 400);
    assert.equal(
      (roundJson["error"] as Record<string, unknown>)["code"],
      ERROR_CODES.VALIDATION_ERROR,
    );

    const panel = await fetch(
      `${baseUrl}/api/v1/competitions/${competitionId}/leaderboard/panel/not-an-object-id`,
    );
    const panelJson = (await panel.json()) as Record<string, unknown>;
    assert.equal(panel.status, 400);
    assert.equal(
      (panelJson["error"] as Record<string, unknown>)["code"],
      ERROR_CODES.VALIDATION_ERROR,
    );
  });

  test("keeps the rest of the competition router authenticated", async (): Promise<void> => {
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/v1/competitions`),
      fetch(`${baseUrl}/api/v1/competitions/${competitionId}`),
      fetch(`${baseUrl}/api/v1/competitions/${competitionId}/panels`),
      fetch(`${baseUrl}/api/v1/competitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Unauthorized Competition" }),
      }),
    ]);

    responses.forEach((response): void => {
      assert.equal(response.status, 401);
    });
  });
});

describe("auth email and activation routing", (): void => {
  test("requires a token and password to activate a judge account", async (): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/v1/auth/judge/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "", password: "short" }),
    });
    assert.equal(response.status, 400);
  });
});
