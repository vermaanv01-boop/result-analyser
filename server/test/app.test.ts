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
