import { pipeline } from '../parsers';
import { storageService } from './storage';
import { identityService } from './identity';
import { db } from '../db';

export class IngestionService {
  /**
   * Processes a raw payload from a vendor.
   * 1. Parses it (catching drift)
   * 2. Ingests it to the append-only log idempotently
   * 3. Attempts to resolve identity and logs a resolution event if successful
   */
  async processRawEvent(vendor: string, rawPayload: any): Promise<string | null> {
    const canonicalPayload = pipeline.processRawPayload(vendor, rawPayload);
    
    if (!canonicalPayload) {
      // It was quarantined or failed to parse.
      return null;
    }

    // Identify if there's a unique ID provided by the vendor
    // We embedded it in raw_extra for ChatGPT, or we can just pass null
    const vendorEventId = canonicalPayload.raw_extra?.source_event_id || null;

    // We do this in a single synchronous transaction (if using pg it would be async, but better-sqlite3 is sync)
    // Actually, better to just let them be separate log entries.
    const dedup_key = storageService.ingestEvent(canonicalPayload, vendorEventId);

    // Attempt identity resolution
    const canonicalUserId = identityService.resolveIdentity({
      source_email: canonicalPayload.source_email,
      source_user_id: canonicalPayload.source_user_id,
      source_device_id: canonicalPayload.source_device_id
    });

    if (canonicalUserId) {
      storageService.resolveIdentity(dedup_key, canonicalUserId);
    }

    return dedup_key;
  }

  /**
   * Simulates a billing API backfill
   */
  async simulateCostBackfill(dedup_key: string, costAmount: number, currency: string = 'USD') {
    storageService.updateCost(dedup_key, costAmount, currency);
  }
}

export const ingestionService = new IngestionService();
