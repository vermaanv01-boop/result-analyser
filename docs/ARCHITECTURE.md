# Venture Craft Architectural & Mathematical Specification

This document details the architectural principles, data flow models, security boundaries, and mathematical formulations governing the Venture Craft evaluation platform.

---

## 1. Architectural Layers & Boundaries

```
[ HTTP Request (Browser Client / External Consumer) ]
                         │
                         ▼
             [ CORS & Body Parsers ]
                         │
                         ▼
        [ Authentication & RBAC Middleware ]
                         │
                         ▼
          [ Request Validation (Zod) ]
                         │
                         ▼
              [ Express Controllers ]
                         │
                         ▼
           [ Domain & Scoring Services ]
                         │
                         ▼
           [ Mongoose Aggregate Models ]
                         │
                         ▼
               [ MongoDB Database ]
```

### Layer Responsibilities
1. **Middleware Pipeline**:
   - `cors.ts`: Strictly restricts origins to authorized origins (`CLIENT_ORIGIN` + development loopbacks).
   - `auth.ts`: Verifies HMAC SHA-256 signed bearer tokens, loads active user principal, checks account deactivation.
   - `validate.ts`: Strict Zod validation boundary; strips unknown fields, normalizes types, and enforces input limits before controller entry.
2. **Controllers**: Pure HTTP orchestration; extracts validated params/body/query, invokes services, and sends standardized JSON responses.
3. **Domain Services**: Pure business logic, authorization invariants (e.g. cross-panel judge check), and database transactions.
4. **Scoring Engine (`scoring.service.ts`)**: Pure deterministic mathematical calculations isolated from DB side effects.
5. **Persistence Models**: Mongoose models declaring schema constraints, unique compound indexes, and default values.

---

## 2. Mathematical Scoring & Aggregation Model

### A. Dynamic Criteria Normalization
Scores are never assumed to be out of 100. The maximum achievable score is dynamically derived from the applicable criteria in the active round:

Let $C = \{c_1, c_2, \dots, c_k\}$ be the set of active criteria for round $R$.  
Each criterion $c_i$ has:
- $m_i \in \mathbb{R}^+$: Maximum achievable marks ($m_i > 0$)
- $w_i \in \mathbb{R}^{\ge 0}$: Weight multiplier ($w_i \ge 0$)
- $a_i \in [0, m_i]$: Marks awarded by judge $j$

The judge's raw score is:
$$\text{RawMarks}_j = \sum_{i=1}^k a_i$$

The judge's normalized score (scaled to 100 by default or fixed total $F$) is:
$$\text{NormalizedScore}_j = \left( \frac{\sum_{i=1}^k w_i \cdot a_i}{\sum_{i=1}^k w_i \cdot m_i} \right) \times 100$$

### B. Multi-Judge Aggregation
In a panel with $N$ judges where $J_{\text{submitted}} \subseteq \{1, \dots, N\}$ judges have finalized their evaluations:

The round raw average marks are:
$$\overline{\text{RawMarks}} = \frac{1}{|J_{\text{submitted}}|} \sum_{j \in J_{\text{submitted}}} \text{RawMarks}_j$$

The round normalized score is:
$$\text{RoundScore}_R = \frac{1}{|J_{\text{submitted}}|} \sum_{j \in J_{\text{submitted}}} \text{NormalizedScore}_j$$

Completeness is evaluated as:
$$\text{isComplete} = (|J_{\text{submitted}}| \ge N)$$

### C. Multi-Round Aggregation
For two-round competitions with round weights $W_1$ and $W_2$ (default $W_1 = 0.5, W_2 = 0.5$):

$$\text{OverallScore} = W_1 \cdot \text{RoundScore}_1 + W_2 \cdot \text{RoundScore}_2$$

If a participant only has Round 1 completed, their score reflects Round 1's proportional contribution.

### D. Standard Competition Ranking ("1224" Rule)
To ensure sporting fairness without artificial rank dilution:
1. Participants are sorted in descending order of $\text{OverallScore}$.
2. If two or more participants have the exact same score, they are assigned the same rank.
3. The rank assigned to the subsequent participant is incremented by the number of tied participants preceding them.
4. Ties in display order are deterministically broken using alphabetical ordering of unique `registrationId`.

*Example:*
- Team A (95.0) -> Rank 1
- Team B (92.5) -> Rank 2
- Team C (92.5) -> Rank 2
- Team D (89.0) -> Rank 4 (Rank 3 is skipped)

---

## 3. Data Integrity & Immutability Patterns

### Historical Criteria Snapshotting
When an evaluation is recorded, criteria are copied into an embedded array inside the `Evaluation` document:

```typescript
criteria: [
  {
    parameter: ObjectId("..."),
    configVersion: 1,
    parameterName: "Code Quality",
    maxMarks: 20,
    weightage: 1.0,
    applicableRounds: [1, 2],
    awardedMarks: 17.5
  }
]
```

**Consequence:** Even if an administrator subsequently changes the parameter name, guidelines, or max marks for future rounds, existing evaluation snapshots remain completely unaffected.

### Compound Unique Database Indexes
1. `participants`: `{ competition: 1, registrationId: 1 }` (unique)
   - Guarantees registration IDs are unique per competition while allowing ID re-use across distinct competitions.
2. `evaluations`: `{ competition: 1, participant: 1, round: 1, judge: 1 }` (unique)
   - Guarantees that a judge cannot create multiple competing evaluation records for the same participant in a round. Resubmissions update the existing draft.
3. `panels`: `{ competition: 1, name: 1 }` (unique per competition)

---

## 4. State Machines & Lifecycle Transitions

```
[ Competition ]
  Draft ──────► Active ──────► Completed ──────► Archived

[ Round ]
  Pending ────► Active ──────► Closed

[ Evaluation ]
  None ───────► Draft ───────► Submitted (LOCKED)
```

- **Round Ordering Invariant:** Round 2 may not transition to `active` or `closed` if Round 1 is in `pending` status.
- **Round-Closure Lock:** When a round transitions to `closed`, all evaluation submissions targeting that round are rejected.
- **Evaluation Submission Lock:** A submitted evaluation cannot be reverted to draft or altered by any API call.
