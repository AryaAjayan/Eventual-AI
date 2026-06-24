import { db } from '../db';
import { CanonicalEvent, IngestionPayload } from '../domain/CanonicalEvent';
import crypto from 'crypto';

export function generateDedupKey(vendor: string, vendorEventId?: string | null, payload?: IngestionPayload): string {
  if (vendorEventId) {
    return crypto.createHash('sha256').update(`${vendor}:${vendorEventId}`).digest('hex');
  }
  if (payload) {
    const date = new Date(payload.event_timestamp);
    const ts = Math.floor(date.getTime() / 1000); // truncate to seconds
    const data = `${vendor}:${ts}:${payload.source_user_id || 'unknown'}:${payload.total_tokens || 0}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  throw new Error("Cannot generate dedup key without vendorEventId or payload");
}

export class StorageService {
  ingestEvent(payload: IngestionPayload, vendorEventId?: string | null) {
    const dedup_key = generateDedupKey(payload.vendor, vendorEventId, payload);
    
    const fullEvent: CanonicalEvent = {
      ...payload,
      ingested_at: new Date().toISOString(),
      canonical_user_id: null,
    };

    const stmt = db.prepare(`INSERT INTO canonical_event_log (dedup_key, action, delta) VALUES (?, ?, ?)`);
    stmt.run(dedup_key, 'INGEST', JSON.stringify(fullEvent));

    return dedup_key;
  }

  updateCost(dedup_key: string, costAmount: number, costCurrency: string = 'USD') {
    const delta = {
      cost_amount: costAmount,
      cost_currency: costCurrency,
      cost_status: 'resolved'
    };

    const stmt = db.prepare(`INSERT INTO canonical_event_log (dedup_key, action, delta) VALUES (?, ?, ?)`);
    stmt.run(dedup_key, 'UPDATE_COST', JSON.stringify(delta));
  }

  resolveIdentity(dedup_key: string, canonicalUserId: string) {
    const delta = {
      canonical_user_id: canonicalUserId
    };

    const stmt = db.prepare(`INSERT INTO canonical_event_log (dedup_key, action, delta) VALUES (?, ?, ?)`);
    stmt.run(dedup_key, 'RESOLVE_IDENTITY', JSON.stringify(delta));
  }

  getEventState(dedup_key: string): any {
    const stmt = db.prepare(`SELECT * FROM canonical_events_current WHERE dedup_key = ?`);
    const row = stmt.get(dedup_key);
    if (row && (row as any).raw_extra) {
      (row as any).raw_extra = JSON.parse((row as any).raw_extra);
    }
    return row || null;
  }
}

export const storageService = new StorageService();
