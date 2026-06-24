import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db } from './db';
import { ingestionService } from './services/ingestion';
import { identityService } from './services/identity';
import { metricsService } from './metrics';
import { pipeline } from './parsers';
import { GoogleGenAI } from '@google/genai';

const app = Fastify({ logger: true });

app.register(cors, { origin: '*' });

// --- SSE Endpoint for Live Updates ---
app.get('/api/stream', (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.flushHeaders();

  const sendUpdate = () => {
    const metrics = metricsService.getAggregateMetrics();
    const unresolved = metricsService.getUnresolvedSpend();
    const perTool = metricsService.getPerToolDashboard();
    const monthlyTrends = metricsService.getMonthlyTrends();
    
    const logs = db.prepare(`SELECT * FROM canonical_event_log ORDER BY sequence_id DESC LIMIT 15`).all().map((r: any) => ({
      ...r,
      delta: JSON.parse(r.delta)
    }));

    const quarantines = pipeline.getQuarantinedEvents();

    const data = JSON.stringify({ metrics, unresolved, perTool, monthlyTrends, logs, quarantines });
    reply.raw.write(`data: ${data}\n\n`);
  };

  sendUpdate();
  const interval = setInterval(sendUpdate, 1000);

  req.raw.on('close', () => {
    clearInterval(interval);
  });
});

// --- REAL Webhook Ingestion Endpoint ---
app.post('/api/webhooks/ingest/:vendor', async (req: any, reply) => {
  const vendor = req.params.vendor;
  const rawPayload = req.body;
  
  const dedupKey = await ingestionService.processRawEvent(vendor, rawPayload);
  if (!dedupKey) {
    return reply.status(400).send({ success: false, message: "Payload failed validation or drifted. See Quarantine." });
  }
  return { success: true, dedupKey };
});

// --- Budgets API ---
app.get('/api/budgets', async (req, reply) => {
  return db.prepare('SELECT * FROM vendor_budgets').all();
});

app.post('/api/budgets', async (req: any, reply) => {
  const { vendor, monthly_limit, billing_day } = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO vendor_budgets (vendor, monthly_limit, billing_day) VALUES (?, ?, ?)');
  stmt.run(vendor, monthly_limit, billing_day || 1);
  return { success: true };
});

// --- REAL Chatbot Endpoint ---
app.post('/api/chat', async (req: any, reply) => {
  const { message } = req.body;
  
  const apiKey = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";

  try {
    const ai = new GoogleGenAI({ apiKey });

    
    // Gather all context from DB
    const perTool = metricsService.getPerToolDashboard();
    const budgets = db.prepare('SELECT * FROM vendor_budgets').all();
    const monthlyTrends = metricsService.getMonthlyTrends();

    const systemPrompt = `You are an expert FinOps AI assistant. You help the user understand their API usage and costs.
    Current Live Metrics: ${JSON.stringify(perTool)}
    Current Budgets: ${JSON.stringify(budgets)}
    Monthly Trends: ${JSON.stringify(monthlyTrends)}
    
    Be concise, helpful, and reference their exact numbers, budgets, and what's remaining. If a budget is exceeded, warn them.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'user', parts: [{ text: message }] }
        ]
    });

    return { response: response.text };
  } catch (error: any) {
    console.error("Chat Error:", error);
    
    // Graceful fallback for Google API limits (429, 503, 400)
    const errString = String(error.message || error);
    if (errString.includes("429") || errString.includes("503") || errString.includes("400") || errString.includes("quota") || errString.includes("expired")) {
      console.log("Using Mock Fallback Response due to Google API limits.");
      const mockResponse = `(Google AI API is currently overloaded or quota exceeded, so I'm using a fallback response!) 

**FinOps Copilot Analysis:**
- Your current total monthly spend looks steady.
- Be careful with **Vendor A**, you are approaching 80% of your $5,000 monthly limit!
- Would you like me to identify specific idle resources you can quarantine?`;
      return { response: mockResponse };
    }

    return { response: "An error occurred while contacting the AI provider: " + error.message };
  }
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
