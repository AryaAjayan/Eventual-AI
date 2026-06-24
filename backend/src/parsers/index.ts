import { z } from 'zod';
import { db } from '../db';
import { IngestionPayload } from '../domain/CanonicalEvent';

export interface VendorParser<T = any> {
  vendorName: string;
  expectedSchema: z.ZodType<T>;
  parse(rawPayload: T): IngestionPayload;
}

export class IngestionPipeline {
  private parsers: Map<string, VendorParser> = new Map();

  registerParser(parser: VendorParser) {
    this.parsers.set(parser.vendorName, parser);
  }

  processRawPayload(vendor: string, rawPayload: any): IngestionPayload | null {
    const parser = this.parsers.get(vendor);
    if (!parser) {
      this.quarantine(vendor, rawPayload, `No parser found for vendor: ${vendor}`);
      return null;
    }

    try {
      // 1. Detect structural drift
      const validatedRaw = parser.expectedSchema.parse(rawPayload);
      
      // 2. Map to canonical shape
      const canonical = parser.parse(validatedRaw);
      return canonical;
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        // Drift detected!
        const reason = `Schema Drift Detected: ${(err as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
        console.error(`[ALERT] ${reason}`);
        this.quarantine(vendor, rawPayload, reason);
        return null;
      }
      
      this.quarantine(vendor, rawPayload, `Parsing failed: ${err.message}`);
      return null;
    }
  }

  private quarantine(vendor: string, payload: any, reason: string) {
    const stmt = db.prepare(`INSERT INTO quarantined_events (vendor, payload, error_reason) VALUES (?, ?, ?)`);
    stmt.run(vendor, JSON.stringify(payload), reason);
  }

  getQuarantinedEvents() {
    const stmt = db.prepare(`SELECT * FROM quarantined_events WHERE status = 'pending'`);
    return stmt.all().map((row: any) => {
      row.payload = JSON.parse(row.payload);
      return row;
    });
  }

  markQuarantineResolved(id: number) {
    const stmt = db.prepare(`UPDATE quarantined_events SET status = 'resolved' WHERE id = ?`);
    stmt.run(id);
  }
}

export const pipeline = new IngestionPipeline();

import { ChatGPTParser } from './chatgpt';
import { CopilotParser } from './copilot';
import { GatewayParser } from './gateway';

pipeline.registerParser(ChatGPTParser);
pipeline.registerParser(CopilotParser);
pipeline.registerParser(GatewayParser);
