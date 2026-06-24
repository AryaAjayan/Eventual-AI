import { z } from 'zod';

export const CanonicalEventSchema = z.object({
  schema_version: z.string().default('1.0'),
  vendor: z.string(),
  product: z.string(),
  model: z.string().nullable().default(null),
  event_timestamp: z.string().datetime(), // ISO 8601
  ingested_at: z.string().datetime(), // ISO 8601
  input_tokens: z.number().int().nullable().default(null),
  output_tokens: z.number().int().nullable().default(null),
  total_tokens: z.number().int().nullable().default(null),
  requests: z.number().int().nullable().default(null),
  cost_amount: z.number().nullable().default(null),
  cost_currency: z.string().default('USD'),
  cost_status: z.enum(['pending', 'resolved']).default('pending'),
  source_user_id: z.string().nullable().default(null),
  source_email: z.string().email().nullable().default(null),
  source_device_id: z.string().nullable().default(null),
  canonical_user_id: z.string().nullable().default(null),
  raw_extra: z.record(z.any()).default({}),
});

export type CanonicalEvent = z.infer<typeof CanonicalEventSchema>;

export const IngestionPayloadSchema = CanonicalEventSchema.omit({ ingested_at: true, canonical_user_id: true }).extend({
  // At ingestion time, we don't know the canonical user ID, and ingested_at is set by the system
});

export type IngestionPayload = z.infer<typeof IngestionPayloadSchema>;
