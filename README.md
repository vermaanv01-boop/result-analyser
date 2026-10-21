# KARVAAN — Student Evaluation, Ranking & Live Leaderboard System

> A robust, deterministic, role-governed evaluation platform engineered for collegiate hackathons, academic symposiums, and multi-round student competitions.

---

## 🌟 Executive Overview

**KARVAAN** is a full-stack, enterprise-grade competition scoring and live leaderboard platform built with Node.js, Express, TypeScript, Mongoose, MongoDB, React 18, and Vite.

It replaces error-prone spreadsheets with an immutable, verifiable, and multi-judge consensus scoring engine that supports:
- **Two-round competition lifecycles** with independent round transitions (Round 1 & Round 2).
- **Multi-judge panel aggregation** utilizing arithmetic mean across assigned panel evaluators.
- **Dynamic criteria versioning & snapshot immutability** guaranteeing that retrospective parameter changes never invalidate or alter previously submitted evaluations.
- **Judge evaluation lock-in** preventing tampering or post-deadline modifications.
- **Deterministic competition ranking** implementing standard competition ranking (`1224` ties) with stable tie-break resolution.
- **Real-time live leaderboards** with 15-second polling, visual podiums, round filtering, and detailed score breakdowns.
- **Administrative qualification workflows** supporting automated Round 2 promotions via Top-N ranking, minimum score thresholds, or explicit selections.

---

## 🏗️ Architecture & Technology Stack

```
student-ranking-system/
├── client/                      # Frontend (React 18 + TypeScript + Vite)
│   ├── src/
│   │   ├── assets/              # Branding assets & SVG/PNG logos
│   │   ├── components/
│   │   │   ├── common/          # Reusable components (e.g. KARVAANLogo)
│   │   │   └── layout/          # Navbar, ProtectedRoute
│   │   ├── context/             # AuthContext (JWT management & session sync)
│   │   ├── pages/
│   │   │   ├── auth/            # LoginPage (Admin & Judge authentication)
│   │   │   ├── admin/           # AdminDashboardPage (Competition, panel, participant, parameter controls)
│   │   │   ├── judge/           # JudgePortalPage (Participant roster, criteria scoring, draft & submit)
│   │   │   └── leaderboard/     # LeaderboardPage (Public live leaderboard with podium, filters, print)
│   │   ├── services/            # Typed ApiService interfacing with backend REST API
│   │   ├── types/               # TypeScript interfaces & domain types
│   │   ├── index.css            # Custom luxury aesthetic design tokens & components
│   │   ├── App.tsx              # Application router & protected routes
│   │   └── main.tsx             # Application DOM mounting
│   └── vite.config.ts           # Vite bundler configuration with backend proxy
├── server/                      # Backend (Node.js + Express + TypeScript + Mongoose)
│   ├── src/
│   │   ├── config/              # Centralized Zod-validated env & Mongoose connection lifecycle
│   │   ├── controllers/         # Express controllers (auth, competition, panel, participant, parameter, evaluation, judge, leaderboard)
│   │   ├── middleware/          # CORS, JWT auth, RBAC guards, request validation, global error handling
│   │   ├── models/              # Mongoose domain aggregates (User, Competition, Panel, Participant, EvaluationParameter, Evaluation)
│   │   ├── routes/              # Modular Express route definitions (/api/v1/*)
│   │   ├── services/            # Pure domain services (Scoring, Leaderboard, Auth, Domain aggregates)
│   │   ├── types/               # Domain vocabularies, API envelopes, and JWT claim types
│   │   ├── utils/               # ApiError, standardized error registry, and Mongoose validators
│   │   ├── validators/          # Zod validation schemas for request parameters, bodies, and queries
│   │   ├── app.ts               # Side-effect-free Express application composition
│   │   └── server.ts            # Entrypoint with graceful shutdown handling
│   └── test/                    # Automated integration & unit test suite (Node test runner via tsx)
└── docs/                        # Architecture & comprehensive API reference
```

### Core Technologies
- **Backend:** Node.js (v20+), Express 4, TypeScript 5.7 (strict mode), Mongoose 9, Zod 4, jsonwebtoken, bcryptjs.
- **Frontend:** React 18, TypeScript 5.7, Vite 6, React Router 6.
- **Database:** MongoDB 8.0+.
- **Testing:** Native `node:test` + `node:assert/strict` via `tsx` (zero heavy external runners required).

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Node.js**: v20.x or later installed.
2. **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017` or a Docker container:
   ```bash
   docker run -d --name srs-mongo -p 27017:27017 mongo:8
   ```

### 1. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example or create .env:
# PORT=3000
# NODE_ENV=development
# MONGODB_URI=mongodb://127.0.0.1:27017/student_ranking_system
# CLIENT_ORIGIN=http://localhost:5173
# JWT_SECRET=development_super_secret_jwt_key_karvaan_2026_min32chars
# JWT_EXPIRES_IN=24h

# Run type check
npm run typecheck

# Run automated test suite (43 tests across 9 test suites)
npm test

# Build production bundle
npm run build

# Start development server with live reload
npm run dev
```

The backend server listens on `http://localhost:3000`.

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to client directory
cd client

# Install dependencies
npm install

# Build production bundle / typecheck
npm run build

# Start frontend development server
npm run dev
```

The frontend web app runs on `http://localhost:5173` with automatic API proxying to `http://localhost:3000`.

---

## 👥 Roles & Access Control

| Role | Access Permissions |
|---|---|
| **Admin** | Full system governance: Provision users & judges, create competitions, manage round statuses, assign panels, register participants, configure evaluation parameters, qualify Round 2 cohorts, inspect progress metrics. |
| **Judge** | Dedicated evaluation portal: View assigned panels, inspect active round participants, score dynamic criteria using sliders/steppers, save drafts, finalize & submit immutable evaluations. |
| **Participant / Public** | Public access: Real-time Live Leaderboard, round standings, top-3 podium showcase, score breakdowns, and printer-friendly PDF exports. |

---

## 🎯 Key Capabilities

### 1. Deterministic Multi-Judge Scoring Engine
- **Dynamic Total Derivation:** Scores are dynamically calculated from active criteria weights rather than hardcoding to an arbitrary 100 max.
- **Multi-Judge Consensus:** When multiple judges evaluate a participant on a panel, their normalized scores are aggregated using an arithmetic mean.
- **Standard Competition Ranking ("1224" Tie Resolution):** Participants with identical normalized scores share the same rank. Tied ranks leave gaps for subsequent ranks (e.g., 1st, 2nd, 2nd, 4th).

### 2. Additive Versioning & Snapshot Immutability
- Evaluated marks are frozen into an embedded criterion snapshot in the `Evaluation` document containing `parameterName`, `maxMarks`, `weightage`, and `awardedMarks`.
- Adjusting criteria for future participants increments the competition's `parameterConfigVersion` without rewriting historical records.

### 3. Submission Lock & Round Lifecycle Protection
- Once an evaluation status transitions to `submitted`, it is permanently sealed against updates or overwrites (HTTP 409 Conflict).
- Submissions are strictly prohibited against closed rounds or for participants marked ineligible for that round.

---

## 🧪 Testing & Quality Assurance

The system is tested across all functional boundaries:
- **Health & CORS:** Liveness (`/live`), readiness (`/ready`), and CORS header contracts.
- **Error Contract:** Standardized error envelopes with consistent machine-readable codes.
- **Request Validation:** Strict Zod schema boundaries verifying body, query, and path inputs.
- **Scoring Unit Tests:** Dynamic derivation, normalization, tie-break algorithms, and multi-round weighting.
- **Full-Lifecycle Integration:** End-to-end integration test spanning user provisioning, competition setup, round progression, evaluation submission, round closure, and leaderboard generation.

Run tests anytime with:
```bash
cd server
npm test
```

---

## 📖 Documentation

For detailed architectural schematics and API documentation, see:
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md): Comprehensive REST API contract and endpoint specifications.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): Domain aggregation models, mathematical scoring formulas, and security controls.
- [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md): Detailed development history and milestone tracking.
