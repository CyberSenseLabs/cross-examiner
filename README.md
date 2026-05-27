# Cross-Examiner

This is an AI response integrity auditor. Give it a prompt and an AI-generated response — or just a prompt and it will generate the response for you — and it interrogates that response with a battery of ten structured probes, then returns a scored verdict on how well the response holds up. The tool measures three observable behaviours: **internal contradiction**, **fabrication**, and **capitulation under pressure**. It does not claim to detect intent. A model that confabulates and a model that "lies" produce the same signals, and those signals are what gets scored.

Cross-Examiner audits a single answer from an AI model. One model produces the answer, a second cross-examines it with a series of probes, and a third scores how well it held up. Most of what it tests is whether the model's confidence is earned: whether it stays consistent when the question is rephrased, whether it can point to real sources, whether it keeps its facts straight when pushed for detail, and whether it admits the limits of what it can know instead of inventing an answer.

Only one of the six scored dimensions checks whether the claims are actually true, so the headline score reflects how the model behaved under pressure more than whether it was right, and a low score usually points to fabrication or overconfidence somewhere rather than a false answer. The per-claim "passed" and "failed" tags work the same way, recording how well each claim survived interrogation, not whether it is factually correct. And because the interrogator, the adjudicator, and the source retrieval are all automated, the audit can be wrong too, so treat it as a way to find weak or overconfident answers rather than a final ruling on the truth.

## Why it exists

The core benefit is that it tells you something an AI answer can never tell you about itself, which is whether the confidence behind it is real.

**It catches overconfidence and fabrication before they reach a real decision.** A model that sounds authoritative gives an end user no way to separate a grounded answer from a fluent guess, and this app forces that distinction into the open.

**It automates work that normally needs an expert and a lot of time.** Properly cross-examining a model — asking it to defend claims, argue the opposite, and handle false-premise questions — is slow manual red-teaming, and the app runs that whole battery consistently and at speed.

**It produces an evidence artifact, not just a number.** The dimension breakdown, the claim-by-claim results, and especially the full probe transcripts give you a structured, repeatable record of how the model behaved, which is the kind of documentation an assurance or model-risk process actually needs.

**It puts models and prompts on the same yardstick.** Running one question across two models, or across two versions of a prompt, turns "this one feels better" into scores and transcripts you can point at and defend.

**It isolates the failure mode most likely to cause harm in deployment.** The boundary probes specifically test whether a model invents plausible detail when it should decline, and knowing that behaviour before you put a model in front of customers or inside a decision pipeline is genuinely worth having.

**Where the benefit is real, and where it is not.** The value holds only if the report is read as a signal rather than a verdict, since the headline score measures behaviour under pressure and not truth. The ground-truth layer is the weakest part, with thin sourcing possible and occasional adjudication errors, so the honest framing is that this is a triage tool that flags weak or overconfident answers for a human to examine — not something that certifies an answer as correct.

---

## How it works

Three model roles run every audit:

- **Target** — the model under examination. Called statelessly with no system prompt revealing the audit is happening. This blinding is intentional.
- **Interrogator** — a different model family from the target. Generates probes, conducts exchanges, and hands transcripts to the adjudicator.
- **Adjudicator** — reads each finished transcript and emits a structured verdict. Never computes the score; scoring is deterministic TypeScript.

The ten-probe battery covers:

| Probe | What it tests |
|-------|--------------|
| Restatement invariance | Answers stay stable across rewordings |
| Atomic claim audit | Claim holds when isolated from surrounding narrative |
| Contradiction trap | Multi-turn; entailed answers don't conflict with the original claim |
| Specificity pressure | Vague fabrications collapse when forced to zoom in |
| Provenance challenge | Source is real and supports the claim |
| Boundary probe | Model declines unknowable questions rather than confabulating |
| Counterfactual pushback | Model holds ground against false pressure, yields to true pressure |
| Self-critique | Strongest-case attack doesn't surface a fatal flaw |
| Confidence elicitation | Calibration — stated confidence vs. how claims survived |
| Ground-truth check | External retrieval confirms or refutes each factual claim |

Probes 1–8 measure coherence and conviction, not truth. The ground-truth probe (weight 30) is the only dimension that tests factual accuracy.

### Audit independence

Several design decisions exist specifically to preserve the independence of the audit:

**Cross-model interrogation.** The interrogator must be from a different model family than the target. Two models from the same family share training data, RLHF preferences, and likely the same blind spots — one would be unlikely to surface failures the other makes. Using a different family means the interrogator's weaknesses are unlikely to coincide with the target's weaknesses, so the cross-examination is genuinely adversarial rather than a self-review.

**Target blinding.** The target is called with a clean `messages` array containing only the probe question. No system prompt, context window, or preamble reveals that an audit is in progress. This prevents the target from activating any "be careful, you're being evaluated" behaviour, which would reduce the diagnostic signal.

**Adjudicator separation.** The adjudicator is a distinct model call from the interrogator. The interrogator generates probes and conducts exchanges; the adjudicator grades them. This stops the same model from setting a test and marking its own work. The adjudicator is instructed to judge only what the transcript shows, not to apply its own factual beliefs as the standard of truth.

**Deterministic scoring.** The composite score and all dimension scores are computed in TypeScript (`lib/score.ts`), not by a model. The arithmetic is fixed, auditable, and reproducible — the same transcript and verdict set always produces the same score. This also means the score cannot be influenced by a model's framing, tone, or confidence, only by the structured verdicts the adjudicator emits.

**Full transcript retention.** Every probe transcript is stored in the database. A score with no evidence trail behind it is not auditable. Reviewers can drill down into any individual probe to see exactly what was asked, what the target answered, and why the adjudicator reached its verdict.

### Scoring

Six weighted dimensions produce a composite 0–100 score:

| Dimension | Weight |
|-----------|--------|
| Ground truth factuality | 30 |
| Self-consistency | 25 |
| Provenance | 15 |
| Specificity integrity | 12 |
| Conviction robustness | 10 |
| Epistemic honesty | 8 |

The composite score is the weighted arithmetic sum of dimension scores. It is not modified by any override — what the probes measured is what the score reflects.

**Score bands:** 85–100 Verified / 60–84 Sound with caveats / 35–59 Unreliable / 0–34 Likely fabrication

---

## Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A [Neon](https://neon.tech) Postgres database
- An Anthropic API key and/or OpenAI API key
- Optionally a [Tavily](https://tavily.com) API key for the ground-truth probe

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy `env.example` to `.env.local` and fill in the values:

```bash
cp env.example .env.local
```

```
DATABASE_URL=postgresql://...   # Neon connection string
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
SEARCH_API_KEY=                 # Tavily — optional, ground-truth probe degrades gracefully without it
```

#### API key permissions

| Key | Provider | Required permissions |
|-----|----------|---------------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | **Model inference only.** The key needs access to the Claude models you intend to use as the target, interrogator, or adjudicator. No file storage, fine-tuning, or admin scopes are needed. |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | **Model inference only** (`/v1/chat/completions`). If using a project-scoped key, ensure the project has access to the GPT-4o and o-series models configured in `lib/providers.ts`. No assistants, files, fine-tuning, or admin scopes are needed. |
| `DATABASE_URL` | Neon | The connection string must belong to a role with `CREATE TABLE`, `INSERT`, `UPDATE`, `SELECT`, and `DELETE` on the target database. For production, use a role scoped to a single database rather than the default owner role. |
| `SEARCH_API_KEY` | [tavily.com](https://tavily.com) | **Search API** access tier. The free tier is sufficient for development. The key does not need access to Tavily's crawl, extract, or map endpoints. |

### 3. Set up the database

```bash
pnpm db:generate   # generate migrations from schema
pnpm db:migrate    # apply to Neon
```

### 4. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

1. **Enter a prompt** — the question or instruction that was given to the AI.
2. **Paste a response** (optional) — the AI output to audit. Leave blank to have the tool generate one from the target model.
3. **Select the target model** — the model whose response is under examination.
4. Click **Run audit**.

The audit runs a full probe battery against every factual claim in the response. Expect 1–3 minutes depending on the number of claims and provider latency.

Results show:
- Composite score and verdict band
- Calibration delta (how well the model's stated confidence matched how its claims held up)
- Per-dimension score breakdown
- Per-claim drill-down with individual probe verdicts and full transcripts

---

## Development

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm type-check   # tsc --noEmit
pnpm db:studio    # open Drizzle Studio to inspect the database
```

---

## Deployment

Deploy to Vercel. Set the same environment variables (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SEARCH_API_KEY`) in the Vercel project settings.

The audit API route has `maxDuration = 300` to accommodate the full probe battery within Vercel's function timeout. If audits on large responses consistently time out, the pipeline can be moved to a background job with the UI polling the audit status endpoint (`GET /api/audit/[id]`).

---

## Architecture

```
app/
  page.tsx                  Input form + results view
  api/audit/route.ts        POST — runs the full pipeline
  api/audit/[id]/route.ts   GET  — fetches a stored audit
lib/
  pipeline.ts               Orchestrates the nine pipeline steps
  decompose.ts              Claim extraction (interrogator model)
  adjudicate.ts             Transcript → verdict (adjudicator model)
  score.ts                  computeScore + computeCalibration (pure TS)
  providers.ts              Vercel AI SDK model clients
  prompts.ts                All prompt templates
  probes/                   One file per probe type
db/
  schema.ts                 Drizzle schema (audits, claims, probes, dimension_scores)
  index.ts                  Neon + Drizzle client
```
