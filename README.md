# Eventual AI

A real-time FinOps-for-AI observability system. This engine ingests usage and cost data from various AI vendors, maps it to a canonical schema, and provides a stable, unified truth layer for querying spend and usage, even when events are redelivered, schemas drift, or costs arrive late.

## Getting Started

Everything runs locally with a single command (using SQLite for local testability without Docker dependencies).

```bash
# 1. Install dependencies at the root
npm install

# 2. Run the tests (verifies requirements 2, 3, 4, 7)
npm run test

# 3. Start the Backend Server and UI Console concurrently
npm start
```
The UI will open at `http://localhost:5173`. You can interact with the system via the Control Panel to inject events, drift, and redeliveries, and watch the system resolve them live over SSE.

---

## How the 7 Requirements Are Addressed

### 1. The Canonical Event Schema
**Where to look:** `backend/src/domain/CanonicalEvent.ts`

The canonical schema normalizes standard fields (tokens, requests, vendor, cost) and pushes vendor-specific noise into a typed `raw_extra` object.

**Tradeoffs made:**
- **Denormalized Usage vs Generic Array:** I chose to promote `input_tokens`, `output_tokens`, and `requests` to top-level integer columns instead of a generic array of `usage: {metric, value}`. While less mathematically flexible, it allows relational databases and BI tools to aggregate 99% of FinOps use cases exponentially faster. The 1% of exotic usage goes to `raw_extra`.
- **Loose Coupling of Cost:** Cost is explicitly nullable and separated from ingestion to reflect reality: usage is a low-latency event, billing is a high-latency reconciliation.

### 2. Late-Arriving and Revisable Facts on a Stable Key
**Where to look:** `backend/src/services/storage.ts` and `backend/src/tests/core.test.ts`

Cost is often unknown at ingest. The system handles this using a deterministic `dedup_key` that links new facts back to the original event. 
- **Dedup Key Justification:** We never include mutable facts (like cost or resolved identity) in the key. If a vendor supplies a unique ID, the key is `hash(vendor + id)`. If not (like our custom gateway parser), the key is `hash(vendor + timestamp + user + total_tokens)`.
- **Test Proof:** See the `Late-arriving cost` test block in `core.test.ts`. It ingests an event with null cost, simulates a billing backfill, and asserts the cost is updated correctly without duplicating the event.

### 3. Deterministic Dedup Across Redelivery
**Where to look:** `backend/src/services/ingestion.ts` and `backend/src/tests/core.test.ts`

If a vendor webhooks the same payload three times, the system will only record it logically once. Because the `dedup_key` is completely deterministic, the `INSERT ... ON CONFLICT DO NOTHING` trigger immediately swallows the duplicate at the materialized view layer.
- **Test Proof:** The `Deterministic dedup` test explicitly calls ingest 3 times with the exact same Copilot payload, and proves `metricsService.getAggregateMetrics()` only counts it once.

### 4. Identity Resolution without False Confidence
**Where to look:** `backend/src/services/identity.ts`

The system maintains a rigid separation between "vendor claims" (e.g. `source_device_id`) and "canonical truth" (`canonical_user_id`). 
- When an event arrives without a known explicit mapping, `canonical_user_id` is left explicitly `null` (unresolved).
- When a provable edge is established (e.g., an explicit SSO linking email to vendor ID via `linkAlias()`), the system retroactively resolves past events.
- **Test Proof:** See the `Identity resolution` test, which verifies that spend attributed to an unknown user is bucketed as Unresolved Spend, until a provable link is created.

### 5. Parsers that Fail Loud, not Silent
**Where to look:** `backend/src/parsers/index.ts` and `backend/src/harness/replay.ts`

There are 3 fake parsers (OpenAI, Copilot, Custom Gateway) built using Zod schemas.
- **Drift Detection:** If an API changes its shape (e.g., `prompt_tokens` becomes a string, or `model` disappears), `Zod` throws synchronously.
- **Quarantine:** The pipeline catches this, alerts, and saves the raw payload to the `quarantined_events` table for later replay, returning `null` so the bad data never taints the canonical log.
- **Replay Harness:** Run `npm run replay` to execute the CLI tool. It pulls sample payloads from `backend/src/harness/payloads/` through the current pipeline, reporting passes and quarantine failures, acting as a regression safety net before deployments.

### 6. Append-Only Store That Doesn't Lie
**Where to look:** `backend/src/db/schema.sql`

We reconcile "append-only log" with "mutable facts" using Event Sourcing via database triggers.
- Every write goes exclusively as an `INSERT` to `canonical_event_log` with an action verb (`INGEST`, `UPDATE_COST`, `RESOLVE_IDENTITY`).
- A trigger `AFTER INSERT ON canonical_event_log` synchronously folds the delta into the `canonical_events_current` materialized table.
- **Tradeoff:** I used `better-sqlite3` instead of Postgres for local testability without Docker, but the architectural pattern (append log + fold trigger) is identical to what a Postgres implementation would use.

### 7. One Metrics Definition, Multiple Readers
**Where to look:** `backend/src/metrics/index.ts`

Both the UI's top-level summary numbers and the per-tool breakdowns are powered by a single underlying base query in `MetricsService.getAggregateMetrics()`.
- **Proof:** The `getPerToolDashboard()` simply calls the base aggregator with `GROUP BY vendor, product`, while the summary uses no `GROUP BY`.
- **Test Proof:** The `One metrics definition` test verifies that the sum of the per-tool slices equals the overall summary exactly, proving they share the same source of truth.
