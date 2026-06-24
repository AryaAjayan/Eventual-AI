import fs from 'fs';
import path from 'path';
import { pipeline } from '../parsers';

const payloadsDir = path.join(__dirname, 'payloads');

const samplePayloads = {
  openai: [
    {
      id: "req_123",
      user_email: "alice@example.com",
      workspace_id: "ws_456",
      timestamp: Math.floor(Date.now() / 1000),
      model: "gpt-4",
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    },
    {
      // Malformed: missing 'model' and 'usage' has wrong type
      id: "req_999",
      user_email: "bad@example.com",
      workspace_id: "ws_456",
      timestamp: Math.floor(Date.now() / 1000),
      usage: { prompt_tokens: "10" } // Drifted type
    }
  ],
  github_copilot: [
    {
      github_id: "gh_alice",
      day: "2023-10-01",
      total_acceptances: 5,
      total_lines_suggested: 50,
      total_lines_accepted: 15
    }
  ],
  custom_gateway: [
    {
      time: new Date().toISOString(),
      client_ip: "192.168.1.1",
      device_id: "dev_macbook_alice",
      routed_to_model: "llama3-8b",
      tokens: { in: 100, out: 50 },
      latency_ms: 240
    }
  ]
};

function ensurePayloadsExist() {
  if (!fs.existsSync(payloadsDir)) {
    fs.mkdirSync(payloadsDir, { recursive: true });
  }

  for (const [vendor, payloads] of Object.entries(samplePayloads)) {
    const vendorDir = path.join(payloadsDir, vendor);
    if (!fs.existsSync(vendorDir)) {
      fs.mkdirSync(vendorDir);
    }
    
    payloads.forEach((payload, idx) => {
      const filePath = path.join(vendorDir, `v1_sample_${idx}.json`);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      }
    });
  }
}

export function runReplayHarness() {
  console.log("=== Starting Replay Harness ===");
  ensurePayloadsExist();

  let total = 0;
  let passed = 0;
  let failed = 0;

  const vendors = fs.readdirSync(payloadsDir);
  for (const vendor of vendors) {
    const vendorDir = path.join(payloadsDir, vendor);
    if (!fs.statSync(vendorDir).isDirectory()) continue;

    const files = fs.readdirSync(vendorDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      total++;
      const filePath = path.join(vendorDir, file);
      const rawPayload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      console.log(`Replaying ${vendor}/${file}...`);
      
      // We only test parsing, not full ingestion, to isolate parser drift
      const result = pipeline.processRawPayload(vendor, rawPayload);
      
      if (result) {
        passed++;
        console.log(`  ✅ Passed. Canonical shape:`, result);
      } else {
        failed++;
        console.log(`  ❌ Failed/Quarantined.`);
      }
    }
  }

  console.log("\n=== Replay Summary ===");
  console.log(`Total: ${total} | Passed: ${passed} | Failed/Quarantined: ${failed}`);
  if (failed > 0) {
    console.error("WARNING: Drift detected in payloads!");
    process.exitCode = 1;
  }
}

// Run if executed directly
if (require.main === module) {
  runReplayHarness();
}
