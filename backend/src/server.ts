import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db } from './db';
import { ingestionService } from './services/ingestion';
import { identityService } from './services/identity';
import { metricsService } from './metrics';
import { pipeline } from './parsers';
import { runReplayHarness } from './harness/replay';

const app = Fastify({ logger: true });

app.register(cors, { origin: '*' });

// --- SSE Endpoint for Live Updates ---
app.get('/api/stream', (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  const sendUpdate = () => {
    // We send the current state of metrics, recent log entries, and quarantines
    const metrics = metricsService.getAggregateMetrics();
    const unresolved = metricsService.getUnresolvedSpend();
    
    const logs = db.prepare(`SELECT * FROM canonical_event_log ORDER BY sequence_id DESC LIMIT 10`).all().map((r: any) => ({
      ...r,
      delta: JSON.parse(r.delta)
    }));

    const quarantines = pipeline.getQuarantinedEvents();

    const data = JSON.stringify({ metrics, unresolved, logs, quarantines });
    reply.raw.write(`data: ${data}\n\n`);
  };

  // Initial send
  sendUpdate();

  // Poll for changes every 1 second (simulating push since SQLite triggers don't easily trigger Node events without a separate pubsub)
  const interval = setInterval(sendUpdate, 1000);

  req.raw.on('close', () => {
    clearInterval(interval);
  });
});

// --- Action Endpoints for the Demo Console ---

app.post('/api/actions/inject-redelivered', async (req, reply) => {
  const rawEvent = {
    github_id: "gh_alice",
    day: "2023-10-01",
    total_acceptances: 5,
    total_lines_suggested: 50,
    total_lines_accepted: 15
  };
  // Send the same payload twice to demonstrate idempotency
  await ingestionService.processRawEvent('github_copilot', rawEvent);
  await ingestionService.processRawEvent('github_copilot', rawEvent);
  return { success: true, message: "Injected redelivered Copilot event" };
});

app.post('/api/actions/inject-drifted', async (req, reply) => {
  const badEvent = {
    id: "req_999",
    user_email: "drift@example.com",
    workspace_id: "ws_456",
    timestamp: Math.floor(Date.now() / 1000),
    usage: { prompt_tokens: "10" } // Missing model, prompt_tokens is string instead of number
  };
  await ingestionService.processRawEvent('openai', badEvent);
  return { success: true, message: "Injected schema-drifted OpenAI event" };
});

app.post('/api/actions/backfill-cost', async (req, reply) => {
  // First inject a generic event with no cost
  const rawEvent = {
    time: new Date().toISOString(),
    client_ip: "192.168.1.1",
    device_id: "dev_macbook_alice",
    routed_to_model: "llama3-8b",
    tokens: { in: 100, out: 50 },
    latency_ms: 240
  };
  const dedupKey = await ingestionService.processRawEvent('custom_gateway', rawEvent);
  
  if (dedupKey) {
    // Wait a brief moment to show "pending" state if we were real-time, but here we just schedule it
    setTimeout(() => {
      ingestionService.simulateCostBackfill(dedupKey, 0.15);
    }, 2000);
  }
  return { success: true, message: "Injected event, cost will backfill in 2 seconds" };
});

app.post('/api/actions/unresolved-identity', async (req, reply) => {
  const rawEvent = {
    id: "req_unresolved",
    user_email: "unknown@example.com",
    workspace_id: "ws_1",
    timestamp: Math.floor(Date.now() / 1000),
    model: "gpt-4",
    usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    cost: 5.0
  };
  const dedupKey = await ingestionService.processRawEvent('openai', rawEvent);
  
  // After 3 seconds, we'll "discover" who they are and link it
  setTimeout(() => {
    const canonicalId = identityService.createIdentity('unknown@example.com');
  }, 3000);

  return { success: true, message: "Injected unresolved spend, will resolve in 3 seconds" };
});

export async function startServer() {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Backend server running on http://localhost:3001');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
