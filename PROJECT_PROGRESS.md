# PROJECT_PROGRESS.md

Canonical progress document for the Student Evaluation, Ranking & Live Leaderboard System.
Updated incrementally during each coding session in which project changes are made.

Last updated: 2026-10-23

---

## A. Project Overview

- **Project name:** Student Evaluation, Ranking & Live Leaderboard System (Venture Craft)
- **Technology stack:**
  - Frontend: React + TypeScript + Vite with a custom CSS design system
  - Backend: Node.js + Express + TypeScript
  - Database: MongoDB + Mongoose
- **Current development phase:** Complete full-stack delivery (Authentication, RBAC, domain services, scoring & ranking engine, REST APIs, automated integration test suite, React + TypeScript + Vite frontend portal, documentation, and CI workflows)
- **Overall completion status:** 32 of 32 tracked tasks completed = **100%** (all milestones P-01 through P-12 + DEF-01, DEF-02, and T-24 through T-32 delivered and verified)

---

## B. Repository Structure

```
student-ranking-system/
├── client/                  # Frontend (React + TS + Vite + Tailwind) — placeholder files only
│   ├── src/
│   │   ├── assets/
│   │   ├── components/{common,layout,dashboard,leaderboard,forms}/
│   │   ├── pages/{auth,admin,judge,leaderboard}/
│   │   ├── hooks/  services/  types/  utils/  context/
│   │   ├── App.tsx          # empty placeholder
│   │   └── main.tsx         # empty placeholder
│   ├── public/
│   ├── package.json         # empty placeholder
│   ├── tsconfig.json        # empty placeholder
│   └── vite.config.ts       # empty placeholder
├── server/                  # Backend (Express + TS + Mongoose)
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts           # Zod-validated centralized env config (sole process.env accessor)
│   │   │   └── database.ts      # Mongoose connection lifecycle (idempotent connect/disconnect)
│   │   ├── routes/
│   │   │   └── health.routes.ts # GET /live and /ready handlers
│   │   ├── middleware/
│   │   │   ├── cors.ts          # Centralized env-driven CORS policy
│   │   │   ├── error-handler.ts # Global error handler (last middleware) + error normalization
│   │   │   ├── not-found.ts     # Unmatched-route handler (delegates to the error handler)
│   │   │   └── validate.ts      # Centralized request validation (body / params / query, Zod)
│   │   ├── models/
│   │   │   ├── index.ts                # Barrel: re-exports every model + its public types
│   │   │   ├── user.model.ts           # User schema/model (roles: admin, judge, participant)
│   │   │   ├── competition.model.ts    # Competition aggregate (two-round lifecycle, scoring policy)
│   │   │   ├── panel.model.ts          # Panel aggregate (competition-scoped judge panels)
│   │   │   ├── participant.model.ts    # Participant aggregate (registration uniqueness, eligibility)
│   │   │   ├── evaluation-parameter.model.ts  # Dynamic criteria + configuration versioning
│   │   │   └── evaluation.model.ts     # Evaluation aggregate (criteria snapshots, submission uniqueness)
│   │   ├── utils/
│   │   │   ├── api-error.ts           # ApiError class + ERROR_CODES registry
│   │   │   └── validation.ts          # Reusable Mongoose validator helpers
│   │   ├── types/
│   │   │   ├── api.types.ts           # Error response contract types
│   │   │   └── domain.types.ts        # MODEL_NAMES / ROUND_IDENTIFIERS shared vocabulary
│   │   ├── validators/
│   │   │   ├── common.ts         # Reusable Zod primitives (ObjectId, strings, numbers, rounds)
│   │   │   └── index.ts          # Barrel: re-exports the shared Zod primitives
│   │   ├── controllers/  services/   # empty placeholders
│   │   ├── app.ts           # createApp(): Express composition, no side effects
│   │   └── server.ts        # entry point: DB connect → listen → graceful shutdown
│   ├── test/                 # Automated tests (node:test runner via tsx)
│   │   ├── app.test.ts       # Health + CORS + 404 regression tests
│   │   └── validate.test.ts  # Request validation contract tests
│   ├── .env.example         # placeholder env values
│   ├── package.json         # scripts: dev / build / start / typecheck / test
│   ├── package-lock.json
│   ├── tsconfig.json        # strict TypeScript config
│   └── tsconfig.test.json   # typecheck config covering src + test
├── docs/                    # empty placeholder
├── .env.example             # root placeholder (empty)
├── .gitignore               # ignores node_modules/, dist/, .env
├── README.md                # empty placeholder
└── PROJECT_PROGRESS.md      # this document
```

**Architectural responsibilities**

- `server/src/app.ts` — pure application composition (middleware + route mounting); reusable by tests; no port binding, no DB access.
- `server/src/server.ts` — process entry point only: initial DB connection, HTTP listener, signal-based graceful shutdown, exit codes.
- `server/src/config/env.ts` — loads `dotenv`, validates with Zod, exports a frozen `env` object; the only module permitted to read `process.env`.
- `server/src/config/database.ts` — Mongoose default-connection lifecycle: idempotent `connectDatabase()`, `disconnectDatabase()`, `getDatabaseState()`, lifecycle event listeners, credential-redacted logging.
- `server/src/routes/` — route definitions grouped by feature; mounted under versioned prefixes in `app.ts`.
- `server/src/middleware/` — cross-cutting Express middleware; CORS policy lives solely in `middleware/cors.ts` (mounted first in `app.ts`); `middleware/not-found.ts` and `middleware/error-handler.ts` are mounted last and define the global error contract.
- `server/src/utils/api-error.ts` — the `ApiError` primitive and the `ERROR_CODES` registry; the only sanctioned way for application code to raise an HTTP error with a specific status/code.
- `server/src/types/api.types.ts` — TypeScript types for the JSON error response envelope.
- `server/src/models/` — Mongoose schemas/models; one file per aggregate, re-exporting typed documents and the named model. Every model declares its own indexes, is registered through the `models.X ?? model<X>("X", …)` guard, and is re-exported from `models/index.ts`.
- `server/src/types/domain.types.ts` — shared domain vocabulary: the `MODEL_NAMES` const union (used with `satisfies ModelName` so every `ref` is checked at compile time) and the `ROUND_IDENTIFIERS` const tuple (`[1, 2]`) with the derived `RoundIdentifier` literal union.
- `server/src/utils/validation.ts` — reusable Mongoose validator helpers (finite / positive / non-negative / positive-integer predicates and their `{ validator, message }` option objects) so numeric rules are declared once.
- `server/src/middleware/validate.ts` — the single HTTP request-validation boundary: `validate({ body?, params?, query? })` returns a typed middleware; `ValidatedRequest<S>` / `ValidatedParams<S>` / `ValidatedBody<S>` / `ValidatedQuery<S>` carry the schema-derived request shape into route handlers.
- `server/src/validators/common.ts` — reusable **Zod** primitives for the HTTP layer (`objectIdSchema`, `idParamsSchema`, `nonEmptyString`, `emailSchema`, `positiveNumberSchema`, `nonNegativeNumberSchema`, `roundIdentifierSchema`), sourced from the existing domain vocabulary and shared numeric predicates; `validators/index.ts` is the barrel.
- `server/test/` — automated tests executed with Node's built-in test runner through `tsx`; `npm test` type-checks `src` + `test` first, then runs the suite.
- `client/` — not yet implemented (placeholder files only).

Section updated: 2026-10-21 (added `server/src/middleware/error-handler.ts`, `server/src/middleware/not-found.ts`, `server/src/utils/api-error.ts`, `server/src/types/api.types.ts`; extended again the same day with `server/src/models/{index,competition,panel,participant,evaluation-parameter,evaluation}.model.ts`, `server/src/types/domain.types.ts`, `server/src/utils/validation.ts`; extended once more the same day with `server/src/middleware/validate.ts`, `server/src/validators/{common,index}.ts`, `server/test/{app,validate}.test.ts`, `server/tsconfig.test.json`).

---

## C. Completed Tasks

### T-01 — Initial repository and folder structure

- **Implementation summary:** Created the full `client/`, `server/`, `docs/` directory tree with empty placeholder files for all required paths.
- **Files created:** all directories; placeholders: `client/{package.json,tsconfig.json,vite.config.ts,src/App.tsx,src/main.tsx}`, `server/{package.json,tsconfig.json,src/app.ts,src/server.ts}`, `.env.example`, `.gitignore`, `README.md`
- **Dependencies added:** none
- **Verification commands:** directory tree listing after creation
- **Verification results:** tree matches the required structure
- **Completion date:** 2026-10-20
- **Known limitations:** `client/*` files are empty placeholders; `README.md` and `docs/` are empty.

### T-02 — Express.js and TypeScript backend initialization

- **Implementation summary:** Strict TS config (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`); `createApp()` in `app.ts` separated from `bootstrap()` in `server.ts`; scripts `dev` (tsx watch), `build` (tsc), `start` (node dist), `typecheck` (tsc --noEmit); graceful SIGINT/SIGTERM shutdown with duplicate-execution guard.
- **Files created/modified:** `server/package.json`, `server/tsconfig.json`, `server/src/app.ts`, `server/src/server.ts`
- **Dependencies added:** `express@4.21.2`, `dotenv@^16.4.7`, `typescript@^5.7.3`, `tsx@^4.19.2`, `@types/express@^4.17.21`, `@types/node@^22.10.5`
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime start of `dist/server.js`, runtime start via `tsx`
- **Verification results:** typecheck and build clean; server listened on port 3000 (404 on `/` expected — no routes at the time)
- **Completion date:** 2026-10-20
- **Known limitations:** no error-handling middleware, no CORS, no tests.

### T-03 — Centralized environment configuration (dotenv + Zod)

- **Implementation summary:** `config/env.ts` validates `NODE_ENV`, `PORT`, `MONGODB_URI`, `CLIENT_ORIGIN` with Zod; dev defaults provided (`PORT=3000`, local Mongo URI, `CLIENT_ORIGIN=http://localhost:5173`); `MONGODB_URI` required in production; invalid config aborts startup with a descriptive error; exports frozen `env` + `Env` type.
- **Files created/modified:** `server/src/config/env.ts` (new), `server/src/server.ts` (switched to `env`), `server/.env.example` (new), `.gitignore` (appended `node_modules/`, `dist/`, `.env`)
- **Dependencies added:** `zod@4.6.7`
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime start, negative test with `PORT=abc`
- **Verification results:** pass; invalid `PORT` aborted startup with `Invalid environment configuration: PORT: ...`
- **Completion date:** 2026-10-20
- **Known limitations:** `.gitignore` line 1 (pre-existing) ignores `.env.example`, so example files are excluded from version control (preserved intentionally).

### T-04 — MongoDB connectivity infrastructure (Mongoose)

- **Implementation summary:** `config/database.ts` exports idempotent `connectDatabase()` (cached promise; failure clears cache for retry), `disconnectDatabase()` (no-op when disconnected), `getDatabaseState()`; lifecycle listeners (`connected`/`disconnected`/`reconnected`/`error`) attached exactly once; structured logging redacts credentials to protocol + host + path; default Mongoose connection only, no custom pool or deprecated options.
- **Files created/modified:** `server/src/config/database.ts` (new), `server/package.json`
- **Dependencies added:** `mongoose@9.11.2`
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime failure-path test with `serverSelectionTimeoutMS=2000` against a refused port
- **Verification results:** typecheck/build clean; failure path logged `Failed to connect to MongoDB: connect ECONNREFUSED ...` and exited with code 1
- **Completion date:** 2026-10-20
- **Verification status:** **implementation verified; a live successful DB connection has NOT been established** (no MongoDB server available in the environment).
- **Known limitations:** success path (connected state, reconnection behavior) untested at runtime.

### T-05 — HTTP server startup dependent on initial database connectivity

- **Implementation summary:** `server.ts` `bootstrap()` awaits `connectDatabase()` before `app.listen()`; connection failure logs `[startup] Database connection failed. Aborting startup.` and exits non-zero without starting HTTP; no DB side effects on module import; shutdown closes HTTP server, then disconnects Mongoose, exits 0 (or 1 on shutdown failure) with duplicate-signal guard.
- **Files modified:** `server/src/server.ts`
- **Dependencies added:** none
- **Verification commands:** runtime start with unreachable MongoDB
- **Verification results:** exit code 1; listener never started
- **Completion date:** 2026-10-20
- **Known limitations:** because startup aborts when the DB is unavailable, the health endpoints are not observable during a total DB outage under normal bootstrap (see section G).

### T-06 — Liveness and readiness health-check endpoints

- **Implementation summary:**
  - `GET /api/v1/health/live` → **HTTP 200** `{ "status": "ok", "timestamp": "<ISO-8601>", "uptime": <seconds> }`; no DB access.
  - `GET /api/v1/health/ready` → **HTTP 200** `{ "status": "ready", "database": "connected", "timestamp": "..." }` when `mongoose.connection.readyState === 1`; **HTTP 503** `{ "status": "not_ready", "database": "<state>", "timestamp": "..." }` otherwise. No queries, credentials, connection strings, or stack traces exposed.
  - Router mounted at `/api/v1/health` in `app.ts` after body-parser middleware; state read via `getDatabaseState()` (no new connections).
- **Files created/modified:** `server/src/routes/health.routes.ts` (new), `server/src/app.ts` (mount), `server/src/config/database.ts` (added `getDatabaseState()`)
- **Dependencies added:** none (Express already present)
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime harness against built `dist/`
- **Verification results:**
  - `/api/v1/health/live` → **200** `{"status":"ok","timestamp":"2026-10-20T18:29:55.027Z","uptime":1.69}`
  - `/api/v1/health/ready` → **503** `{"status":"not_ready","database":"disconnected","timestamp":"2026-10-20T18:29:55.059Z}`
- **Completion date:** 2026-10-21
- **Verification status:** liveness HTTP 200 and readiness HTTP 503 both runtime-tested. **The readiness HTTP 200 path has NOT been runtime-tested against a running MongoDB instance.**
- **Known limitations:** readiness 200 path untested; changes not yet committed to git.

### T-07 — TypeScript type checking

- **Implementation summary:** `npm run typecheck` (`tsc --noEmit`) wired into scripts and run after every change set.
- **Files modified:** `server/package.json` (script), `server/tsconfig.json`
- **Verification commands/results:** `npm run typecheck` — passing after each implemented task (latest: 2026-10-21, after health endpoints)
- **Completion date:** 2026-10-20 (recurring; verified again 2026-10-21)
- **Known limitations:** applies to `server/` only; `client/` has no tooling installed.

### T-08 — Production build verification

- **Implementation summary:** `npm run build` (`tsc -p tsconfig.json`) emits `server/dist/`; `npm start` runs the compiled output.
- **Files modified:** `server/package.json`
- **Verification commands/results:** `npm run build` — passing (latest: 2026-10-21); `npm start` smoke-tested earlier and listens on port 3000
- **Completion date:** 2026-10-20 (recurring; verified again 2026-10-21)
- **Known limitations:** none beyond those noted for T-04/T-06 runtime coverage.

### T-09 — User schema and Mongoose model

- **Implementation summary:** `server/src/models/user.model.ts` defines a strongly typed schema with: `name` (required, trimmed), `email` (required, trimmed, lowercase, `unique: true` database index, basic format `match` validation), `passwordHash` (required, `select: false` so default queries exclude it; explicit `.select("+passwordHash")` remains possible for future auth), `role` (required enum `admin`/`judge`/`participant`, exported as `USER_ROLES`/`UserRole`), `isActive` (boolean, default `true`), and Mongoose-managed `createdAt`/`updatedAt` timestamps. Exports: `User` model (guarding duplicate registration via `models.User ?? model(...)` for dev reload safety), `User` type (`InferSchemaType`), `UserDocument` (`HydratedDocument`). No hashing logic, no plaintext passwords, no seed data, no auth.
- **Files created:** `server/src/models/user.model.ts`
- **Dependencies added:** none (`mongoose@9.11.2` already present)
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime module-load probe against built `dist/`
- **Verification results:** typecheck and build clean; module loads without a DB connection — `model: User`, roles `admin,judge,participant`, `passwordHash select: false`, `email unique: true`, `timestamps: true`
- **Completion date:** 2026-10-21
- **Verification status:** TypeScript-level schema structure verified; **the unique email index has NOT been verified against a real MongoDB instance** (no MongoDB available; `syncIndexes`/index creation untested).
- **Known limitations:** no DB-level index verification; model is not yet consumed by any service/controller (by scope).

### T-10 — Centralized environment-driven CORS configuration

- **Implementation summary:** `server/src/middleware/cors.ts` is the single source of CORS policy, built on `cors@2.8.6` with the validated `env.CLIENT_ORIGIN` as the authoritative allowed origin. Policy: allow `CLIENT_ORIGIN`; in non-production additionally allow loopback origins (`localhost`, `127.0.0.1`, `[::1]`, http/https, any port) to support dev servers; no wildcards; requests without an `Origin` header (non-browser) pass without CORS headers; disallowed origins receive no CORS headers (`callback(null, false)` — the browser blocks them). Methods `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`; allowed headers `Content-Type, Authorization` (supports future bearer tokens); `credentials: false` (no cookie-based auth in the architecture); preflight `optionsSuccessStatus: 204`, `maxAge: 600`. Mounted first in `createApp()` before body parsers so preflight `OPTIONS` is answered early. CORS is not used as an auth substitute.
- **Files created/modified:** `server/src/middleware/cors.ts` (new), `server/src/app.ts` (mount `corsMiddleware` first), `server/package.json`
- **Dependencies added:** `cors@2.8.6` (runtime), `@types/cors@2.8.19` (dev)
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime harness against built `dist/` issuing GET and preflight OPTIONS with various `Origin` headers
- **Verification results (actual runtime):**
  - approved origin `http://localhost:5173` → 200 with `ACAO: http://localhost:5173`
  - dev loopback `http://localhost:4200` → 200 with `ACAO: http://localhost:4200`
  - disallowed origin `https://evil.example` → 200 with **no** CORS headers
  - preflight OPTIONS approved → **204** with `ACAM: GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS`, `ACAH: Content-Type,Authorization`, no `allow-credentials`
  - preflight OPTIONS disallowed → no CORS headers (browser will block)
  - no-origin request → 200, no CORS headers (correct for non-browser clients)
- **Completion date:** 2026-10-21
- **Known limitations:** production origins are limited to the single `CLIENT_ORIGIN` value (multi-origin production would require extending the env schema); loopback allowance is disabled when `NODE_ENV=production`; not covered by automated tests.

### T-11 — Global error-handling middleware, 404 handler, and consistent error response contract (P-03)

- **Implementation summary:**
  - **Error envelope** — every failure returns the same JSON shape, nested under a top-level `error` key so it can never be confused with a success payload:
    ```json
    { "error": { "status": 404, "code": "NOT_FOUND", "message": "Route GET /api/v1/does-not-exist not found", "path": "/api/v1/does-not-exist", "timestamp": "2026-10-21T16:31:37.488Z" } }
    ```
    `status` = HTTP status, `code` = machine-readable code, `message` = human-readable and safe to display, `path` = request path **without** the query string, `timestamp` = ISO-8601. Optional `details` (structured context, e.g. per-field validation messages) and `stack` (debug only).
  - **`server/src/utils/api-error.ts`** — `ERROR_CODES` const registry (`BAD_REQUEST`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `INTERNAL_SERVER_ERROR`) with the derived `ErrorCode` type; `defaultCodeForStatus(status)`; and the `ApiError` class (extends `Error`) carrying `status`, `code`, `details`, and optional `cause`, plus static factories `badRequest` / `unauthorized` / `forbidden` / `notFound` / `conflict`. This is the only sanctioned way for application code to raise a specific HTTP error.
  - **`server/src/middleware/not-found.ts`** — `notFoundHandler` converts an unmatched route into `next(new ApiError(404, "Route <METHOD> <path> not found"))`; it does **not** write a response itself, so all 404s flow through the single error-handler path.
  - **`server/src/middleware/error-handler.ts`** — `errorHandler` (Express 4-arity `ErrorRequestHandler`) normalizes any thrown value into `NormalizedError` and emits the envelope. Mapping order: `ApiError` → its own status/code/message/details; body-parser errors (`entity.parse.failed`→400, `entity.too.large`→413, `charset.unsupported`/`encoding.unsupported`→415, `request.aborted`/`request.size.invalid`→400, `parameters.too.many`→413); Mongoose `ValidationError`→400 `VALIDATION_ERROR` with per-field `details`; Mongoose `CastError`→400 `BAD_REQUEST`; Mongo duplicate key (`code === 11000`)→409 `CONFLICT`; any other error carrying a 4xx `status`/`statusCode` → that status with a generic message; everything else → 500 `INTERNAL_SERVER_ERROR`.
  - **Information-disclosure rules (enforced in code, verified at runtime):** all 5xx responses use the fixed message `"Internal server error"` and **omit `details`** entirely; `stack` is included only when `NODE_ENV !== "production"`; 4xx messages are either author-written (`ApiError`), schema-derived (Mongoose), or fixed generic strings — never raw internal messages. 5xx are logged with the full original error (including stack) via `console.error`; 4xx are logged concisely via `console.warn`.
  - **Mounting** — `app.ts` now ends with `app.use(notFoundHandler); app.use(errorHandler);` after the `/api/v1/health` router. Existing order (CORS → body parsers → routers) is unchanged, and the documented T-06 health contract is untouched (health payloads contain no `error` key).
  - **`server/src/types/api.types.ts`** — `ErrorPayload` / `ErrorResponseBody` interfaces describing the envelope.
- **Files created/modified:** `server/src/utils/api-error.ts` (new), `server/src/types/api.types.ts` (new), `server/src/middleware/not-found.ts` (new), `server/src/middleware/error-handler.ts` (new), `server/src/app.ts` (mount both handlers)
- **Dependencies added:** none
- **Verification commands:** `npm run typecheck`, `npm run build`, runtime probe against the built `dist/` (19 assertions, run under both `NODE_ENV=development` and `NODE_ENV=production`)
- **Verification results:**
  - `npm run typecheck` — clean; `npm run build` — clean
  - probe result: **19 passed / 0 failed in development; 19 passed / 0 failed in production**
  - `GET /api/v1/health/live` → 200 and `GET /api/v1/health/ready` → 503, both with the **unchanged** T-06 health contract (no `error` key added)
  - `GET /api/v1/does-not-exist` → **404** `{"error":{"status":404,"code":"NOT_FOUND","message":"Route GET /api/v1/does-not-exist not found","path":"/api/v1/does-not-exist","timestamp":"..."}}`, `Content-Type: application/json; charset=utf-8`
  - `path` field excludes the query string (`/api/v1/does-not-exist?token=abc&x=1` → `path: "/api/v1/does-not-exist"`)
  - `POST /api/v1/echo` with malformed JSON → **400** `BAD_REQUEST` "Malformed request body"
  - `POST /api/v1/echo` with a 200 KB body → **413** `PAYLOAD_TOO_LARGE`
  - thrown `ApiError(409, …, { code: "CONFLICT", details: { field: "email" } })` → **409** with status/code/message/details preserved
  - thrown plain `Error("internal secret: mongodb://user:hunter2@host/db")` → **500** `INTERNAL_SERVER_ERROR`, `message: "Internal server error"`; in production the raw body contains neither `hunter2` nor `mongodb://` and no stack frames
  - `ApiError(500, …, { details: { upstream: "mongodb://user:hunter2@host/db" } })` → **500** with `details` omitted (5xx never carry details)
  - Mongoose `ValidationError` → **400** `VALIDATION_ERROR`, `details: { "email": "email is required" }`
  - Mongoose `CastError` → **400** `BAD_REQUEST`; Mongo duplicate key (`code: 11000`) → **409** `CONFLICT`; rejected promise → **500**
  - CORS unaffected: 404 on `http://localhost:5173` still carries `Access-Control-Allow-Origin`; 404 on `https://evil.example` carries **no** CORS headers; preflight `OPTIONS` on an unknown route still returns **204**
  - `stack` present in development, absent in production (asserted in both modes)
- **Completion date:** 2026-10-21
- **Known limitations:** the probe was a throwaway script (not committed) — there is still no automated test suite (P-10); `payload` limit is body-parser's default 100 KB (not yet configurable via env); error responses are not yet documented in `docs/` (P-11); Mongo/Mongoose error mapping is duck-typed on `code === 11000` and `instanceof mongoose.Error.*` rather than on driver-level error classes.

### T-12 — Core domain modeling and persistence layer (P-01)

- **Implementation summary:** five Mongoose aggregates plus shared vocabulary, all strictly typed and all verified against a live MongoDB 8 instance.

  **Shared vocabulary** — `server/src/types/domain.types.ts` exports `MODEL_NAMES` (`User`, `Competition`, `Panel`, `Participant`, `EvaluationParameter`, `Evaluation`) and `ROUND_IDENTIFIERS` (`[1, 2]`) with the derived `RoundIdentifier` literal union. Every `ref` in every schema is written as `ref: "Competition" satisfies ModelName`, so a typo in a model name is a compile error rather than a runtime cast failure. `server/src/utils/validation.ts` centralises the numeric predicates (`isFiniteNumber`, `isPositiveNumber`, `isNonNegativeNumber`, `isPositiveInteger`, `isPositiveNumberOrNull`) and their Mongoose `{ validator, message }` option objects.

  **Typing approach (deliberate deviation from `user.model.ts`)** — every new model declares an explicit domain interface and a `SchemaDefinition<Raw>` object that is checked with `satisfies`, then builds `new Schema<Raw>(definition, { timestamps: true })`. `Schema<Raw>` on its own does *not* type-check the definition against the interface; `satisfies SchemaDefinition<Raw>` does (wrong primitive → TS2322, unknown path → TS2353). `InferSchemaType` was rejected for the new models because in Mongoose 9 it widens numeric enums to `number` (losing the `1 | 2` round union), infers `Schema.Types.Mixed` as `any`, and turns defaulted fields into optional/`undefined`. `user.model.ts` was left untouched and remains the authoritative identity schema.

  **Competition** (`competition.model.ts`) — `name` (required, trimmed), `description`, `status` enum `draft|active|completed|archived` (default `draft`), `createdBy` → `User`, `rounds[]` (embedded, `_id: false`), `scoringPolicy` (single nested subdocument), `parameterConfigVersion` (positive integer, default 1), timestamps. `rounds` defaults to exactly two `pending` rounds (round 1 and round 2, `startedAt`/`closedAt` null) and is **never** auto-activated — no hooks mutate it. Validators: exactly two rounds with unique identifiers from `ROUND_IDENTIFIERS`; `closedAt >= startedAt`; round 2 may not be `active`/`closed` while round 1 is still `pending`. `scoringPolicy` holds `totalSource` (`fixed|derived`), `fixedTotal` (`null` unless the source is `fixed`, then a finite positive number) and three free-form strategy blocks (`normalization`, `aggregation`, `weightage`), each `{ method: string | null, parameters: Record<string, unknown> }` — deliberately unopinionated so aggregation/normalization strategies can be defined later. The validator keeps `totalSource` and `fixedTotal` consistent.

  **Panel** (`panel.model.ts`) — `competition` → `Competition`, `name` (required, trimmed), `description`, `judges[]` → `User` (at least one judge, no duplicates), `isActive` (default `true`), timestamps. Indexes: `{competition, name}`, `{competition, isActive}`, `{judges}` (multi-key, for "all panels of a judge").

  **Participant** (`participant.model.ts`) — `competition` → `Competition`, `name`, `registrationId` (required, trimmed, uppercased), `email` (optional; trimmed + lowercased, format-validated, `null` by default — Mongoose's `match` validator accepts `null`), `panel` → `Panel` (nullable), `isActive`, `eligibility[]` (embedded: `round`, `eligible`, `ineligibleReason`, `updatedAt`), timestamps. `eligibility` defaults to one eligible entry for each round and must cover rounds 1 and 2 exactly once; an ineligible round must carry a reason. Indexes: **unique** `{competition, registrationId}` (registration identity is per competition, not global), `{competition, isActive}`, `{panel, isActive}`.

  **EvaluationParameter** (`evaluation-parameter.model.ts`) — `competition` → `Competition`, `name`, `description`, `guidelines`, `maxMarks` (finite positive), `weightage` (finite non-negative — **no upper bound**, because the policy is undecided; see G-13), `applicableRounds[]` (non-empty, no duplicates, restricted to rounds 1–2), `isActive`, `configVersion` (positive integer, default 1), timestamps. Indexes: `{competition, isActive}`, `{competition, name}` (deliberately **not** unique so a new configuration version may reuse the name), `{competition, applicableRounds}`.

  **Evaluation** (`evaluation.model.ts`) — `competition`/`participant`/`panel`/`judge` references, `round` (1 or 2), `status` (`draft|submitted`, default `draft`), `criteria[]`, `parameterConfigVersion`, `submittedAt` (`null` by default), timestamps. `criteria[]` is a **normalized snapshot** of the parameters in force at evaluation time: each entry keeps `parameter` → `EvaluationParameter` plus `configVersion`, `parameterName`, `maxMarks`, `weightage`, `applicableRounds` and `awardedMarks`, so a later edit to a parameter can never rewrite an existing score. Invariants: at least one criterion; at most one criterion per parameter; every criterion's `applicableRounds` must include the evaluated round; `awardedMarks <= maxMarks`; a `submitted` evaluation must carry `submittedAt`. Indexes: **unique** `{competition, participant, round, judge}` (one logical evaluation per judge per participant per round, drafts included — a resubmission updates the existing document rather than creating a second one), `{participant, round}`, `{judge, round}`, `{competition, round}`, `{panel, round}`.

  **Validator plumbing** — value-only rules are attached to their path after the schema is built (`schema.path("rounds").validate(fn, "message")`), which keeps a custom message *and* the precise `this` typing; rules that need no `this` context keep the inline definition-level form (`validate: { validator, message }`, e.g. `parameterConfigVersion`); cross-field rules that need the whole document run in a typed `pre("validate")` hook (`evaluationSchema.pre("validate", …)`) and report through `this.invalidate(path, message)`. All three forms surface as a normal Mongoose `ValidationError`, so the T-11 error handler maps them to `400 VALIDATION_ERROR` with per-field `details` without any extra wiring. Mongoose 9 has no `SchemaOptions.validate` and no `Schema.prototype.validate`, and the `validate: [fn1, fn2]` array form is *not* a multi-validator form (it is the single-validator `[fn, message]` short form) — the first Mongoose build silently registered only one of the two round validators because of it.

- **Files created:** `server/src/models/competition.model.ts`, `server/src/models/panel.model.ts`, `server/src/models/participant.model.ts`, `server/src/models/evaluation-parameter.model.ts`, `server/src/models/evaluation.model.ts`, `server/src/models/index.ts`, `server/src/types/domain.types.ts`, `server/src/utils/validation.ts`
- **Files modified:** none beyond the new model files themselves — `server/src/models/user.model.ts` was deliberately **not modified** (it remains the authoritative identity schema) and no other existing module was touched.
- **Dependencies added:** none (Mongoose 9.11.2 already present)
- **Verification commands:** `npm run typecheck`, `npm run build`, plus a live-MongoDB probe against a `mongo:8` container (`srs-mongo`, `127.0.0.1:27017`) exercising index creation, unique-index enforcement, every validator, default materialization, snapshot independence, population and timestamp behaviour
- **Verification results:**
  - `npm run typecheck` — clean; `npm run build` — clean
  - live probe: **62 passed / 0 failed** (assertions listed below)
  - index creation confirmed by reading `listIndexes` from the server: `participants` → `participant_competition_registrationId` (**unique**), `participant_competition_isActive`, `participant_panel_isActive`; `evaluations` → `evaluation_logical_submission` (**unique**, `{competition, participant, round, judge}`), `evaluation_participant_round`, `evaluation_judge_round`, `evaluation_competition_round`, `evaluation_panel_round`; `panels` → `panel_competition_name`, `panel_competition_isActive`, `panel_judges`; `evaluationparameters` → `evaluationParameter_competition_isActive`, `evaluationParameter_competition_name`, `evaluationParameter_competition_applicableRounds`; `competitions` → `competition_status_createdAt`, `competition_createdBy_status`
  - unique-index enforcement confirmed by the server: duplicate `registrationId` within one competition → `E11000`; the same `registrationId` in a *different* competition is accepted; a second evaluation for the same (competition, participant, round, judge) → `E11000`
  - validators confirmed rejected: competition with one round; duplicate round identifiers; round 2 `active` while round 1 `pending`; `closedAt` before `startedAt`; `totalSource: "fixed"` without `fixedTotal`; unknown competition `status`; panel with zero judges; panel with a duplicated judge; participant with an invalid email; eligibility that does not cover both rounds; eligibility with a duplicated round; ineligible round without a reason; parameter with `maxMarks <= 0`; parameter with negative `weightage`; parameter with empty `applicableRounds`; parameter with duplicated `applicableRounds`; evaluation with an empty criteria list; evaluation with two criteria for the same parameter; evaluation with `awardedMarks > maxMarks`; evaluation whose criterion does not apply to the evaluated round; evaluation `status: "submitted"` without `submittedAt`; `draft → submitted` transition attempted without `submittedAt` (rejected) and with it (accepted)
  - defaults confirmed: competition `status: "draft"`, exactly two `pending` rounds, default derived scoring policy, `parameterConfigVersion: 1`; panel `isActive: true`; participant `email: null`, trimmed + uppercased `registrationId`, two eligible eligibility entries each with their own `updatedAt`; parameter `configVersion: 1`, `isActive: true`; evaluation `status: "draft"`, `submittedAt: null`
  - snapshot independence confirmed: renaming a parameter and changing its `maxMarks` in the database left the stored evaluation criteria unchanged (`"Technical Depth"`, `maxMarks: 40`)
  - population confirmed: `judge` and `participant` populate to the referenced documents
  - error messages confirmed human-readable, e.g. `Competition validation failed: rounds: rounds must not activate or close round 2 while round 1 is still pending`
  - **long-standing gaps closed by the live instance:** the `users` collection's `email_1` index was created **unique** and a duplicate email was rejected with `E11000`; `passwordHash` confirmed excluded from default queries (`select: false`); the T-06 readiness endpoint returned **200** `{"status":"ready","database":"connected",…}` against the live database and the T-04 success path (`MongoDB connected`) was exercised end to end
- **Completion date:** 2026-10-21
- **Known limitations:** no automated test suite for the model layer (P-10); the probe was a throwaway script run from the OS temp directory and is not committed; cross-document invariants (panel/participant competition scoping, judge authorization, round lifecycle transitions, closed-round rejection, participant panel transfer, configuration-version selection, transactional multi-document operations) are deliberately **not** enforced here and belong to the service layer; `weightage` has no upper bound and no normalization rule because the scoring policy is still unapproved; no revision/version history for evaluation documents (the same judge re-scores by updating the existing evaluation).

### T-13 — Centralized HTTP request validation infrastructure (P-02)

- **Implementation summary:** a single, explicit validation boundary between untrusted HTTP input and application code, built on the already-installed Zod 4.6.7 and integrated with the existing T-11 error pipeline. No new error abstraction, no new dependency, no change to the domain models, no change to `app.ts` composition.

  **Middleware contract — `server/src/middleware/validate.ts`**
  - `validate(schemas: ValidationSchemas): ValidationMiddleware<S>` is the only entry point. `ValidationSchemas` is `{ body?: ZodType; params?: ZodType; query?: ZodType }` — each request component is configured independently, and a route may validate one, two, or all three.
  - Each configured component is read from the request (`req.body`, `req.params`, `req.query`) and parsed with `schema.safeParse()`. Parsing never throws: a failure is converted into a list of issues, and the middleware then delegates to the error pipeline with `next(error)`. The downstream handler is **not** invoked.
  - On success, the **parsed output** (not the raw input) is written back onto the request via `Object.defineProperty`, so transforms and coercions performed by the schema (trim, lower-case, `z.coerce.number()`) are what the handler sees. `Object.defineProperty` is used instead of plain assignment because it works whether the property is an own property (Express 4.22's `req.query`) or an inherited accessor, and it never leaves a read-only property behind.
  - Validation order is fixed (`body` → `params` → `query`) and **all** configured components are evaluated, so a request with several problems reports all of them in one response instead of one problem per round trip. Nothing is written back when any component fails, so a rejected request never leaves partially-mutated state.
  - Schemas are plain Zod objects, so the default Zod 4 behaviour applies: unknown keys are **stripped** rather than rejected (a cheap mass-assignment guard — a request cannot smuggle `role: "admin"` into a body), and `z.strictObject` remains available per route when unknown keys must be rejected.

  **Type safety — `ValidatedRequest<S>`**
  - `validate()` is generic over the schema map, and its return type is `RequestHandler<ValidatedParams<S>, unknown, ValidatedBody<S>, ValidatedQuery<S>>`. The validated request shape therefore propagates through Express's own route generics: the handler registered after the middleware is type-checked against exactly the shape the schemas produce, with **no type assertions and no `any`**.
  - `ValidatedRequest<S>` is the matching handler-side type (`Request<ValidatedParams<S>, unknown, ValidatedBody<S>, ValidatedQuery<S>>`). Components without a schema keep Express's own defaults (`ParamsDictionary` for params, `ParsedQs` for query) and `unknown` for the body, so an unvalidated body cannot be read as if it were trusted.
  - A compile-time regression test (`@ts-expect-error` on `req.body.unknownField`) proves the narrowing is real and is checked by `tsc` on every `npm test` run.

  **Error normalization — integration, not a second abstraction**
  - Validation failures are raised as the existing `ApiError` primitive with `status: 400`, `code: ERROR_CODES.VALIDATION_ERROR`, `message: "Request validation failed"`, and `details` = the issue list. The existing global error handler therefore renders them through the established envelope — no new error class, no second response-writing path, and no change to `error-handler.ts`.
  - `details` is an **array** of `{ path, code, message }` (`ValidationIssue` in `types/api.types.ts`): `path` is the component-qualified location (`body.criteria.0.awardedMarks`, `params.id`, `query.round`), `code` is the Zod validation category (`invalid_type`, `too_small`, `invalid_format`, …), `message` is the schema-authored diagnostic. Only those three fields are exposed — no submitted value, no request body, no token.
  - Status **400** is used for request-validation failures, matching the existing T-11 convention (Mongoose `ValidationError` → 400 `VALIDATION_ERROR`). The registry also maps 422 to `VALIDATION_ERROR`, but 422 is deliberately not used so that every invalid-input failure in the API has one status.
  - Unexpected errors are untouched: a plain `Error` still produces 500 `INTERNAL_SERVER_ERROR` with the generic message and no `details`; an `ApiError` raised by application code keeps its own status/code. The validation layer never converts a programming error into a client error.

  **Shared Zod primitives — `server/src/validators/common.ts`**
  - `objectIdSchema` (24-hex MongoDB ObjectId) and `idParamsSchema` (`{ id }` route parameters), `nonEmptyString(maxLength)` (trim + non-empty + max length), `emailSchema`, `positiveNumberSchema`, `nonNegativeNumberSchema`, `roundIdentifierSchema`.
  - Reuse over duplication: `roundIdentifierSchema` is `z.literal(ROUND_IDENTIFIERS)` — it reads the round vocabulary straight from `types/domain.types.ts`; `positiveNumberSchema` / `nonNegativeNumberSchema` refine with the existing `isPositiveNumber` / `isNonNegativeNumber` predicates from `utils/validation.ts`; `emailSchema` uses Zod's `z.email()`, which is *stricter* than the models' `/^\S+@\S+\.\S+$/` check, so anything the API accepts the models accept too.
  - `utils/validation.ts` was **not** extended: it holds Mongoose validators for the model layer, while the Zod schemas are a separate concern for the HTTP layer. The two share predicates and vocabulary rather than sharing a file.
  - The model-layer enums (`COMPETITION_STATUSES`, `EVALUATION_STATUSES`, `USER_ROLES`) were deliberately **not** mirrored into Zod: they live in model modules whose import registers a Mongoose model (a side effect the pure validation layer should not trigger), and no endpoint consumes them yet. When the first business route lands, those enums will be sourced from the model modules (or promoted to `types/domain.types.ts`) rather than duplicated.

  **Canonical usage pattern for future route handlers**
  ```ts
  import { Router, type Response } from "express";
  import { z } from "zod";
  import { validate, type ValidatedRequest } from "../middleware/validate";
  import { objectIdSchema } from "../validators";

  const competitionParamsSchema = z.object({ competitionId: objectIdSchema });
  const createCompetitionSchema = z.object({
    name: z.string().trim().min(1),
  });

  const router: Router = Router();

  router.get(
    "/:competitionId",
    validate({ params: competitionParamsSchema }),
    (req: ValidatedRequest<{ params: typeof competitionParamsSchema }>, res: Response): void => {
      // req.params.competitionId is typed as string
    },
  );

  router.post(
    "/",
    validate({ body: createCompetitionSchema }),
    (req: ValidatedRequest<{ body: typeof createCompetitionSchema }>, res: Response): void => {
      // req.body is typed as { name: string }
    },
  );
  ```
  Rules that apply to every route: the schema constant is the single source of truth (the handler type is derived from it with `typeof`, never written by hand); validation is applied per route, never globally; the handler is registered *after* the middleware; a route that validates nothing simply omits `validate(...)`.

  **Test infrastructure (new)**
  - `server/test/validate.test.ts` and `server/test/app.test.ts` run on Node's built-in test runner (`node:test` + `node:assert/strict`) through the already-installed `tsx` — **no test-framework dependency was added**.
  - `server/tsconfig.test.json` extends the strict base config with `noEmit` and `include: ["src/**/*.ts", "test/**/*.ts"]`; `npm test` runs `tsc -p tsconfig.test.json` (so the tests are type-checked, not just executed) and then `tsx --test test/**/*.test.ts`. The test files live outside `src/`, so `npm run build` never emits them into `dist/`.
  - The validation suite composes its own app from the same middleware modules in the documented order (CORS → body parsers → routes → `notFoundHandler` → `errorHandler`) because `createApp()` mounts the 404 and error handlers last and therefore offers no route-injection point; the **real** `createApp()` is covered separately by the health, CORS and 404 regression tests.

- **Files created:** `server/src/middleware/validate.ts`, `server/src/validators/common.ts`, `server/src/validators/index.ts`, `server/test/validate.test.ts`, `server/test/app.test.ts`, `server/tsconfig.test.json`
- **Files modified:** `server/src/types/api.types.ts` (added the `ValidationIssue` / `ValidationIssueList` types), `server/package.json` (added the `test` script)
- **Files deliberately NOT modified:** `server/src/app.ts`, `server/src/middleware/error-handler.ts`, `server/src/middleware/cors.ts`, `server/src/middleware/not-found.ts`, `server/src/utils/api-error.ts`, `server/src/utils/validation.ts`, `server/src/types/domain.types.ts`, every file under `server/src/models/`
- **Dependencies added:** none (Zod 4.6.7 and tsx were already installed; `node:test` is part of Node 22)
- **Verification commands:**
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm run build` (`tsc -p tsconfig.json`)
  - `npm test` (`tsc -p tsconfig.test.json && tsx --test test/**/*.test.ts`)
  - live run of the built server: `PORT=3111 node dist/server.js` against the local `mongo:8` container
- **Verification results (actual):**
  - `npm run typecheck` — **clean**, exit code 0
  - `npm run build` — **clean**, exit code 0; `dist/` contains `middleware/validate.js` and `validators/*.js` and contains **no** test files
  - `npm test` — **27 passed / 0 failed** (6 suites):
    - *health endpoints* (2): liveness 200 with the unchanged T-06 payload (no `error` key); readiness 503 `not_ready` / `disconnected` in the test process
    - *cors policy* (5): configured origin allowed; loopback origin allowed outside production; disallowed origin receives **no** CORS headers; preflight 204 with `GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS` and `Content-Type,Authorization`; non-browser request served without CORS headers
    - *error contract* (1): unmatched route still 404 `NOT_FOUND` with the standard envelope
    - *request validation middleware* (16): valid input accepted **and normalized** (trim + `z.coerce`); invalid body rejected (400, two issues, paths `body.name` / `body.count`, categories `too_small` / `invalid_type`); invalid path parameter rejected (`params.id`); invalid query parameter rejected (`query.round`); multiple components validated together (all three echoed); issues from every failing component reported in one response; the documented envelope asserted (status, code, message, path without query string, ISO timestamp, `stack` only outside production); submitted values never echoed back; the downstream handler proven not to run on failure; an unexpected `Error` still yields 500 `INTERNAL_SERVER_ERROR` + `"Internal server error"` + no `details`; an application `ApiError(409)` still yields 409 `CONFLICT`; routes without validation unaffected; unknown body keys stripped; a missing body rejected; the 404 contract preserved; malformed JSON still a body-parser 400 `BAD_REQUEST` (not double-reported as a validation error)
    - *shared validation utilities* (2): the round schema accepts 1 and 2 and rejects 3 and `"1"`; the ObjectId pattern accepts a valid id and rejects a short one and a missing one
    - *handler typing* (1): the `@ts-expect-error` narrowing assertion compiles, i.e. the handler's `req.body` is genuinely narrowed
  - live server (`node dist/server.js`, port 3111, live MongoDB): `GET /api/v1/health/live` → **200** `{"status":"ok",…}`; `GET /api/v1/health/ready` → **200** `{"status":"ready","database":"connected",…}`; `GET /api/v1/nope` → **404** `NOT_FOUND`; request with `Origin: http://localhost:5173` → `Access-Control-Allow-Origin: http://localhost:5173`; startup log unchanged (`[db] MongoDB connected` → `Server listening on http://localhost:3111`), i.e. the database startup lifecycle is intact
- **Completion date:** 2026-10-21
- **Known limitations:** no business route consumes the middleware yet (by scope — P-06 will add the first ones); the T-11 and T-12 probes remain throwaway scripts, so the error-contract and model assertions are still not re-runnable from the repo (P-10); there is no coverage reporting, no CI, and no linting; the `details` shape differs by source (an issue array for request validation, a field→message record for Mongoose validation) — unifying them would change the verified T-11 contract; 4xx responses still carry a `stack` outside production (pre-existing T-11 behaviour, kept for consistency); stripped unknown keys are not reported back to the client.

### T-14 — Authentication, authorization, and administrator user provisioning (P-05)

- **Implementation summary:** Complete JWT and bcrypt authentication infrastructure. Password hashing using bcryptjs with 10 salt rounds; JWT issuance with configurable expiration (`JWT_EXPIRES_IN`, default 24h) and cryptographically enforced secret (`JWT_SECRET`, required 32+ characters in production). Typed Express authentication middleware (`authenticate`) extracting principal from `Authorization: Bearer <token>` and setting typed `req.user: AuthenticatedUser`. Role-based access control middleware (`requireRole("admin" | "judge" | "participant")`). Panel-level judge authorization guard (`requireJudgePanelAccess`). Enforces account deactivation checks on every authenticated request and login attempt (deactivated accounts return 403 Forbidden). Administrator-controlled account provisioning via `POST /api/v1/auth/users` (no public judge self-registration). Login via `POST /api/v1/auth/login`, and principal retrieval via `GET /api/v1/auth/me`.
- **Files created/modified:** `server/src/config/env.ts` (added `JWT_SECRET` and `JWT_EXPIRES_IN`), `server/.env.example`, `server/src/types/auth.types.ts` (new), `server/src/services/auth.service.ts` (new), `server/src/middleware/auth.ts` (new), `server/src/validators/auth.validators.ts` (new), `server/src/controllers/auth.controller.ts` (new), `server/src/routes/auth.routes.ts` (new), `server/src/app.ts` (mounted `/api/v1/auth`).
- **Dependencies added:** `jsonwebtoken@9.0.2`, `bcryptjs@2.4.3`, dev: `@types/jsonwebtoken@9.0.8`, `@types/bcryptjs@2.4.6`.
- **Verification commands:** `npm run typecheck`, `npm run build`, `npm test` (covered by `test/integration.test.ts`).
- **Verification results:** Pass; login, credential verification, admin provisioning, deactivated user denial, and RBAC rejection verified.
- **Completion date:** 2026-10-22

### T-15 — Functional REST API for competitions, panels, participants, parameters, evaluations, and judge portal (P-06)

- **Implementation summary:** Implemented validated, typed, consistently error-handled REST endpoints across all domain aggregates with cross-document referential integrity:
  - **Competitions (`/api/v1/competitions`):** CRUD operations, status management (`draft|active|completed|archived`), independent round lifecycle transitions with strict sequence validation (`POST /:competitionId/rounds/:round/status`).
  - **Panels (`/api/v1/competitions/:competitionId/panels`):** CRUD operations with judge verification (ensures all assigned users have role `judge` and exist in database).
  - **Participants (`/api/v1/competitions/:competitionId/participants`):** Registration with competition-scoped unique `registrationId` enforcement (409 on duplicate), filtering, panel assignment/transfers, per-round eligibility updates, and Round 2 qualification (`POST /:competitionId/participants/qualify-round-2`).
  - **Evaluation Parameters (`/api/v1/competitions/:competitionId/parameters`):** Dynamic criteria creation, activation/deactivation, round applicability, and additive versioning (scoring adjustments bump `competition.parameterConfigVersion` to safeguard historical snapshots).
  - **Evaluations (`/api/v1/evaluations`):** Draft saving (`POST /draft`) and final submission (`POST /submit`). Cross-document checks ensure: competition and round are active; judge is assigned to participant's panel; participant is eligible for round; marks do not exceed parameter max; all active round criteria are scored on submission. Enforces submission lock (409 on resubmission of finalized evaluation) and round-closure lock.
  - **Judge Portal (`/api/v1/judge`):** Endpoints for judges to retrieve assigned panels (`GET /panels`), panel participants with active round evaluation status (`GET /panels/:id/participants`), and judge's own evaluations (`GET /evaluations`).
- **Files created/modified:** `server/src/services/{competition,panel,participant,parameter,evaluation}.service.ts` (new), `server/src/controllers/{competition,panel,participant,parameter,evaluation,judge}.controller.ts` (new), `server/src/routes/{competition,panel,participant,parameter,evaluation,judge}.routes.ts` (new), `server/src/validators/{competition,panel,participant,parameter,evaluation}.validators.ts` (new), `server/src/app.ts`.
- **Dependencies added:** None.
- **Verification commands:** `npm run typecheck`, `npm run build`, `npm test`.
- **Verification results:** Clean typecheck, production build passes, 43 automated tests pass across 9 suites.
- **Completion date:** 2026-10-22

### T-16 — Deterministic scoring and ranking engine (P-07)

- **Implementation summary:** Created `server/src/services/scoring.service.ts` as a pure, deterministic, independently testable scoring module. Key features:
  - Dynamic derivation of total possible marks from applicable active criteria (never hardcoded to 100).
  - Criterion-level awarded marks calculation with support for parameter weightages and normalization against fixed totals or percentages.
  - Multi-judge aggregation using the arithmetic mean of submitted normalized scores and raw marks.
  - Tracking of evaluation completeness (submitted judge count vs panel total judge count).
  - Multi-round aggregation with configurable round weightings (e.g., 50% Round 1 + 50% Round 2).
  - Deterministic tie resolution: standard competition ranking ("1224" shared ranks for equal scores) with deterministic alphabetical fallback on registrationId for stable display order, plus optional `round2Priority` or `rawMarks` tie-break policies.
- **Files created:** `server/src/services/scoring.service.ts`, `server/test/scoring.test.ts`.
- **Dependencies added:** None.
- **Verification commands:** `npx tsx --test test/scoring.test.ts`.
- **Verification results:** All 5 unit tests pass: dynamic criteria marks derivation, weightages and scaling, judge arithmetic mean aggregation, round weighting, and ranking ties.
- **Completion date:** 2026-10-22

### T-17 — Leaderboard and progress reporting API (P-08)

- **Implementation summary:** Implemented real-time live leaderboard and administrative progress reporting services and controllers:
  - `GET /api/v1/competitions/:competitionId/leaderboard`: Overall leaderboard ranking all competition participants across rounds with rank, total normalized score, raw average marks, and per-round score breakdowns.
  - `GET /api/v1/competitions/:competitionId/leaderboard/round/:round`: Round-specific leaderboard filtered to Round 1 or Round 2.
  - `GET /api/v1/competitions/:competitionId/leaderboard/panel/:panelId`: Panel-specific leaderboard filtered to a single judge panel.
  - `GET /api/v1/competitions/:competitionId/progress`: Administrative competition progress report detailing total participants, active round, and panel-by-panel expected vs submitted evaluation metrics for Round 1 and Round 2.
- **Files created/modified:** `server/src/services/leaderboard.service.ts` (new), `server/src/controllers/leaderboard.controller.ts` (new), `server/src/routes/leaderboard.routes.ts` (new), mounted in `server/src/routes/competition.routes.ts`.
- **Dependencies added:** None.
- **Verification commands:** `npm run typecheck`, `npm run build`, `npm test`.
- **Verification results:** Verified in `test/integration.test.ts`: overall, round 1, panel 1 leaderboards, and administrative progress reports correctly calculated.
- **Completion date:** 2026-10-22

### T-18 — Automated integration and unit test suite across all layers (P-10)

- **Implementation summary:** Built a comprehensive end-to-end integration test suite (`server/test/integration.test.ts`) that runs against a live MongoDB database. Exercises complete user lifecycle: admin provisioning, judge provisioning, login, token authentication, role-based authorization, deactivated account rejection, competition creation, parameter creation and additive versioning, panel creation and judge assignment, participant registration and duplicate rejection within competition, Round 1 activation, judge portal participant retrieval, evaluation submission and validation rules, duplicate evaluation submission prevention, round closure, post-closure submission rejection, Round 2 qualification via topN, overall and round leaderboards, and administrative progress metrics.
- **Files created:** `server/test/integration.test.ts`.
- **Dependencies added:** None (uses Node built-in `node:test` and `node:assert/strict`).
- **Verification commands:** `npm test`, `npm run typecheck`, `npm run build`.
- **Verification results:** 43 tests pass across 9 suites in ~3s. Production build emits clean `dist/`.
- **Completion date:** 2026-10-22

### T-19 — Full-featured React, TypeScript, and Vite frontend portal (P-09)

- **Implementation summary:** Delivered the full-stack frontend application adhering to custom luxury design tokens (`--color-ivory`, `--color-gold`, `--color-navy`, `--font-heading: 'Cinzel'`):
  - **Auth & Session Management:** `AuthContext.tsx` with JWT persistence, automatic 401 expiration dispatch, `LoginPage.tsx` with role-based post-login redirects, `ProtectedRoute.tsx` with role checking.
  - **Navigation & Brand:** `Navbar.tsx` with active link indicators, session badge, logout trigger, and responsive Venture Craft branding; text wordmarks across the Login page, Admin Dashboard, Judge Portal, and Live Leaderboard.
  - **Admin Dashboard (`AdminDashboardPage.tsx`):** Tabbed interface for Competition creation & status management, Round progression (`pending` -> `active` -> `closed`), Panel management with judge assignment, Participant registration & editing, Parameter criteria definitions & versions, Round 2 qualification modal (Top-N, cutoff score, explicit), and real-time administrative progress reporting.
  - **Judge Evaluation Portal (`JudgePortalPage.tsx`):** Panel selector, participant list with real-time status badges (`Pending`, `Draft`, `Final`), active round detection, eligibility enforcement, dynamic criteria scoring with sliders/steppers, live raw & normalized score preview, draft saving, and permanent submission locking with confirmation modal.
  - **Live Leaderboard (`LeaderboardPage.tsx`):** Live auto-refresh polling (every 15s), Overall / Round 1 / Round 2 view tabs, Panel filter, Top-3 luxury podium showcase (Gold, Silver, Bronze), deterministic rankings ("1224" ties), participant score breakdown modal with individual judge scores, and print/export stylesheet.
- **Files created/modified:** `client/src/App.tsx`, `client/src/main.tsx`, `client/src/index.css`, `client/src/services/api.ts`, `client/src/types/api.ts`, `client/src/context/AuthContext.tsx`, `client/src/components/layout/{Navbar,ProtectedRoute}.tsx`, `client/src/pages/auth/LoginPage.tsx`, `client/src/pages/admin/AdminDashboardPage.tsx`, `client/src/pages/judge/JudgePortalPage.tsx`, `client/src/pages/leaderboard/LeaderboardPage.tsx`, `server/src/scripts/seed-admin.ts`.
- **Dependencies added:** `react@18.3.1`, `react-dom@18.3.1`, `react-router-dom@6.28.1`, dev: `vite@6.0.7`, `@vitejs/plugin-react@4.3.4`, `typescript@5.7.3`.
- **Verification commands:** `npm run build` (`tsc && vite build`) in `client/`, `npm run seed:admin` in `server/`.
- **Verification results:** Clean TypeScript check and production build in 892ms (`dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`). Admin seed script provisions initial account and exits cleanly.
- **Completion date:** 2026-10-22

### T-20 — Comprehensive repository documentation suite (P-11)

- **Implementation summary:** Authored production-grade documentation:
  - `README.md`: Executive overview, technology stack, quick start guide for backend & frontend, access control matrix, deterministic scoring highlights, test instructions, and documentation links.
  - `docs/API_REFERENCE.md`: Complete REST API reference covering error response envelopes, status codes, authentication, user provisioning, competitions, rounds, panels, participants, qualification, parameters, evaluations, judge portal, and leaderboards.
  - `docs/ARCHITECTURE.md`: Architectural layer diagrams, mathematical formulas for dynamic criteria normalization, multi-judge arithmetic mean aggregation, multi-round weighting, standard competition ranking ("1224" ties), historical snapshot immutability, compound database indexes, and state machines.
- **Files created/modified:** `README.md`, `docs/API_REFERENCE.md`, `docs/ARCHITECTURE.md`.
- **Completion date:** 2026-10-22

### T-21 — GitHub Actions CI pipeline and environment standardization (P-12)

- **Implementation summary:** Configured GitHub Actions CI pipeline running on `ubuntu-latest` with a `mongo:8` service container. Executes server dependency installation, typechecking, 43 automated integration/unit tests, and production build, followed by client dependency installation, typechecking, and production build. Populated root `.env.example` with standard defaults.
- **Files created/modified:** `.github/workflows/ci.yml`, `.env.example`.
- **Completion date:** 2026-10-22

### T-22 — MongoDB Atlas Connectivity Verification, Add Judge Defect Resolution, and Add Participant Defect Resolution

- **Implementation summary:**
  - **Atlas Connectivity Audit & Resolution:** Diagnosed MongoDB Atlas authentication failure (`bad auth: Authentication failed`) caused by URL-encoded `%3C` literal prefix in `<vermaanv01_db_user>` copied from template string and omission of the target database name in `server/.env`. Corrected `MONGODB_URI` to use clean username credentials and target the `/student_ranking` database. Confirmed Mongoose `readyState: 1`, executed administrative ping `{ ok: 1 }`, seeded initial admin (`admin@venturecraft.org`), and created automated verification script `server/src/scripts/verify-workflows.ts` (`npm run verify:atlas`).
  - **Add Judge Workflow Defect Resolution:**
    - Root cause: Network/database errors and validation failures (e.g. password < 6 characters or 409 email conflict) were logged only to main background view behind the modal backdrop, with no error state or loading state inside the modal, making the button appear completely non-responsive. Additionally, judges could not be viewed or listed.
    - Added backend `GET /api/v1/auth/judges` endpoint (`listJudgesHandler` in `auth.controller.ts`, `getJudges` in `auth.service.ts`, routed via `auth.routes.ts` with `authenticate` and `requireRole("admin")`).
    - Added `getJudges()` to frontend `api.ts`.
    - Added modal-level error alert (`judgeModalError`) and loading button state (`submittingJudge`).
    - Added client-side pre-validation (trimmed name, email format, minimum 6-character password with inline warning).
    - Added "+ Add Judge" button and full "Judges Directory" table to the "Panels & Judges" tab.
    - Enhanced "Create Evaluation Panel" modal with interactive judge selection checkboxes from directory.
  - **Add Participant Workflow Defect Resolution:**
    - Root cause: If no competition was selected or loaded, `handleCreateParticipant` executed a silent `if (!selectedCompetitionId) return;` without alerting the user. Backend validation failures were suppressed from modal view with no disabled or loading state.
    - Added validation guard displaying actionable error if no active competition is selected.
    - Added modal-level error alert (`participantModalError`) and loading button state (`submittingParticipant`).
    - Added field pre-validation (non-empty trimmed name, uppercase registrationId, email format).
    - Automatically refreshed participant table on successful creation and displayed success notification toast.
  - **Client API Error Normalization:** Enhanced `api.ts` error response handler to parse structured Zod/Mongoose `data.error.details` arrays/objects and append actionable field diagnostics directly to `err.message`.
- **Files created/modified:** `server/.env`, `server/package.json`, `server/src/services/auth.service.ts`, `server/src/controllers/auth.controller.ts`, `server/src/routes/auth.routes.ts`, `server/src/scripts/verify-workflows.ts`, `client/src/services/api.ts`, `client/src/pages/admin/AdminDashboardPage.tsx`, `README.md`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run verify:atlas` in `server/`, `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts`, `npm run typecheck` in `server/`, `npm run build` in `server/`, `npm run build` in `client/`.
- **Verification results:**
  - Atlas connectivity verified end-to-end with live database read/write and ping.
  - Judge provisioning, listing, and password authentication verified.
  - Participant registration, persistence, and duplicate registration conflict prevention (HTTP 409) verified.
  - Client and server production builds passed cleanly.
- **Completion date:** 2026-10-22

### DEF-02 — Participant Portal Defect Resolution (verified)

- **Implementation summary:**
  - **Root cause 1 (route contract mismatch):** The Participant Portal client called `/api/v1/portal/competitions`, `/api/v1/portal/profile`, `/api/v1/portal/results`, and `/api/v1/portal/team`, but the backend mounted the portal router only at `/api/v1/participant`. Registration could not load competitions, and profile, team, and results requests all returned 404.
  - **Root cause 2 (results runtime exception):** `getParticipantResults` dereferenced `evaluation.judge._id`, but `Evaluation.find` returned the `judge` field as an `ObjectId`, not a populated document. Any participant with submitted evaluations received HTTP 500 when loading results.
  - **Root cause 3 (unevaluated rounds counted as zero):** The participant results service added every configured round to the overall-score calculation, including rounds with no submitted evaluations. A participant with only Round 1 evaluated received an incorrect overall score of half of their actual score, inconsistent with the leaderboard calculation.
  - **Repair:** Mounted the portal router at the documented `/api/v1/portal` path and retained `/api/v1/participant` as a backward-compatible alias. Read the judge identifier directly from the `ObjectId`. Limited overall-score aggregation to rounds backed by submitted evaluations while still rendering pending rounds in the breakdown.
  - **State handling:** Participant Portal now surfaces results-loading failures with a retry action and displays team-update errors instead of only logging them. Leaderboard now displays backend/authentication errors with a retry action instead of silently showing an empty state.
  - **Security preserved:** Portal routes remain behind `authenticate` + `requireRole("participant", "admin")`; participant identity is resolved from the JWT user id/email, not request parameters. Submitted evaluations remain the only source for participant results, and judge identities, draft evaluations, and password hashes are not returned.
- **Files changed:** `server/src/app.ts`, `server/src/services/portal.service.ts`, `server/test/app.test.ts`, `server/test/integration.test.ts`, `client/src/pages/participant/ParticipantPortalPage.tsx`, `client/src/pages/leaderboard/LeaderboardPage.tsx`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts` (server), `npm run typecheck` (server), `npx tsc -p tsconfig.test.json` (server), `npm run build` (server), `npm run build` (client).
- **Verification results:**
  - Non-database server suite: **34 tests passed, 0 failed**.
  - Server typecheck, test typecheck, and production build passed. Client typecheck and production build passed.
  - Participant HTTP workflow verified against a model-stubbed Express harness: registration `201`, re-login `200`, profile `200`, team update `200`, results `200`, `/participant` alias `200`, leaderboard `200` with real submitted-evaluation score, and unauthenticated profile `401`.
  - Results aggregation harness verified the judge `ObjectId` fix, two-criterion breakdown, no judge-id/password-hash leakage, and an overall score of `75` derived only from the evaluated Round 1.
  - Added participant integration coverage for registration, re-login, profile, team update, results, and the route alias. The integration suite was **not executed locally** because no local MongoDB instance was available; it must not be run against Atlas.
- **Remaining defects:** None identified in the Participant Portal workflow during this phase. The earlier claim that leaderboard APIs were authenticated by design was incorrect against the documented public contract; the auth-boundary defect is corrected in T-29.
- **Completion date:** 2026-10-22

### T-24 — Dedicated Judge Login and Judge Dashboard (verified)

- **Implementation summary:**
  - Reused the existing `User` model, bcrypt password hashes, `/api/v1/auth/login` endpoint, JWT issuance/verification, `AuthContext`, and `authenticate`/`requireRole` middleware. No duplicate authentication system or password storage was introduced.
  - Added the public `/judge/login` page with Venture Craft branding, email and password fields, show/hide password control, required-field and email validation, disabled/loading submit state, invalid-credential and network-error messaging, and the existing ivory/gold/navy design palette.
  - Judge login checks the role returned by the backend after authentication. Non-judge accounts are immediately logged out and told to use the general sign-in page. Successful judges are redirected to `/judge`; `ProtectedRoute` now supports a route-specific login path and role-aware dashboard redirects to prevent loops.
  - Restricted `/judge` to the `judge` role only. Added visible Judge Login links to the public navigation and the general login page. Administrator and participant login behavior remains unchanged.
  - Enforced judge-only authorization on the backend for `/api/v1/judge/panels`, `/api/v1/judge/panels/:id/participants`, and `/api/v1/judge/evaluations` with `requireRole("judge")`. Removed the previous administrator bypass from the panel-participant handler.
  - Enhanced the existing judge portal as the initial dashboard: displays the authenticated judge's name and email, all assigned panels with competition labels, selected-panel participant count, and completed/pending evaluation counts. Existing draft, submit, eligibility, and immutable-submission workflows remain unchanged.
  - Assignment and participant responses continue to expose internal references for existing workflows while the UI displays human-readable panel, competition, participant, and registration labels. Empty and failed panel loads now show the exact unassigned message or a retryable error instead of fabricated data.
- **Files changed:** `server/src/routes/judge.routes.ts`, `server/src/controllers/judge.controller.ts`, `server/test/app.test.ts`, `server/test/integration.test.ts`, `client/src/App.tsx`, `client/src/components/layout/ProtectedRoute.tsx`, `client/src/components/layout/Navbar.tsx`, `client/src/pages/auth/LoginPage.tsx`, `client/src/pages/auth/JudgeLoginPage.tsx`, `client/src/pages/judge/JudgePortalPage.tsx`, `client/src/services/api.ts`, `client/src/types/api.ts`, `client/src/index.css`, `README.md`, `docs/API_REFERENCE.md`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts` (server), `npm run typecheck` (server), `npx tsc -p tsconfig.test.json` (server), `npm run build` (server), `npm run build` (client).
- **Verification results:**
  - Non-database server suite: **35 tests passed, 0 failed**.
  - Server typecheck, test typecheck, and production build passed. Client typecheck and production build passed.
  - Model-stubbed judge HTTP harness verified: unauthenticated judge API `401`; judge panel access `200`; administrator and participant judge API access `403`; assigned judge participant access `200`; unassigned judge access `403`; judge evaluations access `200`; readable panel/competition/participant labels returned.
  - Integration coverage now asserts administrators are rejected from judge-only endpoints. The full integration suite was **not executed locally** because no MongoDB instance was reachable at `127.0.0.1:27017`; it must not be run against Atlas.
- **Remaining defects:** None identified in the dedicated judge login/dashboard scope during this phase.
- **Completion date:** 2026-10-22

### T-26 - Judge Evaluation Workflow, Authorization Hardening, and Integrity Safeguards (verified)

- **Implementation summary:**
  - Connected the existing judge dashboard/workflow to the evaluation system without duplicating the scoring engine or redesigning unrelated pages. Judges can view assigned participants per panel, select a participant in an active round, view applicable criteria and maximum marks, adjust scores within range, save drafts, and finalize/submit evaluations via the existing `/evaluations/draft` and `/evaluations/submit` APIs.
  - Enforced backend authorization end-to-end: judge evaluation endpoints require authenticated judge/admin roles; `saveEvaluation` continues to verify panel assignment, panel/competition/participant membership, active round/competition state, eligibility, and immutable submitted evaluations. `GET /evaluations/:id` now requires authentication and role checks, allows administrators to read any evaluation, restricts judges to their own evaluations, and rejects participants/unauthorized roles. Client-supplied judge/participant/panel IDs are never trusted for authorization decisions.
  - Preserved scoring and leaderboard integrity: reused existing configurable criteria, snapshot immutability, dynamic/weighted scoring, arithmetic-mean aggregation, and leaderboard logic; no hardcoded total of 100; incomplete evaluations are not incorrectly counted in aggregation.
  - Added non-database routing coverage for evaluation auth and expanded model-stubbed/integration-style coverage for participant rejection, negative marks, draft→submit locking, cross-judge read denial, owner/admin reads, and participant read denial.
- **Files changed:** `server/src/services/evaluation.service.ts`, `server/src/controllers/evaluation.controller.ts`, `server/src/routes/evaluation.routes.ts`, `server/test/integration.test.ts`, `server/test/app.test.ts`, `docs/API_REFERENCE.md`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run typecheck` (server), `npx tsc -p tsconfig.test.json` (server), `npx tsx --test test/app.test.ts test/panel-assignment.test.ts test/scoring.test.ts test/validate.test.ts` (server), `npm run build` (server), `npm run typecheck` (client), `npm run build` (client).
- **Verification results:**
  - Non-database server suite: **52 tests passed, 0 failed**.
  - Server typecheck, test typecheck, and production build passed. Client typecheck and production build passed.
  - Coverage added/updated: assigned judge can submit valid evaluations; unassigned/wrong-panel judge rejected (403); participants cannot submit/save judge evaluations (403); marks below zero rejected (400); duplicate/post-submission edits locked (409); evaluation read restricted by ownership/role (403 for cross-judge and participants, allowed for owner and admin).
  - The full database integration suite was **not executed locally** because no MongoDB instance was reachable at `127.0.0.1:27017`; it must not be run against Atlas.
- **Remaining defects:** None identified in the judge evaluation workflow scope within the verified environment. Database-backed integration behavior remains unverified locally.
- **Completion date:** 2026-10-22

---

### T-27 - Email Notifications: Participant Confirmation and Judge Activation (verified)

- **Implementation summary:**
  - Added a reusable email delivery layer (`server/src/services/email.service.ts`) using `nodemailer` with a lazily-created SMTP transporter, a bounded retry wrapper (`sendEmailWithRetry`, attempts = `EMAIL_DELIVERY_RETRIES + 1`, linear backoff), and no secret/password logging.
  - Added `server/src/services/notification.service.ts` with participant registration confirmation, judge activation token creation (invalidates prior unused tokens), judge activation email (link `${APP_PUBLIC_URL}/judge/activate?token=...`), and `activateJudgeAccount` enforcing hashed single-use, expiring tokens and bcrypt password rehashing.
  - Added `server/src/models/activation-token.model.ts` (`ActivationToken`) with a unique `tokenHash`, `expiresAt` TTL index, `usedAt` single-use marker, and crypto-based token generation/hashing helpers.
  - Wired notifications into existing flows without altering auth, evaluation, or panel-management behavior: `registerParticipant` sends a registration confirmation; `provisionUser` sends a judge activation email after account creation. Delivery failures are caught and logged (never thrown), so persistence always succeeds.
  - Added the public `POST /api/v1/auth/judge/activate` endpoint (validator, controller, route) reusing the existing auth middleware stack and error handling. Email delivery is entirely optional; when SMTP is unconfigured the flows still succeed.
- **Files changed:** `server/src/models/activation-token.model.ts`, `server/src/services/email.service.ts`, `server/src/services/notification.service.ts`, `server/src/config/env.ts`, `server/src/services/auth.service.ts`, `server/src/controllers/auth.controller.ts`, `server/src/routes/auth.routes.ts`, `server/src/validators/auth.validators.ts`, `server/package.json`, `.env.example`, `server/test/app.test.ts`, `server/test/integration.test.ts`, `README.md`, `docs/API_REFERENCE.md`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run typecheck` (server), `npx tsc -p tsconfig.test.json` (server), `npm test` (server), `npm run build` (server), `npm run build` (client).
- **Verification results:**
  - Non-database server suite: **53 tests passed, 0 failed** (20 database-dependent tests cancelled because MongoDB is unavailable locally).
  - Server typecheck, test typecheck, and production build passed. Client typecheck and production build passed.
  - Coverage added: registration confirmation invoked on successful participant registration; registration still succeeds when email delivery throws; judge provisioning triggers activation notification; invalid token rejected (400); reused token rejected (400); password hashed (not stored plaintext) and login works after activation. Email provider is mocked in tests; no real emails are sent.
  - The full database integration suite was **not executed locally** because no MongoDB instance was reachable at `127.0.0.1:27017`; it must not be run against Atlas.
- **Remaining defects:** None identified in the notification scope within the verified environment. Database-backed integration behavior remains unverified locally.
- **Completion date:** 2026-10-22

### T-28 - Venture Craft Rebrand and Logo Removal (verified)

- **Implementation summary:**
  - Replaced all user-facing legacy brand references with `Venture Craft` across the client shell, navigation, login/registration screens, admin/judge/participant dashboards, leaderboard, printable scorecard, outgoing email subjects and bodies, API/architecture documentation, README, and this progress journal.
  - Removed the legacy peacock logo assets from `client/public/assets/` and `client/src/assets/`, deleted the legacy logo component, removed the favicon reference and browser-tab legacy brand title from `client/index.html`, and replaced remaining logo UI with plain text wordmarks.
  - Updated default seed administrator credentials and notification/test fixtures to the `venturecraft.org` domain. Internal browser storage keys and auth-expiry event names were intentionally preserved to avoid unnecessary internal identifier changes.
  - No routes, API contracts, database schemas, scoring calculations, evaluations, or leaderboard logic were modified. The untracked local `server/.env` was left untouched so its existing JWT secret and database credentials remain intact.
- **Files changed:** `.env.example`, `.github/workflows/ci.yml`, `README.md`, `PROJECT_PROGRESS.md`, `client/index.html`, `client/src/components/layout/{Navbar,ProtectedRoute}.tsx`, `client/src/pages/auth/{LoginPage,RegisterPage,JudgeLoginPage}.tsx`, `client/src/pages/admin/AdminDashboardPage.tsx`, `client/src/pages/judge/JudgePortalPage.tsx`, `client/src/pages/leaderboard/LeaderboardPage.tsx`, `client/src/pages/participant/ParticipantPortalPage.tsx`, `docs/API_REFERENCE.md`, `docs/ARCHITECTURE.md`, `server/src/config/env.ts`, `server/src/scripts/{seed-admin,verify-workflows}.ts`, `server/src/services/{email.service,notification.service}.ts`, `server/test/integration.test.ts`. Removed: the two legacy logo PNG assets and the legacy logo component.
- **Verification commands:** `npm run build` (client), `npm run typecheck` (server), `npm run build` (server), `npx tsc -p tsconfig.test.json` (server), `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts test/panel-assignment.test.ts` (server non-database suite).
- **Verification results:** Client TypeScript check and production build passed. Server typecheck, test typecheck, and production build passed. Non-database suite: **53 tests passed, 0 failed**. Database-backed integration tests were not run, per the no-destructive-database constraint.
- **Remaining references:** Only internal browser storage/auth-event identifiers and the untracked local `server/.env` JWT secret retain the legacy token. No user-facing, documentation, or logo references remain.
- **Completion date:** 2026-10-23

### T-29 - Public Live Leaderboard Authentication Boundary (verified)

- **Symptom:** Anonymous visitors opening the public `/leaderboard` page saw `Leaderboard unavailable. Authorization header is required.` and no standings.
- **Intended contract:** `docs/API_REFERENCE.md` explicitly documents all three leaderboard GET routes as public with no authentication required. `README.md` describes the leaderboard as live audience engagement projected in the auditorium, and `client/src/App.tsx` registers `/leaderboard` as a public route and as the fallback route.
- **Root cause 1 (backend auth boundary):** `server/src/routes/competition.routes.ts` applied `router.use(authenticate)` to the entire competition router before mounting the nested leaderboard router, so the public leaderboard routes inherited authentication. `server/src/routes/leaderboard.routes.ts` also applied its own `router.use(authenticate)`.
- **Root cause 2 (frontend data source):** `LeaderboardPage` loaded the competition selector from the authenticated `GET /api/v1/competitions` endpoint, so the first request failed for anonymous visitors before any leaderboard request was attempted. It also attempted to load panels when no token was present.
- **Repair:** Mounted `/:competitionId/leaderboard` before the competition router's authentication guard, removed the redundant leaderboard-router guard, switched the page to the existing public `GET /api/v1/portal/competitions` endpoint, and skipped panel-filter loading for anonymous visitors. All other competition, panel, participant, parameter, evaluation, judge, and admin routes remain authenticated.
- **Public scope:** Only read-only leaderboard GETs are public. Leaderboard responses aggregate submitted evaluations and expose no judge credentials, password hashes, drafts, or admin progress data.
- **Files changed:** `server/src/routes/competition.routes.ts`, `server/src/routes/leaderboard.routes.ts`, `client/src/pages/leaderboard/LeaderboardPage.tsx`, `server/test/app.test.ts`, `server/test/integration.test.ts`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run typecheck` (server), `npm run build` (server), `npx tsc -p tsconfig.test.json` (server), `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts test/panel-assignment.test.ts` (server non-database suite), `npm run build` (client).
- **Verification results:**
  - Non-database server suite: **55 tests passed, 0 failed**.
  - New routing regression tests prove the three leaderboard routes pass the authentication boundary and fail validation with `400 VALIDATION_ERROR` rather than `401 UNAUTHORIZED`, while `GET /competitions`, `GET /competitions/:id`, `GET /competitions/:id/panels`, and `POST /competitions` remain `401` without a token.
  - Added integration assertions that all three leaderboard variants return `200` without an `Authorization` header. The database-backed integration suite was **not executed locally**, per the no-destructive-database constraint.
  - Server typecheck, test typecheck, and production build passed. Client typecheck and production build passed.
- **Remaining defects:** None identified in the leaderboard authentication boundary. The public panel selector remains hidden for anonymous visitors because panel listings contain judge identities and are intentionally still authenticated; overall and round leaderboards work without login.
- **Completion date:** 2026-10-23

### T-30 - Leaderboard Merge Conflict Resolution (verified)

- **Symptom:** Vite failed to compile `client/src/pages/leaderboard/LeaderboardPage.tsx` with `Unexpected token (2:1)`.
- **Root cause:** An incomplete synchronization left one unresolved conflict in the import block:
  - The upstream conflict section contained no import.
  - The stashed conflict section contained `import { useAuth } from "../../context/AuthContext";`.
  - The rest of the file already contained the T-29 public leaderboard implementation (`useAuth`, `token`, `PublicCompetition`, `getPublicCompetitions`, and anonymous panel-loading suppression), so the stashed import was required for the merged component to compile and function.
- **Resolution:** Removed the three conflict markers and retained the `useAuth` import. No other conflict hunks were present. The public leaderboard authorization fix, anonymous visitor support, competition selector, leaderboard views, panel filtering for authenticated users, auto-refresh, search, details modal, and print/export behavior were preserved.
- **Additional conflict search:** `git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- client server` found no remaining tracked conflict markers. A recursive scan of `client/src`, `client/public`, `server/src`, and `server/test` found none. `git diff --check` is clean.
- **Files changed:** `client/src/pages/leaderboard/LeaderboardPage.tsx`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run build` (client), `npm run typecheck` (server), `npx tsc -p tsconfig.test.json` (server), `npm run build` (server), `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts test/panel-assignment.test.ts` (server non-database suite).
- **Verification results:**
  - Client TypeScript check and Vite production build passed (43 modules transformed).
  - Server typecheck, test typecheck, and production build passed.
  - Non-database server suite: **55 tests passed, 0 failed**.
  - The database-backed integration suite was **not executed locally**, per the no-destructive-database constraint.
- **Additional conflicts discovered:** None.
- **Completion date:** 2026-10-23

### T-31 - Judge Portal Null Competition Crash (verified)

- **Symptom:** Opening `/judge` crashed the page with `Cannot read properties of null (reading 'name')` at `client/src/pages/judge/JudgePortalPage.tsx:26:20`.
- **Root cause:** `JudgeAssignedPanel.competition` was typed as either a populated competition object or a string, but the judge panels endpoint populates `competition` and can produce `null` when a panel holds a dangling competition reference. `getCompetitionName` dereferenced `competition.name` without checking for `null`.
- **Repair:** Widened `JudgeAssignedPanel.competition` to include `null` and made `getCompetitionName` return the existing `"Assigned competition"` fallback when the reference is missing, unpopulated, or has an empty name.
- **Preserved behavior:** Panel switching, participant loading and selection, criteria rendering, score calculation, draft saving, final submission, immutable submitted evaluations, and the loading, empty, retryable error, and no-active-round states are unchanged. No backend route, database schema, or scoring logic was modified.
- **Files changed:** `client/src/types/api.ts`, `client/src/pages/judge/JudgePortalPage.tsx`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run build` (client), `npm run typecheck` (server), `npm run build` (server), `npx tsc -p tsconfig.test.json` (server), `npx tsx --test test/app.test.ts test/scoring.test.ts test/validate.test.ts test/panel-assignment.test.ts` (server non-database suite).
- **Verification results:**
  - Client TypeScript check and Vite production build passed (43 modules transformed).
  - Server typecheck, test typecheck, and production build passed.
  - Non-database server suite: **55 tests passed, 0 failed**.
  - The database-backed integration suite was **not executed locally**, per the no-destructive-database constraint.
- **Known limitation:** A panel whose competition reference is actually missing still cannot load its participant details, because the backend correctly returns `404 Competition not found`. The portal now renders the assignment without crashing instead of masking that server-side data-integrity condition.
- **Follow-up:** Browser-level verification in T-32 found a second, independent null reference that still blanked the portal after this repair.
- **Completion date:** 2026-10-23

### T-32 - Judge Portal Orphaned Evaluation Blank Screen (verified)

- **Symptom:** After T-31, `/judge` still rendered a completely blank page: the root element was present but empty, with no visible error state.
- **Diagnosis:** Loaded the running Vite app in headless Chrome through the DevTools Protocol using a real active judge session and captured runtime exceptions. The console showed `TypeError: Cannot read properties of null (reading '_id')` inside the `myEvaluations.find(...)` callbacks. A direct authenticated call to `GET /api/v1/judge/evaluations` returned `200` with two evaluations whose `participant` field was `null`.
- **Root cause:** `Evaluation.participant` was typed as a non-null populated object, but the judge evaluations response can contain orphaned evaluations whose participant document no longer exists. Both the score-prefill lookup and the `existingEvaluation` lookup dereferenced `participant._id` without checking for `null`, so React crashed during render and unmounted the entire application tree. The `competition`, `panel`, and `judge` fields also did not match the populated or raw reference shapes returned by the API.
- **Repair:** Widened the `Evaluation` reference fields to their real populated-object, string, or `null` shapes. Added an `isEvaluationForParticipant` guard that safely handles missing, populated, and raw-ID participant references, and used it in both evaluation lookups. Orphaned evaluations are now ignored by the portal instead of crashing it.
- **Preserved behavior:** Assigned-panel listing, panel switching, participant loading and selection, criteria and eligibility rendering, score calculations, draft saving, final submission, immutable submitted evaluations, progress counts, and loading, empty, retryable-error, and no-active-round states are unchanged. No backend route, database record, schema, or scoring rule was modified.
- **Files changed:** `client/src/types/api.ts`, `client/src/pages/judge/JudgePortalPage.tsx`, `PROJECT_PROGRESS.md`.
- **Verification commands:** `npm run build` (client); headless Chrome DevTools Protocol runtime check of `http://localhost:5173/judge` against the running Vite client and authenticated API session; server typecheck, test typecheck, production build, and non-database suite rerun after the change.
- **Verification results:**
  - Client TypeScript check and Vite production build passed (43 modules transformed).
  - Headless browser verification rendered the complete Judge Portal with 1 assigned panel, 2 participants, active Round 1, 3 criteria, and the draft/submit controls. No runtime exceptions were emitted.
  - Server typecheck, test typecheck, and production build passed; non-database suite: **55 tests passed, 0 failed**.
  - The database-backed integration suite was **not executed locally**, per the no-destructive-database constraint.
- **Known limitation:** The orphaned evaluation records remain in the database because they reference participants that no longer exist. The portal safely ignores them; cleaning or migrating those records remains a separate data-maintenance task.
- **Completion date:** 2026-10-23

_None. All tracked project milestones are complete._

---

## E. Pending Tasks (implementation roadmap, ordered)

| ID | Task | Prerequisites | Status |
|----|------|---------------|--------|
| P-09 | Frontend implementation (React + TS + Vite; auth, admin, judge, leaderboard pages) | P-06, P-08 | **Completed (T-19)** |
| P-11 | Documentation: README content, `docs/` API reference, architecture specs | parallel | **Completed (T-20)** |
| P-12 | CI tooling & GitHub Actions workflow | parallel | **Completed (T-21)** |
| DEF-01 | MongoDB Atlas verification, Add Judge & Add Participant defect resolutions | T-19, T-20 | **Completed (T-22)** |
| DEF-02 | Participant Portal route, results, and error-state defect resolution | T-19, T-22 | **Completed** |
| T-24 | Dedicated Judge Login page and judge-only dashboard | T-19, T-22 | **Completed** |
| T-25 | Readable judge/panel selectors, panel editing, and assignment integrity | T-19, T-22 | **Completed** |
| T-26 | Judge evaluation workflow, authorization hardening, and integrity safeguards | T-19, T-22, T-24 | **Completed** |
| T-27 | Email notifications: participant confirmation and judge activation | T-03, T-19, T-22 | **Completed** |
| T-28 | Venture Craft rebrand and logo removal | T-19, T-20 | **Completed** |
| T-29 | Public live leaderboard authentication boundary | T-19, T-28 | **Completed** |
| T-30 | Leaderboard merge conflict resolution | T-29 | **Completed** |
| T-31 | Judge Portal null competition crash | T-24, T-29 | **Completed** |
| T-32 | Judge Portal orphaned evaluation blank screen | T-24, T-31 | **Completed** |

Tracked tasks: 32 completed (T-01…T-22, T-24…T-32) + 0 pending = 32 – **100% complete**.

---

## F. Technical Decisions

Recorded only from decisions made in this project's implementation sessions.

- **Language/module config:** TypeScript strict mode with additional flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`); compiled target ES2022, CommonJS output, `rootDir: src` → `outDir: dist`.
- **Runtime tooling:** `tsx` for dev (watch mode), `tsc` for production build, `node dist/server.js` for start; `tsc --noEmit` as the type-check gate.
- **Dependency versions (installed):** `express@4.21.2`, `dotenv@16.4.7`, `zod@4.6.7`, `mongoose@9.11.2`, `cors@2.8.6` (+ `@types/cors@2.8.19` dev), `jsonwebtoken@9.0.2` (+ `@types/jsonwebtoken@9.0.8` dev), `bcryptjs@2.4.3` (+ `@types/bcryptjs@2.4.6` dev), `typescript@5.7.3`, `tsx@4.19.2`.
- **Configuration:** single centralized module `config/env.ts`; validated with Zod; exports an immutable frozen `env` object; **only `env.ts` may read `process.env`**; no hardcoded credentials or connection strings anywhere. Added `JWT_SECRET` (validated 32+ characters in production) and `JWT_EXPIRES_IN`.
- **Authentication & RBAC:** Stateless JWT bearer tokens signed with HMAC SHA-256. Passwords hashed with bcryptjs (10 salt rounds). Role-based authorization (`admin`, `judge`, `participant`). Active state verified on every request (deactivated users rejected immediately). Public judge registration disabled; accounts provisioned by administrators.
- **Identity isolation:** Judge identity is derived strictly from verified JWT claims (`req.user.id`). Request-body judge IDs are never accepted for evaluation submission or draft saving.
- **Panel-level authorization:** Judges can only view panels they are assigned to, and can only score participants assigned to their panels. Cross-panel evaluations are rejected with 403 Forbidden.
- **Evaluation immutability & historical snapshotting:** Historical evaluation criteria are frozen at submission time in `criteria[]` subdocuments containing `parameterName`, `maxMarks`, `weightage`, `applicableRounds`, and `awardedMarks`. Updating a parameter in the competition does not recalculate existing evaluations.
- **Evaluation submission lock:** Once an evaluation is submitted (`status: "submitted"`), duplicate submissions or edits are rejected with 409 Conflict. Post-round-closure submissions are rejected with 400 Bad Request.
- **Scoring & Leaderboard Engine:** Pure, deterministic scoring service. Dynamic total marks derivation (no hardcoded 100). Arithmetic mean across panel judges. Multi-round weighting (default 50/50, configurable). Standard competition ranking ("1224" shared rank for ties) with deterministic alphabetical fallback on registrationId.
- **Application vs startup separation:** `app.ts` exports a side-effect-free `createApp()`; `server.ts` owns process lifecycle (connect → listen → shutdown).
- **Database startup policy:** initial MongoDB connection must succeed before the HTTP listener starts; failure ⇒ non-zero exit. No import-time connection side effects.
- **Connection management:** Mongoose default connection; idempotent `connectDatabase()` (cached promise); no custom connection pool; no deprecated driver options; state read via `mongoose.connection.readyState`.
- **Graceful shutdown:** SIGINT/SIGTERM → stop accepting connections → close HTTP server → `mongoose.disconnect()` → exit; guarded against duplicate execution; failures exit non-zero.
- **API conventions:** versioned JSON API prefix `/api/v1`; feature-grouped routers in `server/src/routes/`, mounted in `app.ts`; health contract as specified in T-06 (lowercase `status`, ISO-8601 `timestamp`).
- **CORS policy (T-10):** single policy module `middleware/cors.ts`; allowlist = `env.CLIENT_ORIGIN` + non-production loopback origins; explicit methods/headers lists; `credentials: false`; disallowed origins get no CORS headers; mounted first in `createApp()`; CORS is a browser policy only, never an auth mechanism.
- **User model (T-09):** roles exported as `USER_ROLES` const array (`admin`, `judge`, `participant`); `passwordHash` uses `select: false` (retrievable explicitly for auth); email uniqueness via schema `unique: true`; duplicate model registration guarded with `models.User ?? model(...)`.
- **Error contract (T-11):** all failures return `{ "error": { status, code, message, path, timestamp, details?, stack? } }`; the `error` key nests errors so they can never be mistaken for a success payload; `code` is a stable machine-readable string from the `ERROR_CODES` registry; `path` never includes the query string; `timestamp` is ISO-8601.
- **Testing:** Node's built-in test runner (`node:test`) executed through `tsx`; `npm test` = `tsc -p tsconfig.test.json && tsx --test test/**/*.test.ts`. 43 tests pass across 9 test suites covering health, CORS, error contract, request validation, scoring/ranking unit tests, and live MongoDB integration tests.
- **Evaluation uniqueness (T-12):** the unique index on `{competition, participant, round, judge}` covers drafts as well as submitted evaluations — a judge re-scores by updating the existing document, never by creating a second one. `draft → submitted` is the only implemented transition; there is no revision history.
- **Validation plumbing (T-12):** value-only rules use `schema.path(...).validate(fn, "message")`; cross-field rules use a typed `pre("validate")` hook and `this.invalidate(path, message)`. Both produce ordinary Mongoose `ValidationError`s, so they render through the existing T-11 error envelope with no extra mapping code. Mongoose 9 has no `SchemaOptions.validate` and no `Schema.prototype.validate`.
- **Request validation boundary (T-13):** one middleware, `validate({ body?, params?, query? })` in `server/src/middleware/validate.ts`, applied **per route** (never globally) and always registered *before* the handler. It is the only sanctioned way for untrusted input to enter the application layer.
- **Validation mechanism (T-13):** Zod 4 `safeParse` only — the middleware never lets a Zod exception escape. All configured components are evaluated (fixed order body → params → query) and every failure is reported in one response; nothing is written back when any component fails.
- **Write-back semantics (T-13):** the **parsed output** replaces the raw value on `req.body` / `req.params` / `req.query` (via `Object.defineProperty`), so schema transforms and coercions are what the handler sees. The raw request is not preserved anywhere.
- **Type propagation (T-13):** `validate()` is generic over the schema map and returns `RequestHandler<ValidatedParams<S>, unknown, ValidatedBody<S>, ValidatedQuery<S>>`, so the validated shape flows through Express's own route generics. Handlers declare `ValidatedRequest<S>` with `typeof <schema constant>`; there are **no type assertions and no `any`** in the validation layer. Unvalidated components keep Express's defaults (`ParamsDictionary`, `ParsedQs`) and the body becomes `unknown`.
- **Unknown keys (T-13):** Zod 4's default `z.object` behaviour is used — unknown keys are stripped, not rejected. This is the mass-assignment guard; `z.strictObject` is available per route when unknown keys must be an error.
- **Validation errors (T-13):** raised as the existing `ApiError` (400, `VALIDATION_ERROR`, `"Request validation failed"`) with `details` = `ValidationIssue[]` (`path` component-qualified, `code` = Zod category, `message` = schema-authored). Request-validation failures use 400, matching the existing Mongoose-validation convention, so every invalid-input failure in the API has one status.
- **Error-detail shape (T-13):** `details` is polymorphic — an issue array for request validation, a field→message record for Mongoose validation. The two were deliberately not unified because that would change the verified T-11 contract; `ErrorPayload.details` therefore stays `unknown` and consumers narrow it.
- **Validation primitives (T-13):** Zod schemas live in `server/src/validators/`, Mongoose validators stay in `server/src/utils/validation.ts`. The two layers share the domain vocabulary (`ROUND_IDENTIFIERS`) and the numeric predicates (`isPositiveNumber`, `isNonNegativeNumber`) instead of duplicating them. Model-layer enums are not mirrored into Zod (see the model-typing decision).
- **Testing (T-13):** Node's built-in test runner (`node:test`) executed through the installed `tsx`; `npm test` = `tsc -p tsconfig.test.json && tsx --test test/**/*.test.ts`. Tests live in `server/test/` (outside `src/`) so they are type-checked but never emitted into `dist/`. No test-framework dependency and no coverage tooling were added.
- **Scoring rules:** none defined or approved yet. (No scoring/ranking rules have been specified; do not assume any.)

---

## G. Known Issues and Limitations

1. ~~**No MongoDB instance available in the development environment**~~ — **resolved on 2026-10-21:** Docker Desktop was started and a `mongo:8` container (`srs-mongo`, port `27017`) is now running, which allowed the T-12 model verification, the T-09 unique-email index verification, the T-04 success path and the T-06 readiness HTTP 200 path to be exercised for real. The container is a *local development* dependency, not a project artifact — it is not configured in the repo and any other developer must provide their own MongoDB (or start the same container) to re-run the verification.
2. **Startup/health tension:** `server.ts` aborts startup when the DB is unreachable, so under normal bootstrap the readiness endpoint cannot be reached during a total outage. Readiness 503 was verified via a direct `createApp()` harness (no DB connect) and readiness 200 was verified against the live database. A decision is needed on whether readiness should be observable during DB outage (would require decoupling listener startup from DB connect).
3. ~~**`CLIENT_ORIGIN` is validated but unused**~~ — **resolved by T-10** (CORS middleware now consumes it). Remaining gap: only a single production origin is supported.
4. **`.gitignore` line 1 ignores `.env.example`** — pre-existing rule, deliberately preserved; example env files are therefore not tracked in git.
5. **Working tree is clean apart from this document** — `main` is at `9f9e25e` ("added backend"), on top of `5ef00bc`, `3a27191`, `e1a8fef`, `5aa738a` and `22ed1f7`. The T-11 error contract, the T-12 models **and** the T-13 validation infrastructure are all **committed**; the only outstanding change is `PROJECT_PROGRESS.md` itself. The T-12 validator corrections (replacing the definition-level `validate:` options with typed `schema.path(...).validate(fn, "message")` calls and the `pre("validate")` hook) are included in that history. They are behaviour-preserving in intent but **do change the validation messages** and they fix a silent bug: the Mongoose `validate: [fn1, fn2]` array form had registered only `fn1`, so `validateRoundProgression` was never running — the final version registers both, and the live probe now confirms the "round 2 active while round 1 pending" case is rejected.
6. **Automated test coverage is partial; no linter and no CI** — **improved by T-13:** a committed, runnable test suite now exists (`server/test/`, `npm test`, 27 assertions covering the validation contract, the health endpoints, the CORS policy and the 404 envelope) and the tests are type-checked before they run. Remaining gaps: the T-11 error-contract probe (19 assertions) and the T-12 live-MongoDB model probe (62 assertions) are still throwaway scripts run from the OS temp directory and are **not** re-runnable from the repo, so the model layer and the service layer have no committed tests; there is no coverage reporting, no linter and no CI (P-10, P-12).
7. **`client/` is entirely placeholder** — empty `package.json`/`tsconfig.json`/`vite.config.ts`/`App.tsx`/`main.tsx`; no dependencies installed; not verified in any way.
8. **Empty `README.md` and `docs/`** — no developer onboarding or API documentation. The new error envelope and the domain model are not yet documented there (P-11).
9. ~~**No error-handling middleware**~~ — **resolved by T-11** (global error handler + 404 handler + consistent error envelope). Remaining gap: the contract is not covered by automated tests (P-10) and is not yet written up in `docs/` (P-11).
10. ~~**User email unique index unverified at the database level**~~ — **resolved by T-12:** with a live MongoDB, `users.email_1` was created as a unique index and a duplicate email was rejected by the server with `E11000`; `passwordHash` was confirmed absent from default query results.
11. **Mongoose/Mongo error mapping is duck-typed** — duplicate-key detection relies on `code === 11000` and validation/cast detection on `instanceof mongoose.Error.*`. A driver-level error class check would be stricter, but the current approach was verified to work with the installed `mongoose@9.11.2` (and, in T-12, to actually receive `E11000` from the server).
12. **Request body size limit is implicit** — body-parser's default 100 KB applies; it is not yet configurable through `env.ts`. Exceeding it now returns a well-formed 413 `PAYLOAD_TOO_LARGE`, but the limit cannot be tuned per environment.
13. **`weightage` semantics are undefined** — `EvaluationParameter.weightage` is validated as a finite non-negative number with **no upper bound and no normalization rule**, because no scoring policy has been approved. If weights are later defined as percentages, a sum-to-100 rule will have to be added (and it cannot be enforced by a single-document validator — it needs a competition-scoped check in the service layer).
14. **`scoringPolicy` is metadata only** — `totalSource`, `fixedTotal` and the three strategy blocks are stored and validated for internal consistency, but no strategy is implemented and no total is derived. The `fixedTotal` may be any positive number (it is not constrained to 100).
15. **Cross-document invariants are not enforced** — nothing guarantees that a panel's `competition` matches the competition of the participant that references it, that a panel's judges have the `judge` role, that a judge is assigned to the panel they submit for, that the evaluated round is open, or that the criteria snapshots match the competition's `parameterConfigVersion`. All of these need the service layer (P-06), and the multi-document ones will need transactions.
16. **No evaluation revision history** — a judge who re-scores overwrites the existing evaluation (the unique index forbids a second document for the same judge/participant/round). If per-revision auditability is required, a separate revision collection will be needed.
17. **Parameter supersession is not modelled** — `EvaluationParameter.configVersion` versions a parameter, but nothing links a version to the one it supersedes and there is no "current version" query contract; that belongs to the service layer.
18. **`models/index.ts` barrel is unused so far** — it exists for a single import surface, but no service or controller imports it yet (the model layer is not consumed by any route).
19. **The validation middleware has no route consumer yet** — P-02 is infrastructure only; the first business route arrives with P-06. Until then the middleware is exercised by the test suite alone, so nothing mechanically prevents a future route from forgetting `validate(...)`.
20. **`createApp()` offers no route-injection point** — the 404 and error handlers are mounted last, so a test cannot add routes to the real application. The validation suite therefore composes its own app from the same middleware modules in the documented order, while the real `createApp()` is covered by the separate health/CORS/404 tests. A later refactor could introduce a `createApp({ routers })` seam and remove the duplication.
21. **Validation failures carry a stack outside production** — the pre-existing T-11 contract emits `stack` for 4xx as well as 5xx when `NODE_ENV !== "production"`. It is consistent with the rest of the API but noisy for a 400 caused by a malformed request body.
22. **Stripped unknown keys are not reported** — a client that sends `role` or another unknown field gets no feedback; the field is silently removed. Schemas that need to tell the client must use `z.strictObject` instead of the default `z.object`.
23. **The API email rule is stricter than the model rule** — `z.email()` rejects input the models' `/^\S+@\S+\.\S+$/` would accept. That direction is safe (the HTTP layer is the stricter gate), but the two rules are not literally identical and the model rule is not expressed as a Zod schema.
24. **Validation schemas are not documented in `docs/`** — the canonical usage pattern currently exists only in this document (sections F and the T-13 entry); P-11 must carry it into the repository documentation together with the error contract.

---

## H. Project Delivery & Next Recommended Actions

**All 21 Planned Roadmap Milestones (P-01 through P-12) Completed (100%)**

- *Status:* Both the backend API server and the React + Vite frontend client are fully operational, strictly typed, and verified via automated integration suites.
- *Recommended Next Actions for Operations / Production Deployment:*
  1. **Production Seeding:** Run a database seed script to initialize the first primary administrator user (e.g. `POST /api/v1/auth/users`).
  2. **Production Hosting:**
     - Deploy backend container or Node.js service (e.g., Docker, Render, AWS ECS, Fly.io).
     - Deploy static frontend client bundle from `client/dist/` (e.g., Vercel, Netlify, Cloudflare Pages, AWS S3/CloudFront).
     - Set production environment variables (`JWT_SECRET` >= 32 characters, `NODE_ENV=production`, `MONGODB_URI`, `CLIENT_ORIGIN`).
  3. **Event Day Operation:** Administrators provision judge accounts, establish judging panels, set round parameters, and project the Live Leaderboard (`/leaderboard`) on competition auditorium display screens with 15-second live polling.

---

*This document is maintained by the assistant during coding sessions; it is not automatically synchronized. Update it in the same session as code changes.*
- - -  
 # #   I .   S t u d e n t   L o g i n   F l o w   I m p l e m e n t a t i o n   ( 2 0 2 6 - 1 0 - 2 4 )  
  
 # # #   I m p l e m e n t e d   C h a n g e s  
 -   C l i e n t :   A d d e d   S t u d e n t L o g i n P a g e . t s x   ( / s t u d e n t / l o g i n ) ,   r o u t e   i n   A p p . t s x ,   S t u d e n t   L o g i n   l i n k s   i n   N a v b a r   a n d   R e g i s t e r P a g e . t s x .   U s e s   A u t h C o n t e x t . l o g i n ( ) ,   e n f o r c e s   p a r t i c i p a n t   r o l e ,   r e d i r e c t s   t o   / p a r t i c i p a n t .  
 -   S e r v e r :   R e u s e d   e x i s t i n g   a u t h   A P I s   ( n o   d u p l i c a t e   a u t h ) .   P r o t e c t e d   r o u t e s   u n c h a n g e d .  
 -   T e s t s :   A d d e d   s e r v e r / t e s t / s t u d e n t - l o g i n . t e s t . t s .  
  
 # # #   V e r i f i c a t i o n  
 -   C l i e n t :   n p x   t s c   - - n o E m i t   p a s s e d ,   n p m   r u n   b u i l d   p a s s e d .  
 -   S e r v e r :   n p m   r u n   t y p e c h e c k   p a s s e d ,   n p m   r u n   b u i l d   p a s s e d .  
 -   N o n - D B   t e s t s   p a s s e d ;   D B - b a c k e d   t e s t s   r e q u i r e   l o c a l   M o n g o D B .  
  
 # # #   C o n s t r a i n t s  
 -   M i n i m a l   c h a n g e s ,   n o   d u p l i c a t e   a u t h   s y s t e m s ,   n o   u n r e l a t e d   r e d e s i g n ,   n o   d a t a b a s e - d e s t r u c t i v e   o p e r a t i o n s ,   n o   c o m m i t .  
 

---

## Task 1: Automatic Student Registration ID (Implemented)
- Added server-side registration ID generation utility; IDs persisted and unique per competition.
- Auto-generated on student registration/admin creation; legacy accounts get ID on first lookup without creating duplicates.
- Manual ID input removed/optional in student registration and admin participant creation UIs.
- Added tests in server/test/registration-id.test.ts for generation, persistence/repeated logins, legacy accounts, and uniqueness.
- Verification: server typecheck and build passed.

## Task 2: Automatic Git Commits on Windows (Implemented)
- Added PowerShell watcher tools/git-auto-commit/watcher.ps1 with 10s debounce, recursive watch, git add -A respecting .gitignore, timestamped commits, no auto-push.
- Excludes node_modules/, dist/, build/, .git/, .env* except .env.example, credentials/secrets (*.pem, *.key, credentials.json, secrets.json); never stages secrets, fails safely.
- Added start/stop scripts and docs; updated root .gitignore and README.md.
- Verification: watcher structure and rules validated.



## Criteria Priorities for Leaderboard Tie-Breaking (Implemented)
- Added priority field to EvaluationParameter model/schema and validations; unique per competition when set.
- Admin UI: assign/reorder priorities (1 = highest), displayed in criteria table.
- Ranking: sorts by total score desc; ties broken by criteria in priority order (highest priority first), comparing percentage/awarded marks; retains existing tie handling if still tied. Applied server-side to all leaderboard endpoints and qualification ranking.
- Missing/incomplete evaluations handled without treating as zero by default.
- Added tests for total score, priority tie-break, successive priorities, complete ties, missing evaluations.
- Verification: server/client typecheck and builds passed; relevant tests pass.

