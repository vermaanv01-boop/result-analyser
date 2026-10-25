# Venture Craft — Student Evaluation, Ranking & Live Leaderboard System



<p align="center">

  <strong>Present &bull; Connect &bull; Lead</strong><br />

  A deterministic, multi-judge evaluation and real-time leaderboard platform engineered for collegiate hackathons, academic symposiums, and multi-round student competitions.

</p>



---



## 1. Project Overview



**Venture Craft** is an enterprise-grade competition scoring, participant management, and live leaderboard platform built on a modern TypeScript stack (Node.js, Express, MongoDB, Mongoose, React 18, and Vite).



In conventional collegiate hackathons and academic conferences, scoring is typically coordinated via fragmented, error-prone spreadsheets that suffer from formula corruption, lack of evaluation immutability, and vulnerability to accidental data overwrites. Venture Craft replaces manual coordination with a verifiable, multi-judge consensus scoring engine that guarantees:

- **Fairness & Consistency:** Criteria-based evaluation with dynamic derivation and multi-judge arithmetic mean aggregation.

- **Data Immutability:** Historical parameter snapshots freeze at evaluation time, guaranteeing that subsequent parameter adjustments never tamper with past scores.

- **Submission Integrity:** A hard lock-in mechanism prevents post-deadline resubmissions or modifications.

- **Deterministic Standings:** Standard competition ranking ("1224" shared ranks for ties) with stable tie-break resolution.

- **Live Audience Engagement:** Real-time leaderboard with 15-second polling, podium showcases, round breakdowns, and print-ready export views.



### Intended Users

1. **Competition Administrators:** Event organizers managing competition lifecycles, criteria versions, judge panels, participant cohorts, and round promotions.

2. **Judges & Evaluators:** Domain experts assigned to judging panels who score participants against dynamic criteria via a distraction-free evaluation portal.

3. **Participants & Public Audiences:** Students, faculty, and live auditorium spectators tracking live standings and performance breakdowns.



---



## 2. Features



Every feature listed below is fully implemented, strictly typed, and covered by automated tests in this repository:



### Role-Based Access Control & Authentication

- **Secure Authentication:** Stateless JSON Web Tokens (JWT) signed with HMAC SHA-256 and salted bcrypt password hashing (10 salt rounds).

- **Three Distinct Roles:** `admin`, `judge`, and `participant`.

- **Active State Verification:** Account deactivation checks execute on every authenticated request and login attempt; deactivated users are immediately blocked with HTTP 403 Forbidden.

- **Admin-Controlled Provisioning:** Public judge registration is disabled to prevent unvetted evaluators; judges are securely provisioned by administrators via `POST /api/v1/auth/users`.

- **Dedicated Judge Access:** Judges use `/judge/login` and a judge-only `/judge` dashboard; administrator and participant accounts are rejected from judge-only pages and APIs.



### Competition & Round Lifecycle Management

- **Competition Aggregates:** Creation, description, status lifecycle (`draft` &rarr; `active` &rarr; `completed` &rarr; `archived`), and scoring policies.

- **Two-Round Sequential Engine:** Independent transitions for Round 1 and Round 2 (`pending` &rarr; `active` &rarr; `closed`).

- **Sequential Invariant Protection:** Round 2 cannot be activated or closed while Round 1 is still pending.



### Panel & Participant Management

- **Competition-Scoped Panels:** Grouping of verified judges into distinct evaluation panels (e.g., Track-specific panels).

- **Readable Judge Assignment:** Administrators search and select active judges by name or email instead of pasting MongoDB ObjectIds; selected judges appear as removable chips, and existing panels can be edited.

- **Participant Registration:** Unique `registrationId` enforced per competition (e.g., `KAR-2026-001`), supporting ID reuse across distinct competitions.

- **Panel Assignment & Transfers:** Dynamically assign or transfer participants between judging panels using readable panel selectors; inactive panels cannot receive new assignments.

- **Round Eligibility Tracking:** Granular per-round eligibility records (`eligible: boolean`, `ineligibleReason: string`).

- **Round 2 Qualification Workflows:** Automated qualification of Round 1 cohorts via **Top-$N$ ranking**, **minimum cutoff score**, or **explicit ID selection**.



### Dynamic Criteria & Snapshot Versioning

- **Configurable Evaluation Parameters:** Criteria defined with dynamic `maxMarks` (positive number), `weightage` (non-negative multiplier), `guidelines`, and `applicableRounds` (`[1]`, `[2]`, or `[1, 2]`).

- **No Hardcoded 100 Ceiling:** System derives maximum marks dynamically from the sum of active round parameters.

- **Additive Parameter Versioning:** Edits to criteria bump `competition.parameterConfigVersion`. Historical evaluations store frozen criteria snapshots (`parameterName`, `maxMarks`, `weightage`, `awardedMarks`), preserving past scores against retroactive modifications.



### Judge Evaluation Portal

- **Scoping Guard:** Judges can only view panels they are assigned to and can only evaluate participants belonging to their assigned panels.

- **Interactive Scoring Workspace:** Step-by-step slider and numeric inputs enforcing $0 \le \text{awardedMarks} \le \text{maxMarks}$.

- **Work-in-Progress Drafts:** Judges can save draft scores and resume evaluation at any time without locking.

- **Permanent Submission Locking:** Finalizing an evaluation transitions status to `submitted` with a `submittedAt` timestamp. Resubmissions or edits return HTTP 409 Conflict.

- **Round-Closure Lock:** Evaluation submissions targeting closed rounds are rejected with HTTP 400 Bad Request.



### Live Leaderboard & Reporting

- **Multi-Judge Consensus:** Aggregates submitted judge scores using the arithmetic mean of normalized and raw marks.

- **Multi-Round Weighting:** Configurable round weightings (default 50% Round 1 + 50% Round 2).

- **Standard Competition Ranking ("1224" Tie Resolution):** Tied scores share ranks and leave gaps for subsequent ranks (e.g., 1st, 2nd, 2nd, 4th).

- **Live Auto-Refresh:** 15-second background polling with visual pulse indicator.

- **Interactive Podium:** Visual 1st (Gold), 2nd (Silver), and 3rd (Bronze) podium display.

- **Filter Views:** Toggle between **Overall Standings**, **Round 1**, **Round 2**, or filter by individual **Panel**.

- **Score Breakdown Modal:** Click any participant row to inspect individual judge evaluations and round completeness.

- **Print & Export Layout:** Clean `@media print` formatting for official PDF export or printing.



### Participant Portal & Self-Registration

- **Participant Self-Registration:** Students and teams self-register (`POST /api/v1/auth/register-participant` or `/register` UI) by selecting an active competition, setting registration ID, email, credentials, and teammates.

- **Dedicated Participant Dashboard:** Direct access (`/participant`) displaying enrolled competition status, assigned evaluation panel, room allocations, and round qualification statuses.

- **Dynamic Team Management:** Participants can view and modify their active team roster inline (`PATCH /api/v1/portal/team`).

- **Granular Criteria Breakdown:** Real-time visibility into per-criterion marks, weights, and percentage attainment across evaluated rounds once released.

- **Print-Ready Official Scorecard:** Built-in certificate and official evaluation scorecard layout ready for physical printing or PDF generation (`window.print()`).



---



## 3. Technology Stack



### Backend

- **Runtime:** Node.js (v20+ recommended, ES2022 target)

- **Framework:** Express.js (v4.21.2)

- **Language:** TypeScript (v5.7.3, strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)

- **Database ODM:** Mongoose (v9.11.2)

- **Input Validation:** Zod (v4.6.7)

- **Authentication & Cryptography:** `jsonwebtoken` (v9.0.2), `bcryptjs` (v2.4.3 / v3.0.3)

- **CORS:** `cors` (v2.8.6)

- **Runtime Execution:** `tsx` (v4.19.2)



### Frontend

- **Framework & Bundler:** React (v18.3.1), Vite (v6.0.7)

- **Language:** TypeScript (v5.7.3)

- **Routing:** React Router DOM (v6.28.1)

- **Styling:** Custom Luxury Design Tokens (Vanilla CSS with Google Fonts: *Cinzel* & *Plus Jakarta Sans*)



### Database & Testing

- **Database:** MongoDB 8.0+

- **Test Runner:** Node.js native test runner (`node:test`) + `node:assert/strict` via `tsx`

- **Continuous Integration:** GitHub Actions (`.github/workflows/ci.yml`)



---



## 4. Project Structure



```

student-ranking-system/

├── .github/

│   └── workflows/

│       └── ci.yml               # GitHub Actions CI pipeline (Node 20 + MongoDB 8)

├── client/                      # Frontend SPA (React 18 + TypeScript + Vite)

│   ├── src/

│   │   ├── components/

│   │   │   └── layout/          # Layout wrappers (Navbar.tsx, ProtectedRoute.tsx)

│   │   ├── context/             # React Context (AuthContext.tsx)

│   │   ├── pages/

│   │   │   ├── admin/           # AdminDashboardPage.tsx (CRUD & progress reporting)

│   │   │   ├── auth/            # LoginPage.tsx, JudgeLoginPage.tsx, RegisterPage.tsx

│   │   │   ├── judge/           # JudgePortalPage.tsx (Criteria sliders & draft/submit)

│   │   │   └── leaderboard/     # LeaderboardPage.tsx (Live standings, podium, print)

│   │   ├── services/            # Typed HTTP client (api.ts)

│   │   ├── types/               # Frontend API types (api.ts)

│   │   ├── App.tsx              # Application route tree

│   │   ├── index.css            # Luxury design tokens, components & print styles

│   │   └── main.tsx             # DOM mounting entrypoint

│   ├── index.html               # HTML entry with font preconnects & page title

│   ├── package.json             # Client scripts and dependencies

│   ├── tsconfig.json            # Client TypeScript configuration

│   └── vite.config.ts           # Vite server & proxy configuration (/api -> :3000)

├── server/                      # Backend API (Express + TypeScript + Mongoose)

│   ├── src/

│   │   ├── config/              # Centralized environment (env.ts) & MongoDB connection (database.ts)

│   │   ├── controllers/         # HTTP request handlers (auth, competition, panel, etc.)

│   │   ├── middleware/          # auth, cors, validate, not-found, error-handler

│   │   ├── models/              # Mongoose schemas (User, Competition, Panel, Participant, Parameter, Evaluation)

│   │   ├── routes/              # Express routers mounted at /api/v1/*

│   │   ├── scripts/             # seed-admin.ts (Initial administrator user generator)

│   │   ├── services/            # Business logic & pure scoring engine (scoring.service.ts)

│   │   ├── types/               # Shared domain vocabularies & API error response contracts

│   │   ├── utils/               # ApiError class, ERROR_CODES registry, validation helpers

│   │   ├── validators/          # Zod HTTP schemas (common, auth, competition, evaluation, etc.)

│   │   ├── app.ts               # Side-effect-free Express application composition

│   │   └── server.ts            # Process bootstrap, DB connection & graceful shutdown

│   ├── test/                    # Automated integration & unit tests (app, validate, scoring, integration)

│   ├── .env.example             # Server environment template

│   ├── package.json             # Server scripts and dependencies

│   ├── tsconfig.json            # Production server TypeScript config

│   └── tsconfig.test.json       # Test runner TypeScript config

├── docs/                        # Technical documentation

│   ├── API_REFERENCE.md         # Complete REST API endpoint reference

│   └── ARCHITECTURE.md          # Scoring mathematics, data schemas & state transitions

├── .env.example                 # Root environment template

├── .gitignore                   # Excludes node_modules/, dist/, .env

├── PROJECT_PROGRESS.md          # Comprehensive chronological development journal

└── README.md                    # This document

```



---



## 5. Prerequisites



Before running the application, ensure the following software is installed on your workstation:



- **Node.js:** `v20.x` or later (Active LTS recommended). Verify with `node -v`.

- **npm:** `v10.x` or later. Verify with `npm -v`.

- **MongoDB:** `v8.x` or `v7.x` running locally on port `27017` or accessible via MongoDB Atlas URI.

- **Git:** Verify with `git --version`.

- **Operating System:** Windows, macOS, or Linux.



---



## 6. Installation



Clone the repository and install dependencies for both the backend and frontend:



```bash

# 1. Clone repository

git clone https://github.com/vermaanv01-boop/result-analyser.git

cd result-analyser



# 2. Install backend dependencies

cd server

npm install



# 3. Install frontend dependencies

cd ../client

npm install



# Return to project root

cd ..

```



---



## 7. Environment Configuration



All environment configuration is strictly validated at application startup using **Zod** in [`server/src/config/env.ts`](file:///c:/Users/Lenovo/OneDrive/Desktop/Student-ranking-system/server/src/config/env.ts).



Create a `.env` file inside the `server/` directory:



```bash

# In server directory:

cp .env.example .env

```



### Server Variables Specification



| Variable | Required | Default (Non-Prod) | Description | Example Value |

|---|---|---|---|---|

| `PORT` | No | `3000` | Port for the HTTP server to listen on | `3000` |

| `NODE_ENV` | No | `development` | Environment mode (`development`, `test`, `production`) | `development` |

| `MONGODB_URI` | **Yes (Prod)** | `mongodb://localhost:27017/student_ranking` | MongoDB connection URI with database name | `mongodb://127.0.0.1:27017/student_ranking_system` |

| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin for CORS policy | `http://localhost:5173` |

| `JWT_SECRET` | **Yes (Prod)** | Internal dev string | Secret key for signing JWTs. **Must be $\ge$ 32 characters in production.** | `development_super_secret_jwt_key_venturecraft_2026_min32chars` |

| `JWT_EXPIRES_IN` | No | `24h` | JWT validity duration (e.g., `24h`, `7d`, `3600s`) | `24h` |



### Optional Email / Notification Variables



Email delivery is optional. When SMTP is not configured, the server still persists users and logs a non-fatal delivery warning.



| Variable | Default | Description |

|---|---|---|

| `SMTP_HOST` | _(unset)_ | SMTP server host; email is skipped when empty |

| `SMTP_PORT` | `587` | SMTP server port |

| `SMTP_SECURE` | `false` | Use TLS on connect (set `true` for port 465) |

| `SMTP_USER` | _(unset)_ | SMTP auth username |

| `SMTP_PASS` | _(unset)_ | SMTP auth password (never logged) |

| `SMTP_FROM` | `no-reply@venturecraft.org` | From address on outgoing mail |

| `EMAIL_DELIVERY_RETRIES` | `2` | Additional retry attempts on delivery failure |

| `EMAIL_DELIVERY_RETRY_DELAY_MS` | `250` | Linear backoff base delay between retries |

| `APP_PUBLIC_URL` | `http://localhost:5173` | Base URL used to build judge activation links |

| `JUDGE_ACTIVATION_TOKEN_TTL_HOURS` | `24` | Judge activation token lifetime in hours |



> Notification flows: participants receive a registration confirmation on `POST /auth/register-participant`; judges provisioned by an admin receive an account-activation link that completes setup via `POST /auth/judge/activate`. Activation tokens are single-use, hashed at rest, and expire.



### Optional Admin Seeding Variables (Used by `npm run seed:admin`)



| Variable | Default | Description |

|---|---|---|

| `ADMIN_EMAIL` | `admin@venturecraft.org` | Initial administrator login email |

| `ADMIN_PASSWORD` | `Admin@VentureCraft2026!` | Initial administrator login password |

| `ADMIN_NAME` | `Venture Craft Administrator` | Initial administrator display name |



> [!CAUTION]

> Never commit `.env` files containing real production passwords, connection strings, or JWT secrets to Git. `.env` is ignored by `.gitignore`.



---



## 8. Database Setup



The backend utilizes MongoDB with Mongoose.



### Option A: Local MongoDB via Docker (Recommended)

If you have Docker Desktop installed, start a container with:

```bash

docker run -d --name srs-mongo -p 27017:27017 mongo:8

```



### Option B: Local Native MongoDB Community Server

Ensure your local `mongod` service is started on `mongodb://127.0.0.1:27017`.



### Option C: MongoDB Atlas Cloud

Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas):

1. **Network Access:** In Atlas Security &rarr; Network Access, add your current IP address (or `0.0.0.0/0` to allow all IP addresses for testing/deployment).

2. **Database User:** In Database Access, create a database user (e.g., `venturecraft_admin`) with `readWrite` role on the `student_ranking` database.

3. **Connection String:** Copy the `mongodb+srv://` connection string and specify the database name `/student_ranking`.

4. Configure in `server/.env`:

```env

MONGODB_URI=mongodb+srv://venturecraft_admin:your_secure_password@cluster0.example.mongodb.net/student_ranking?retryWrites=true&w=majority

```



> [!WARNING]

> **Avoid Common Atlas URI Pitfalls:**

> - Remove literal angle brackets: Do not leave `<` or `>` or `%3C` in `<username>` or `<password>` from template strings.

> - URL-encode special characters in passwords (e.g. `@` &rarr; `%40`, `#` &rarr; `%23`, `:` &rarr; `%3A`).

> - Ensure the target database name is explicitly specified (e.g. `/student_ranking`), otherwise queries will default to the `test` database.



### Verify Database Connectivity

Verify that your backend can connect to Atlas and perform read/write operations:

```bash

cd server

npm run verify:atlas

```

This script validates connectivity, tests admin authentication, tests judge provisioning, tests participant registration, verifies conflict prevention, and cleans up temporary test records non-destructively.



### Automatic Index Creation

No manual database migrations or schema scripts are required. Mongoose automatically builds all required compound unique indexes on bootstrap:

- `users`: `{ email: 1 }` (unique)

- `participants`: `{ competition: 1, registrationId: 1 }` (unique)

- `evaluations`: `{ competition: 1, participant: 1, round: 1, judge: 1 }` (unique)

- `panels`: `{ competition: 1, name: 1 }` (unique)



---



## 9. How to Run Locally



Start the backend and frontend in two separate terminal windows:



### Terminal 1: Backend Server



```bash

cd server



# Development mode (starts with live TypeScript watch reload)

npm run dev



# Alternative for Windows PowerShell if script execution is restricted:

# cmd.exe /c "npm run dev"

```



**Expected Startup Output:**

```

[db] MongoDB connected (mongodb://127.0.0.1/student_ranking_system)

Server listening on http://localhost:3000

```



Verify backend health in your browser or terminal:

- **Liveness:** `http://localhost:3000/api/v1/health/live` &rarr; `{"status":"ok"}`

- **Readiness:** `http://localhost:3000/api/v1/health/ready` &rarr; `{"status":"ready","database":"connected"}`



---



### Terminal 2: Frontend Client



```bash

cd client



# Start Vite development server

npm run dev



# Alternative for Windows PowerShell if script execution is restricted:

# cmd.exe /c "npm run dev"

```



**Expected Startup Output:**

```

  VITE v6.4.5  ready in 412 ms



  ➜  Local:   http://localhost:5173/

  ➜  Network: use --host to expose

```



Open **`http://localhost:5173`** in your browser. All `/api` requests are automatically proxied to `http://localhost:3000` via `vite.config.ts`.



---



## 10. Initial Admin Setup



Because public self-registration is disabled for judges and administrators, initialize the first primary administrator user using the provided seed script:



```bash

cd server

npm run seed:admin

```



This connects to MongoDB, hashes the password with 10 bcrypt salt rounds, and provisions the initial account:

- **Email:** `admin@venturecraft.org`

- **Password:** `Admin@VentureCraft2026!`

- **Role:** `admin`



*(To customize the credentials prior to seeding, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env` before running).*



Once created, log in at **`http://localhost:5173/login`**.



---



## 11. End-to-End Competition Workflow Guide



Follow this standard chronological workflow during an event:



```

[1. Admin Login] ──► [2. Create Competition] ──► [3. Configure Parameters]

                                                         │

[6. Round 1 Active] ◄── [5. Register Teams] ◄── [4. Create Panels & Judges]

         │

         ▼

[7. Judges Score & Submit] ──► [8. Admin Closes R1] ──► [9. Qualify Top-N for R2]

                                                               │

[12. Final Champions] ◄── [11. Live Leaderboard] ◄── [10. Round 2 Active]

```



1. **Administrator Sign In:** Navigate to `/login` and sign in using the administrator credentials.

2. **Create Competition:** Go to `/admin` &rarr; **Competitions** tab. Create a new competition (e.g., *"National Hackathon 2026"*).

3. **Configure Criteria Parameters:** In the **Parameters** tab, add evaluation criteria (e.g., *Technical Architecture*, *Innovation*, *Presentation*). Specify `maxMarks`, `weightage`, and applicable rounds (`Round 1`, `Round 2`, or both).

4. **Provision Judges & Panels:**

   - In the **Panels** tab, click **+ Add Judge Account** to provision evaluators (e.g., `judge1@evaluator.org`).

   - Create judging panels (e.g., *Panel A - AI Track*, *Panel B - FinTech*). Search the judge directory by name or email and select judges from the readable multi-select; no ObjectId entry is required.

   - Use **Edit Panel** to rename a panel, change its description, or reassign judges later. Inactive judges cannot be newly assigned.

5. **Register Participants:** In the **Participants** tab, register participants with unique IDs (e.g., `KAR-01`, `KAR-02`) and select an active panel from the readable dropdown. Panel assignments can be changed later from the participant row or edit form.

6. **Activate Round 1:** In the **Competitions** tab, click **Activate Round 1**.

7. **Judge Evaluation:**

   - Judges log in at `/judge/login` and are automatically directed to the judge-only `/judge` dashboard.

   - Judges select their assigned panel, select a participant from the roster, and enter marks using the criteria sliders.

   - Click **Save Draft** to store work-in-progress, or **Finalize & Submit Evaluation** to lock the marks permanently.

8. **Inspect Progress & Close Round 1:**

   - The administrator monitors evaluation submissions in the `/admin` **Progress** tab.

   - When all evaluations are in, click **Close Round 1**.

9. **Qualify Teams for Round 2:**

   - In the `/admin` **Qualification** tab, run Round 2 qualification using **Top-N** (e.g., top 10 teams), a **cutoff score**, or custom selection.

10. **Execute Round 2:** Activate Round 2 in the competition settings. Judges repeat the evaluation process for qualified teams.

11. **Project Live Leaderboard:** Open `/leaderboard` on projector screens. Watch the live podium update with 15-second auto-refresh and export official final reports via **Print / Export**.



---



## 12. Testing and Production Build



### Running Automated Backend Tests



The backend test suite executes on Node's native test runner without third-party frameworks:



```bash

cd server



# Run all 43 unit and integration tests

npm test



# Type-check TypeScript codebase without emitting JS

npm run typecheck



# Build compiled production bundle into dist/

npm run build

```



**Test Coverage Summary:**

- Health & CORS contracts (7 tests)

- Standardized error envelopes (1 test)

- Input validation & mass-assignment defenses (16 tests)

- Scoring engine mathematics & tie-break algorithms (5 tests)

- Full-lifecycle MongoDB integration: auth, RBAC, competition progression, submission locks, qualification, and leaderboards (14 tests)



### Building the Frontend



```bash

cd client



# Build optimized production bundle

npm run build



# Preview the production build locally

npm run preview

```



---



## 13. API Documentation



Detailed technical references are maintained in the repository:



- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md): Detailed REST API specification covering request/response schemas, query parameters, error response envelopes, and status codes.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): Mathematical formulations for dynamic criteria normalization, multi-judge arithmetic mean aggregation, standard competition ranking (`1224`), data snapshot immutability, and state machines.



---



## 14. Troubleshooting



### 1. Backend startup fails: `Failed to connect to MongoDB`

- **Cause:** MongoDB is not running on the specified host or port.

- **Solution:** Ensure your local MongoDB or Docker container is active: `docker start srs-mongo` or verify `MONGODB_URI` in `server/.env`.



### 2. Startup fails: `Invalid environment configuration: JWT_SECRET`

- **Cause:** `NODE_ENV=production` is set, but `JWT_SECRET` is shorter than 32 characters.

- **Solution:** Provide a 32+ character random secret string in `server/.env`.



### 3. Windows PowerShell error: `File ... cannot be loaded because running scripts is disabled`

- **Cause:** Windows PowerShell execution policy restricts running `.ps1` wrapper scripts.

- **Solution:** Execute commands using `cmd.exe /c "<command>"`, e.g.:

  ```powershell

  cmd.exe /c "npm run dev"

  ```

  Or adjust execution policy in an administrative PowerShell terminal: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.



### 4. CORS error in browser console

- **Cause:** Frontend origin does not match `CLIENT_ORIGIN` in `server/.env`.

- **Solution:** Ensure `CLIENT_ORIGIN=http://localhost:5173` matches the exact URL and port of your Vite dev server.



### 5. Port 3000 or 5173 already in use

- **Cause:** Another process is already bound to port 3000 or 5173.

- **Solution:** Terminate conflicting processes or change the port in `server/.env` (`PORT=3001`) and update `client/vite.config.ts`.



### 6. MongoDB Atlas authentication error: `bad auth: Authentication failed`

- **Cause:** The `MONGODB_URI` contains template angle brackets (e.g., `<username>` or `%3C`), an incorrect database user password, or special characters that require percent-encoding.

- **Solution:** Verify the username and password in MongoDB Atlas Security &rarr; Database Access. Remove any `<` or `>` characters from `.env`. Run `npm run verify:atlas` in `server/` to diagnose the connection.



### 7. Add Judge or Register Participant appears non-responsive

- **Cause:** No active competition is selected, required fields failed validation (e.g. password < 6 characters or duplicate registration ID), or the backend could not connect to MongoDB.

- **Solution:** Ensure a competition is selected in the top bar. Check the modal error banner for actionable validation feedback. Verify backend readiness at `/api/v1/health/ready`.



---



## 15. Production Deployment



### Backend (Node.js / Express)

1. Set production environment variables:

   - `NODE_ENV=production`

   - `PORT=8080` (or host-assigned port)

   - `MONGODB_URI=<production_mongodb_connection_string>`

   - `JWT_SECRET=<cryptographically_secure_random_string_min_32_chars>`

   - `CLIENT_ORIGIN=https://your-production-domain.com`

2. Build and start:

   ```bash

   npm ci

   npm run build

   npm start

   ```

3. Suitable platforms: Docker, AWS ECS, Google Cloud Run, Render, Railway, Fly.io.



### Frontend (Static SPA)

1. Build the production client bundle:

   ```bash

   cd client

   npm ci

   npm run build

   ```

2. Deploy the generated `client/dist/` directory to any static CDN hosting provider (Vercel, Netlify, Cloudflare Pages, AWS S3/CloudFront).

3. Ensure SPA fallback routing is enabled (rewriting all non-asset requests to `index.html`).



---



## 16. Security Notes



- **Secrets Isolation:** Never check `.env` files into source control. Always inject credentials through hosting environment variable managers.

- **Strong Production Secrets:** The backend will refuse to start in production if `JWT_SECRET` is fewer than 32 characters or if `MONGODB_URI` is missing.

- **Stateless Tokens:** Authentication tokens are cryptographically signed with HMAC SHA-256 and expire according to `JWT_EXPIRES_IN` (default 24h).

- **Password Protection:** Passwords are never stored in plaintext and are hashed with 10 salt rounds using `bcryptjs`. The `passwordHash` field is marked `select: false` in Mongoose to prevent accidental exposure in database queries.

- **Mass Assignment Protection:** The centralized Zod validation layer strips undeclared keys from request bodies before passing data to controllers.

- **Locked Submissions:** Completed evaluations are sealed; the API rejects any attempt to alter or duplicate a submitted evaluation with HTTP 409 Conflict.




## Git Auto-Commit Watcher (Windows)

- **Location:** `tools/git-auto-commit/`
- **Start:** `powershell -ExecutionPolicy Bypass -File .\tools\git-auto-commit\start-watcher.ps1`
- **Stop:** `powershell -ExecutionPolicy Bypass -File .\tools\git-auto-commit\stop-watcher.ps1` or close the watcher window
- **Behavior:** Watches tracked and untracked project files recursively. Debounces changes for 10 seconds after the last change. Automatically stages with `git add -A` (respects `.gitignore`). Commits with a meaningful timestamped message when staged changes exist. Never pushes automatically.
- **Exclusions:** `node_modules/`, `dist/`, `build/`, `.git/`, `.env`, `.env.local`, `.env.*.local` (except `.env.example`), `*.log`, `*.pem`, `*.key`, `credentials.json`, `secrets.json`.
- **Safety:** Never stages secrets or credentials; fails safely if sensitive files are detected. Skips commits when there are no changes. Prevents overlapping commits. Handles Git errors safely.

