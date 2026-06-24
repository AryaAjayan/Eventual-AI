import { db } from '../db';
import { ingestionService } from '../services/ingestion';
import { storageService } from '../services/storage';
import { identityService } from '../services/identity';
import { metricsService } from '../metrics';

// Clear DB before tests
beforeEach(() => {
  db.exec('DELETE FROM identity_aliases;');
  db.exec('DELETE FROM identities;');
  db.exec('DELETE FROM canonical_events_current;');
  db.exec('DELETE FROM canonical_event_log;');
});

describe('Canonical Event Engine', () => {

  test('Requirement #2 & #6: Late-arriving cost and Append-only Storage', async () => {
    // 1. Ingest event without cost
    const rawEvent = {
      id: "req_late_cost",
      user_email: "bob@example.com",
      workspace_id: "ws_1",
      timestamp: Math.floor(Date.now() / 1000),
      model: "gpt-4",
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
    };
    
    const dedupKey = await ingestionService.processRawEvent('openai', rawEvent);
    expect(dedupKey).toBeDefined();

    let state = storageService.getEventState(dedupKey!);
    expect(state.cost_amount).toBeNull();
    expect(state.cost_status).toBe('pending');

    // 2. Simulate late-arriving cost backfill
    await ingestionService.simulateCostBackfill(dedupKey!, 0.05);

    // 3. Verify state
    state = storageService.getEventState(dedupKey!);
    expect(state.cost_amount).toBe(0.05);
    expect(state.cost_status).toBe('resolved');

    // 4. Verify append-only log has 2 entries (INGEST and UPDATE_COST)
    const logRows = db.prepare(`SELECT * FROM canonical_event_log WHERE dedup_key = ?`).all(dedupKey);
    expect(logRows.length).toBe(2);
    expect((logRows[0] as any).action).toBe('INGEST');
    expect((logRows[1] as any).action).toBe('UPDATE_COST');
  });

  test('Requirement #3: Deterministic dedup across redelivery', async () => {
    const rawEvent = {
      github_id: "gh_bob",
      day: "2023-10-01",
      total_acceptances: 5,
      total_lines_suggested: 50,
      total_lines_accepted: 15
    };

    // Ingest 3 times (simulating redelivery)
    await ingestionService.processRawEvent('github_copilot', rawEvent);
    await ingestionService.processRawEvent('github_copilot', rawEvent);
    const dedupKey = await ingestionService.processRawEvent('github_copilot', rawEvent);

    // Should only be one row in the materialized view
    const viewRows = db.prepare(`SELECT * FROM canonical_events_current`).all();
    expect(viewRows.length).toBe(1);

    // Cost/usage not double counted
    const metrics = metricsService.getAggregateMetrics();
    expect(metrics[0].total_requests).toBe(5); // Not 15!
  });

  test('Requirement #4: Identity resolution and Unresolved spend', async () => {
    // 1. Ingest an event for "gh_charlie" (unresolved)
    await ingestionService.processRawEvent('github_copilot', {
      github_id: "gh_charlie",
      day: "2023-10-02",
      total_acceptances: 10,
      total_lines_suggested: 100,
      total_lines_accepted: 30
    });

    // 2. Add some cost so it's not null (Copilot doesn't emit cost by default, so we mock backfill)
    const stateRow = db.prepare(`SELECT dedup_key FROM canonical_events_current`).get() as any;
    await ingestionService.simulateCostBackfill(stateRow.dedup_key, 10.0);

    let unresolved = metricsService.getUnresolvedSpend() as any;
    expect(unresolved.total_cost).toBe(10.0);

    // 3. Create Identity and link it (provable edge)
    const canonicalId = identityService.createIdentity('charlie@company.com');
    identityService.linkAlias('vendor_user_id', 'gh_charlie', canonicalId);

    // 4. Verify it is now resolved retroactively
    unresolved = metricsService.getUnresolvedSpend() as any;
    expect(unresolved.total_cost).toBeNull(); // No unresolved spend left

    const stateAfter = storageService.getEventState(stateRow.dedup_key);
    expect(stateAfter.canonical_user_id).toBe(canonicalId);
  });

  test('Requirement #7: One metrics definition, multiple readers', async () => {
    // Seed some data
    await ingestionService.processRawEvent('openai', {
      id: "r1", user_email: "a@test.com", workspace_id: "w1", timestamp: 100, model: "gpt-4",
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }, cost: 1.0
    });
    await ingestionService.processRawEvent('openai', {
      id: "r2", user_email: "b@test.com", workspace_id: "w1", timestamp: 100, model: "gpt-4",
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }, cost: 2.0
    });
    
    // Per tool (OpenAI)
    const toolMetrics = metricsService.getPerToolDashboard() as any[];
    const openaiTotal = toolMetrics.find(m => m.vendor === 'openai').total_cost;
    expect(openaiTotal).toBe(3.0);

    // Overall Total (from base aggregate without group by)
    const overallMetrics = metricsService.getAggregateMetrics() as any[];
    expect(overallMetrics[0].total_cost).toBe(3.0);

    // They perfectly agree because they use the exact same SELECT SUM() fields
    expect(openaiTotal).toBe(overallMetrics[0].total_cost);
  });

});
