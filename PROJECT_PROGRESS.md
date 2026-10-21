# PROJECT_PROGRESS.md

Canonical progress document for the Student Evaluation, Ranking & Live Leaderboard System.
Updated incrementally during each coding session in which project changes are made.

Last updated: 2026-10-21

---

## A. Project Overview

- **Project name:** Student Evaluation, Ranking & Live Leaderboard System
- **Technology stack:**
  - Frontend: React + TypeScript + Vite + Tailwind CSS (scaffold placeholders only; not started)
  - Backend: Node.js + Express + TypeScript
  - Database: MongoDB + Mongoose
- **Current development phase:** Backend domain layer (domain modeling and persistence — models complete, request/response layer next)
- **Overall completion status:** 12 of 21 tracked tasks completed = **57%** (calculated from explicitly tracked tasks in sections C and E; does not include untracked polish work)

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
│   │   │   └── not-found.ts     # Unmatched-route handler (delegates to the error handler)
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
│   │   ├── controllers/  services/  validators/   # empty placeholders
│   │   ├── app.ts           # createApp(): Express composition, no side effects
│   │   └── server.ts        # entry point: DB connect → listen → graceful shutdown
│   ├── .env.example         # placeholder env values
│   ├── package.json         # scripts: dev / build / start / typecheck
│   ├── package-lock.json
│   └── tsconfig.json        # strict TypeScript config
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
- `client/` — not yet implemented (placeholder files only).

Section updated: 2026-10-21 (added `server/src/middleware/error-handler.ts`, `server/src/middleware/not-found.ts`, `server/src/utils/api-error.ts`, `server/src/types/api.types.ts`; extended again the same day with `server/src/models/{index,competition,panel,participant,evaluation-parameter,evaluation}.model.ts`, `server/src/types/domain.types.ts`, `server/src/utils/validation.ts`).

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

---

## D. In-Progress Tasks

_None. No task is currently started but unfinished._

---

## E. Pending Tasks (implementation roadmap, ordered)

| ID | Task | Prerequisites |
|----|------|---------------|
| P-02 | Request validation layer (Zod schemas in `server/src/validators/`) | T-03 |
| P-05 | Authentication/authorization (roles: admin, judge) | P-01, P-03 |
| P-06 | Evaluation/submission REST API under `/api/v1` (controllers + routes) | P-01, P-02, P-05 |
| P-07 | Ranking/scoring engine — **scoring rules not yet approved; must be specified before implementation** | P-01, P-06 |
| P-08 | Live leaderboard API and real-time updates (delivery mechanism — polling vs Socket.IO — **not yet decided**) | P-07 |
| P-09 | Frontend implementation (React + TS + Vite + Tailwind; auth, admin, judge, leaderboard pages) | P-06, P-08 |
| P-10 | Automated tests (unit/integration) + test script | P-01…P-08 |
| P-11 | Documentation: README content, `docs/` API reference | parallel |
| P-12 | CI/lint tooling (ESLint/Prettier) — none configured | parallel |

Tracked tasks: 12 completed (T-01…T-12, including P-04 delivered as T-10, P-03 delivered as T-11 and P-01 delivered as T-12) + 9 pending = 21 → **57% complete**.

---

## F. Technical Decisions

Recorded only from decisions made in this project's implementation sessions.

- **Language/module config:** TypeScript strict mode with additional flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`); compiled target ES2022, CommonJS output, `rootDir: src` → `outDir: dist`.
- **Runtime tooling:** `tsx` for dev (watch mode), `tsc` for production build, `node dist/server.js` for start; `tsc --noEmit` as the type-check gate.
- **Dependency versions (installed):** `express@4.21.2`, `dotenv@16.4.7`, `zod@4.6.7`, `mongoose@9.11.2`, `cors@2.8.6` (+ `@types/cors@2.8.19` dev), `typescript@5.7.3`, `tsx@4.19.2`.
- **Configuration:** single centralized module `config/env.ts`; validated with Zod; exports an immutable frozen `env` object; **only `env.ts` may read `process.env`**; no hardcoded credentials or connection strings anywhere.
- **Application vs startup separation:** `app.ts` exports a side-effect-free `createApp()`; `server.ts` owns process lifecycle (connect → listen → shutdown).
- **Database startup policy:** initial MongoDB connection must succeed before the HTTP listener starts; failure ⇒ non-zero exit. No import-time connection side effects.
- **Connection management:** Mongoose default connection; idempotent `connectDatabase()` (cached promise); no custom connection pool; no deprecated driver options; state read via `mongoose.connection.readyState`.
- **Graceful shutdown:** SIGINT/SIGTERM → stop accepting connections → close HTTP server → `mongoose.disconnect()` → exit; guarded against duplicate execution; failures exit non-zero.
- **API conventions:** versioned JSON API prefix `/api/v1`; feature-grouped routers in `server/src/routes/`, mounted in `app.ts`; health contract as specified in T-06 (lowercase `status`, ISO-8601 `timestamp`).
- **CORS policy (T-10):** single policy module `middleware/cors.ts`; allowlist = `env.CLIENT_ORIGIN` + non-production loopback origins; explicit methods/headers lists; `credentials: false`; disallowed origins get no CORS headers; mounted first in `createApp()`; CORS is a browser policy only, never an auth mechanism.
- **User model (T-09):** roles exported as `USER_ROLES` const array (`admin`, `judge`, `participant`); `passwordHash` uses `select: false` (retrievable explicitly for future auth); email uniqueness via schema `unique: true`; duplicate model registration guarded with `models.User ?? model(...)` for `tsx watch` reloads; no hashing logic in the model.
- **Error contract (T-11):** all failures return `{ "error": { status, code, message, path, timestamp, details?, stack? } }`; the `error` key nests errors so they can never be mistaken for a success payload; `code` is a stable machine-readable string from the `ERROR_CODES` registry; `path` never includes the query string; `timestamp` is ISO-8601 (consistent with the health contract).
- **Error raising (T-11):** application code raises HTTP errors exclusively via `ApiError` (`utils/api-error.ts`); the error handler maps untyped errors (body-parser, Mongoose, Mongo) into the same envelope so no route can bypass the contract.
- **Information disclosure (T-11):** 5xx responses always use the fixed message `"Internal server error"` and never carry `details`; `stack` is emitted only when `NODE_ENV !== "production"`; 4xx messages are author-written or fixed generic strings. Server-side logs keep the full error (5xx via `console.error` with the original error object).
- **Middleware order (T-11):** CORS → body parsers → feature routers → `notFoundHandler` → `errorHandler` (must be last); the 404 handler delegates to the error handler via `next(err)` so there is exactly one response-writing path.
- **Model typing strategy (T-12):** explicit domain interface + `SchemaDefinition<Raw>` object checked with `satisfies` + `new Schema<Raw>(def, { timestamps: true })`. `Schema<Raw>` alone does not check a definition against its interface; `InferSchemaType` is not used for the new models because in Mongoose 9 it widens numeric enums to `number`, infers `Mixed` as `any` and makes defaulted fields optional. `user.model.ts` keeps its original `InferSchemaType` style and is not modified.
- **Model naming and references (T-12):** every aggregate lives in `server/src/models/<name>.model.ts` and is exported as a named model with the `models.X ?? model<X>("X", …)` guard; `models/index.ts` is the single import surface. Cross-model `ref` strings are checked at compile time with `satisfies ModelName`.
- **Round identifiers (T-12):** the domain has exactly two rounds, expressed once as `ROUND_IDENTIFIERS = [1, 2] as const` and used as a literal union (`RoundIdentifier`) in every round-bearing field. The value is not configurable.
- **Round lifecycle (T-12):** the model layer never advances a round. `rounds[].status` is validated for internal consistency (exactly two rounds, unique ids, `closedAt >= startedAt`, round 2 not ahead of round 1) but transitions are a service-layer concern.
- **Scoring policy (T-12):** `Competition.scoringPolicy` stores *metadata only* — `totalSource` (`fixed|derived`), `fixedTotal` and three free-form strategy blocks. No totals, weights, ranking rules or leaderboard behaviour are implemented, because no scoring rules have been approved (see the "Scoring rules" entry below).
- **Configuration versioning (T-12):** `EvaluationParameter.configVersion` versions a parameter; `Competition.parameterConfigVersion` versions the whole parameter set; each `Evaluation.criteria[]` entry freezes the parameter's `configVersion`, name, `maxMarks`, `weightage` and `applicableRounds` at evaluation time so historical scores are immutable. Versioning is per-parameter and additive — there is no `supersededBy` pointer and no global "current version" query contract yet.
- **Eligibility (T-12):** participant eligibility is stored explicitly per round (not derived from panel membership or scores) so "who may be judged in round N" is answerable without joins; an ineligible round must state a reason.
- **Evaluation uniqueness (T-12):** the unique index on `{competition, participant, round, judge}` covers drafts as well as submitted evaluations — a judge re-scores by updating the existing document, never by creating a second one. `draft → submitted` is the only implemented transition; there is no revision history.
- **Validation plumbing (T-12):** value-only rules use `schema.path(...).validate(fn, "message")`; cross-field rules use a typed `pre("validate")` hook and `this.invalidate(path, message)`. Both produce ordinary Mongoose `ValidationError`s, so they render through the existing T-11 error envelope with no extra mapping code. Mongoose 9 has no `SchemaOptions.validate` and no `Schema.prototype.validate`.
- **Scoring rules:** none defined or approved yet. (No scoring/ranking rules have been specified; do not assume any.)

---

## G. Known Issues and Limitations

1. ~~**No MongoDB instance available in the development environment**~~ — **resolved on 2026-10-21:** Docker Desktop was started and a `mongo:8` container (`srs-mongo`, port `27017`) is now running, which allowed the T-12 model verification, the T-09 unique-email index verification, the T-04 success path and the T-06 readiness HTTP 200 path to be exercised for real. The container is a *local development* dependency, not a project artifact — it is not configured in the repo and any other developer must provide their own MongoDB (or start the same container) to re-run the verification.
2. **Startup/health tension:** `server.ts` aborts startup when the DB is unreachable, so under normal bootstrap the readiness endpoint cannot be reached during a total outage. Readiness 503 was verified via a direct `createApp()` harness (no DB connect) and readiness 200 was verified against the live database. A decision is needed on whether readiness should be observable during DB outage (would require decoupling listener startup from DB connect).
3. ~~**`CLIENT_ORIGIN` is validated but unused**~~ — **resolved by T-10** (CORS middleware now consumes it). Remaining gap: only a single production origin is supported.
4. **`.gitignore` line 1 ignores `.env.example`** — pre-existing rule, deliberately preserved; example env files are therefore not tracked in git.
5. **Working tree is dirty** — `main` is at `e1a8fef` ("added backend"), on top of `5aa738a`, `22ed1f7`, `d7f4ecc` and `eac75a8` ("backend intialize"). The T-11 error contract and the first iteration of the T-12 models are already **committed**; the **uncommitted** changes are the T-12 validator corrections: modified `server/src/models/competition.model.ts`, `server/src/models/panel.model.ts`, `server/src/models/participant.model.ts`, `server/src/models/evaluation-parameter.model.ts`, `server/src/models/evaluation.model.ts` (replacing the definition-level `validate:` options with typed `schema.path(...).validate(fn, "message")` calls and the `pre("validate")` hook) plus `PROJECT_PROGRESS.md`. The corrections are behaviour-preserving in intent but **do change the validation messages** and they fix a silent bug: the Mongoose `validate: [fn1, fn2]` array form had registered only `fn1`, so `validateRoundProgression` was never running — the final version registers both, and the live probe now confirms the "round 2 active while round 1 pending" case is rejected.
6. **No automated tests, linter, or CI** — verification is manual (`typecheck`, `build`, ad-hoc runtime probes). The T-11 and T-12 probes were throwaway scripts run from the OS temp directory and were not committed, so the 19 error-contract assertions and the 62 model assertions are **not** re-runnable from the repo (P-10).
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

---

## H. Next Recommended Task

**P-02 — Request validation layer (Zod schemas in `server/src/validators/`)**

- *Why next:* it is the last remaining prerequisite shared by P-05 and P-06. `zod@4.6.7` is already installed and `config/env.ts` already establishes the Zod pattern, so request-body/query validation can reuse the same idioms as the env schema. It also closes the loop opened by T-11: validator failures should be converted into `ApiError(400, …, { code: "VALIDATION_ERROR", details })` so they render through the same error envelope as every other failure.
- *Also worth doing in the same session:* wire a shared `validate` middleware helper into `server/src/middleware/` that takes a Zod schema and the request part to parse, and normalizes `ZodError` into the `details` shape already used by the Mongoose `ValidationError` mapping (per-field messages), so clients see one validation shape regardless of the source.
- *Alternative:* P-05 (authentication/authorization) if the data layer is to be exercised end to end soon — the model layer now exists but nothing consumes it yet, so P-06 would otherwise have no way to read or write the domain aggregates.
- *Prerequisites:* T-03 (done), T-11 (done — gives the error contract the validator will throw into), T-12 (done — the schemas the validator mirrors now exist).
- *Verification for the next step:* `npm run typecheck`, `npm run build`, runtime probe (valid body → passes through; invalid body → 400 `VALIDATION_ERROR` with per-field `details` and the standard envelope; malformed JSON → still 400 `BAD_REQUEST` from body-parser, not double-reported); update this document in the same session.

---

*This document is maintained by the assistant during coding sessions; it is not automatically synchronized. Update it in the same session as code changes.*
