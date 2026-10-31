import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { Express } from "express";
import { createServerlessApp } from "../src/serverless";

interface RunningApp {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startApp(app: Express): Promise<RunningApp> {
  let server!: ReturnType<Express["listen"]>;

  await new Promise<void>((resolve) => {
    server = app.listen(0, (): void => {
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address !== null && typeof address === "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async (): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

describe("serverless database initialization", (): void => {
  test("returns 503 before route handlers when the database is unavailable", async (): Promise<void> => {
    let attempts = 0;
    const app = createServerlessApp({
      connectDatabase: async (): Promise<unknown> => {
        attempts += 1;
        throw new Error("connect ECONNREFUSED mongodb://user:secret@example/db");
      },
    });
    const running = await startApp(app);

    try {
      const login = await fetch(`${running.baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@example.org", password: "not-a-real-password" }),
      });
      assert.equal(login.status, 503);
      const loginJson = (await login.json()) as any;
      assert.equal(loginJson.error.code, "SERVICE_UNAVAILABLE");
      assert.equal(loginJson.error.message, "Database unavailable");
      assert.equal(attempts, 1);

      const competitions = await fetch(`${running.baseUrl}/api/v1/competitions`, {
        headers: { Authorization: "Bearer not-a-real-token" },
      });
      assert.equal(competitions.status, 503);
      const competitionsJson = (await competitions.json()) as any;
      assert.equal(competitionsJson.error.code, "SERVICE_UNAVAILABLE");
      assert.equal(attempts, 2);
    } finally {
      await running.close();
    }
  });

  test("keeps liveness independent of database availability", async (): Promise<void> => {
    let attempts = 0;
    const app = createServerlessApp({
      connectDatabase: async (): Promise<unknown> => {
        attempts += 1;
        throw new Error("database unavailable");
      },
    });
    const running = await startApp(app);

    try {
      const response = await fetch(`${running.baseUrl}/api/v1/health/live`);
      assert.equal(response.status, 200);
      const json = (await response.json()) as any;
      assert.equal(json.status, "ok");
      assert.equal(attempts, 0);
    } finally {
      await running.close();
    }
  });

  test("continues to route handlers after a successful database connection", async (): Promise<void> => {
    let attempts = 0;
    const app = createServerlessApp({
      connectDatabase: async (): Promise<unknown> => {
        attempts += 1;
        return {};
      },
    });
    const running = await startApp(app);

    try {
      const response = await fetch(`${running.baseUrl}/api/v1/competitions`);
      assert.equal(response.status, 401);
      assert.equal(attempts, 1);
    } finally {
      await running.close();
    }
  });
});
