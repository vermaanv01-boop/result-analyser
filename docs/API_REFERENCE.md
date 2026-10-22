# KARVAAN API Reference Specification

Base Path: `/api/v1`  
Protocol: HTTP / JSON  
Authentication: Bearer Token (`Authorization: Bearer <JWT>`)

---

## Standard Error Response Envelope

All error responses strictly follow the standardized envelope:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "path": "/api/v1/evaluations/submit",
    "timestamp": "2026-10-22T00:30:00.000Z",
    "details": [
      {
        "path": "body.scores.0.awardedMarks",
        "code": "too_big",
        "message": "Awarded marks cannot exceed parameter max marks"
      }
    ]
  }
}
```

### Standard Error Codes
| HTTP Status | Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` / `VALIDATION_ERROR` | Malformed JSON or input validation failure |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT bearer token |
| 403 | `FORBIDDEN` | Insufficient role or access permissions |
| 404 | `NOT_FOUND` | Resource or route not found |
| 409 | `CONFLICT` | Unique key collision or state lock violation (e.g. duplicate evaluation submission) |
| 413 | `PAYLOAD_TOO_LARGE` | Request entity exceeds 100 KB limit |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled runtime exception |

---

## 1. Authentication & User Provisioning (`/auth`)

### `POST /auth/login`
Public endpoint to authenticate credentials and issue a signed JWT.
- **Request Body**:
  ```json
  { "email": "admin@karvaan.org", "password": "secure_password" }
  ```
- **Response (200)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "671752b023...",
      "name": "Competition Admin",
      "email": "admin@karvaan.org",
      "role": "admin",
      "isActive": true
    }
  }
  ```

### `GET /auth/me`
Retrieve authenticated caller principal.
- **Headers**: `Authorization: Bearer <token>`
- **Response (200)**: `{ "user": { ... } }`

### `POST /auth/users`
Admin-only endpoint to provision users (judges or admins). Public self-registration for judges is disabled.
- **Authorization**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Miller",
    "email": "smiller@evaluator.org",
    "password": "initial_password_123",
    "role": "judge",
    "isActive": true
  }
  ```
- **Response (201)**: `{ "user": { "id": "...", "name": "...", "role": "judge" } }`

### `GET /auth/judges`
List all judge accounts for administrator panel-assignment selectors.
- **Authorization**: `admin`
- **Response (200)**: `{ "judges": [{ "id": "...", "name": "Dr. Sarah Miller", "email": "smiller@evaluator.org", "role": "judge", "isActive": true }] }`
- **Notes**: Includes inactive judges so administrators can recognize and remove stale assignments; the UI disables inactive accounts for new selection.

---

## 2. Competitions (`/competitions`)

### `GET /competitions`
List all competitions with rounds summary and scoring policies.
- **Response (200)**: `{ "competitions": [ ... ] }`

### `POST /competitions`
Create a new competition with two default pending rounds (`round: 1` and `round: 2`).
- **Authorization**: `admin`
- **Request Body**:
  ```json
  {
    "name": "National Collegiate Hackathon 2026",
    "description": "Annual 36-hour multidisciplinary technology hackathon"
  }
  ```
- **Response (201)**: `{ "competition": { "_id": "...", "status": "draft", "rounds": [ ... ] } }`

### `PATCH /competitions/:competitionId`
Update competition basic metadata or global status (`draft` | `active` | `completed` | `archived`).
- **Authorization**: `admin`

### `POST /competitions/:competitionId/rounds/:round/status`
Advance or update a specific round lifecycle (`pending` -> `active` -> `closed`).
- **Authorization**: `admin`
- **Validation**: Enforces sequential lifecycle; Round 2 cannot be activated or closed while Round 1 is still pending.
- **Request Body**:
  ```json
  { "status": "active" }
  ```
- **Response (200)**: `{ "rounds": [ ... ] }`

### `GET /competitions/:competitionId/progress`
Inspect comprehensive administrative evaluation completion progress across panels for Round 1 and Round 2.
- **Authorization**: `admin`
- **Response (200)**:
  ```json
  {
    "progress": {
      "competitionId": "...",
      "totalParticipants": 40,
      "totalPanels": 4,
      "activeRound": 1,
      "panelProgress": [
        {
          "panelId": "...",
          "panelName": "Panel A - AI Track",
          "judgeCount": 3,
          "participantCount": 10,
          "round1": { "expected": 30, "submitted": 28, "isComplete": false },
          "round2": { "expected": 30, "submitted": 0, "isComplete": false }
        }
      ]
    }
  }
  ```

---

## 3. Panels (`/competitions/:competitionId/panels`)

### `GET /competitions/:competitionId/panels`
List all judging panels associated with the competition.
- **Response (200)**: `{ "panels": [ ... ] }`

### `POST /competitions/:competitionId/panels`
Create a panel and assign verified judge user accounts.
- **Authorization**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Panel 1 - FinTech",
    "description": "Evaluates financial technology solutions",
    "judges": ["671752b023...", "671752b024..."]
  }
  ```
- **Constraints**: Requires at least one judge. Judge IDs must be valid, unique within the payload, belong to existing accounts with the `judge` role, and reference active accounts. The administrator UI provides a searchable judge selector, so these IDs do not need to be entered manually.
- **Response (201)**: `{ "panel": { "_id": "...", "judges": [ ... ] } }`

### `PATCH /competitions/:competitionId/panels/:panelId`
Modify panel name, description, assigned judges list, or active status.
- **Authorization**: `admin`
- **Constraints**: When `judges` is supplied, the same valid, unique, existing, active-judge rules apply.

---

## 4. Participants (`/competitions/:competitionId/participants`)

### `GET /competitions/:competitionId/participants`
List participants with optional filtering by `panel`, `isActive`, or round eligibility.
- **Query Parameters**: `panel` (ObjectId), `isActive` (boolean), `round` (1 | 2)
- **Response (200)**: `{ "participants": [ ... ] }`

### `POST /competitions/:competitionId/participants`
Register a participant team or individual.
- **Authorization**: `admin`
- **Constraints**: Enforces competition-scoped unique `registrationId`. If `panel` is supplied, it must belong to the same competition and be active.
- **Request Body**:
  ```json
  {
    "name": "Team Quantum Leap",
    "registrationId": "KAR-2026-042",
    "email": "quantum@university.edu",
    "panel": "671752b023..."
  }
  ```
- **Response (201)**: `{ "participant": { ... } }`

### `PATCH /competitions/:competitionId/participants/:participantId`
Update participant name, registration ID, email, panel assignment, or active status.
- **Authorization**: `admin`
- **Constraints**: A supplied `panel` must belong to the same competition and be active. Existing assignments to a now-inactive panel are preserved until reassigned.

### `PATCH /competitions/:competitionId/participants/:participantId/eligibility`
Explicitly set eligibility for a particular round with an optional reason.
- **Authorization**: `admin`
- **Request Body**:
  ```json
  {
    "round": 2,
    "eligible": false,
    "ineligibleReason": "Did not meet Round 1 threshold"
  }
  ```

### `POST /competitions/:competitionId/participants/qualify-round-2`
Batch qualify top performers for Round 2 based on Round 1 performance.
- **Authorization**: `admin`
- **Request Body Modes**:
  - Top-N rank qualification:
    ```json
    { "method": "topN", "topN": 10 }
    ```
  - Cutoff score qualification:
    ```json
    { "method": "cutoffScore", "cutoffScore": 75.0 }
    ```
  - Explicit list qualification:
    ```json
    { "method": "explicit", "participantIds": ["...", "..."] }
    ```
- **Response (200)**: `{ "qualifiedCount": 10, "totalProcessed": 40 }`

---

## 5. Evaluation Parameters (`/competitions/:competitionId/parameters`)

### `GET /competitions/:competitionId/parameters`
List parameters filtered by `round` and `isActive`.
- **Query Parameters**: `round` (1 | 2), `isActive` (boolean)
- **Response (200)**: `{ "parameters": [ ... ] }`

### `POST /competitions/:competitionId/parameters`
Define an evaluation criterion.
- **Authorization**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Technical Architecture & Scalability",
    "description": "Evaluation of database schema, concurrency, and modularity",
    "guidelines": "10 marks for normalization, 10 marks for caching and error resilience",
    "maxMarks": 20,
    "weightage": 1.5,
    "applicableRounds": [1, 2]
  }
  ```
- **Response (201)**: `{ "parameter": { ... } }`

---

## 6. Evaluations (`/evaluations`)

### `POST /evaluations/draft`
Save or update a work-in-progress draft evaluation. Drafts do not seal scores and can be modified.
- **Authorization**: `judge` or `admin`
- **Enforcements**: Caller must be assigned to participant's panel; competition and round must be active; participant must be eligible.
- **Request Body**:
  ```json
  {
    "competition": "671752b0...",
    "participant": "671752b1...",
    "panel": "671752b2...",
    "round": 1,
    "scores": [
      { "parameter": "671752b3...", "awardedMarks": 18.5 }
    ]
  }
  ```
- **Response (200)**: `{ "evaluation": { "status": "draft", ... } }`

### `POST /evaluations/submit`
Finalize and permanently seal an evaluation.
- **Authorization**: `judge` or `admin`
- **Validation**: Enforces that all active round parameters are scored and `awardedMarks <= maxMarks`.
- **Lock-in**: Transitions status to `submitted` with `submittedAt` timestamp. Any subsequent call returns **HTTP 409 Conflict**.
- **Response (200)**: `{ "evaluation": { "status": "submitted", "submittedAt": "...", ... } }`

---

## 7. Judge Portal (`/judge`)

### `GET /judge/panels`
Returns all panels to which the authenticated judge is assigned.
- **Authorization**: `judge` only
- **Response (200)**: `{ "panels": [ ... ] }`

### `GET /judge/panels/:panelId/participants`
Returns the participant roster for a panel with the current round and judge's individual evaluation status (`none` | `draft` | `submitted`) for each participant.
- **Authorization**: `judge` assigned to the panel only
- **Response (200)**:
  ```json
  {
    "panel": { "id": "...", "name": "Panel 1", "competitionId": "...", "competitionName": "..." },
    "activeRound": 1,
    "participants": [
      {
        "id": "...",
        "name": "Team Alpha",
        "registrationId": "KAR-01",
        "isEligible": true,
        "evaluationStatus": "submitted"
      }
    ]
  }
  ```

### `GET /judge/evaluations`
Returns all draft and submitted evaluations submitted by the authenticated judge.
- **Authorization**: `judge` only
- **Response (200)**: `{ "evaluations": [ ... ] }`

---

## 8. Live Leaderboards (`/competitions/:competitionId/leaderboard`)

### `GET /competitions/:competitionId/leaderboard`
Overall leaderboard ranking all participants across both rounds.
- **Public**: No authentication required.
- **Response (200)**:
  ```json
  {
    "competition": { "id": "...", "name": "Hackathon 2026", "status": "active" },
    "filter": { "round": "overall", "panelId": null },
    "generatedAt": "2026-10-22T00:45:00.000Z",
    "leaderboard": [
      {
        "rank": 1,
        "participantId": "...",
        "registrationId": "KAR-01",
        "participantName": "Team Alpha",
        "panelId": "...",
        "panelName": "Panel 1",
        "isEligible": true,
        "totalScore": 96.5,
        "rawTotalMarks": 92.0,
        "roundResults": {
          "1": { "roundScore": 95.0, "rawAverageMarks": 91.0, "judgeCount": 3, "panelJudgeCount": 3, "isComplete": true },
          "2": { "roundScore": 98.0, "rawAverageMarks": 93.0, "judgeCount": 3, "panelJudgeCount": 3, "isComplete": true }
        }
      }
    ]
  }
  ```

### `GET /competitions/:competitionId/leaderboard/round/:round`
Round-specific leaderboard filtered to Round 1 or Round 2.
- **Public**: No authentication required.

### `GET /competitions/:competitionId/leaderboard/panel/:panelId`
Panel-specific leaderboard filtered to participants assigned to a single panel.
- **Public**: No authentication required.
