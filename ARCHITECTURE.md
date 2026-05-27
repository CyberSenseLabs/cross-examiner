# Architecture

## System diagram

```mermaid
flowchart TD
    User([User]) -->|prompt + optional response| UI

    subgraph Browser["Browser"]
        UI["Input Form\napp/page.tsx"]
        ResultsView["Results View\ncomponents/AuditResults.tsx"]
    end

    UI -->|POST /api/audit| AuditRoute["Audit Route\napp/api/audit/route.ts"]
    ResultsView -->|GET /api/audit/:id| FetchRoute["Fetch Route\napp/api/audit/[id]/route.ts"]

    AuditRoute --> Pipeline

    subgraph Pipeline["Pipeline  —  lib/pipeline.ts"]
        direction TB
        P1[1. Create audit row]
        P2[2. Generate target response\nif none supplied]
        P3[3. Decompose into atomic claims]
        P4[4. Confidence elicitation\nbefore any challenge]
        P5[5. Probe battery\n9 probes · parallel per claim]
        P6[6. Adjudicate each transcript]
        P7[7. Ground-truth probe\nexternal retrieval]
        P8[8. Set claims.survived]
        P9[9. Score + persist]

        P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8 --> P9
    end

    subgraph Roles["Three Model Roles  —  independence boundary"]
        direction LR
        Target["🎯 Target\nModel under examination\nBlinded — no audit signals\nclean messages array per call"]
        Interrogator["🔍 Interrogator\nDifferent family from target\nGenerates probes\nConducts exchanges"]
        Adjudicator["⚖️ Adjudicator\nSeparate from interrogator\nLow temperature\nVerdicts only — never scores"]
    end

    subgraph Scoring["Scoring  —  lib/score.ts"]
        TS["Deterministic TypeScript\nNo model involvement\nSame inputs → same score always"]
    end

    subgraph External["External Services"]
        Anthropic["Anthropic API\nclaude-opus / sonnet / haiku"]
        OpenAI["OpenAI API\ngpt-4o / o3-mini"]
        Tavily["Tavily Search API\nground-truth retrieval only"]
    end

    DB[("Neon Postgres\naudits · claims\nprobes · dimension_scores")]

    P2 -->|generateText| Target
    P3 -->|generateObject| Interrogator
    P4 -->|generateObject| Target
    P5 -->|generateText| Target
    P5 -->|generateObject probe questions| Interrogator
    P6 -->|generateObject verdict| Adjudicator
    P7 --> Tavily
    P7 -->|interpret results| Interrogator
    P9 --> TS

    Target --> Anthropic
    Target --> OpenAI
    Interrogator --> Anthropic
    Interrogator --> OpenAI
    Adjudicator --> Anthropic
    Adjudicator --> OpenAI

    Pipeline --> DB
    FetchRoute --> DB
    DB --> ResultsView
```

---

## Component descriptions

### Browser

**Input Form** (`app/page.tsx`) — accepts the original prompt, an optional target response to paste in, and the target model selection. Submits to the audit route and renders the results component once the audit ID is returned.

**Results View** (`components/AuditResults.tsx`) — fetches the completed audit by ID and renders the composite score, verdict band, calibration delta, per-dimension score bars, and a per-claim drill-down with individual probe verdicts and full transcripts.

---

### API routes

**Audit route** (`app/api/audit/route.ts`) — validates the request body and hands off to the pipeline. Sets `maxDuration = 300` to accommodate the full probe battery within Vercel's function timeout.

**Fetch route** (`app/api/audit/[id]/route.ts`) — returns the complete audit record including all claims, probes, and dimension scores for a given audit ID.

---

### Pipeline (`lib/pipeline.ts`)

Orchestrates nine sequential steps. Steps that produce independent probes for a single claim fire in parallel via `Promise.allSettled` with a per-call `AbortController` timeout — a slow or failed provider degrades the audit rather than killing it.

---

### Three model roles

**Target** — the model whose response is under examination. Called statelessly with a clean `messages` array each time. No system prompt, no context, no audit signals. This blinding is intentional: if the target knew it was being tested, it would alter its behaviour and reduce diagnostic signal.

**Interrogator** (`lib/decompose.ts`, `lib/probes/`) — must be from a different model family than the target. Responsible for claim decomposition, generating probe questions (restatement variants, contradiction trap questions, boundary questions, negations), and interpreting ground-truth search results. A different family means different training data and different blind spots, making the cross-examination genuinely adversarial.

**Adjudicator** (`lib/adjudicate.ts`) — reads a completed probe transcript and emits one structured verdict from a fixed set. Runs at low temperature. Separated from the interrogator so the same model cannot set a test and mark its own work. Never computes scores — it only produces verdicts.

---

### Scoring (`lib/score.ts`)

`computeScore` — maps probe verdicts to numeric values, averages per dimension, applies weights, and sums to a 0–100 composite. Any `fabricated_source` or `confident_fabrication` verdict caps the composite at 34. Pure TypeScript with no model involvement: the same verdict set always produces the same score.

`computeCalibration` — computes the mean absolute gap between `claims.statedConfidence` (elicited before any challenge) and `claims.survived` (set after all probes). Reported separately as a calibration delta with a direction label (`overconfident` / `underconfident` / `aligned`).

---

### Database (`db/`)

Four tables in Neon Postgres via Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `audits` | One row per audit run — prompt, response, models used, composite score, status |
| `claims` | Atomic claims extracted from the response — type, stated confidence, survived score |
| `probes` | One row per probe per claim — verdict, rationale, full transcript as JSONB |
| `dimension_scores` | Pre-computed per-dimension breakdown — raw score, weight, weighted points |

---

### External services

**Anthropic API / OpenAI API** — model inference only. Any of the three roles (target, interrogator, adjudicator) can be routed to either provider via `lib/providers.ts`.

**Tavily Search API** — used exclusively by the ground-truth probe (`lib/probes/groundTruth.ts`) to retrieve web sources for each surviving factual claim. The only network call in the pipeline that is not a model inference request.
