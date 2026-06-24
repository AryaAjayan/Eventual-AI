import { z } from 'zod';
import { VendorParser } from './index';

// Fake self-hosted LLM gateway log schema (no unique IDs provided per event)
const GatewayLogSchema = z.object({
  time: z.string(), // ISO8601
  client_ip: z.string(),
  device_id: z.string(),
  routed_to_model: z.string(),
  tokens: z.object({
    in: z.number(),
    out: z.number(),
  }),
  latency_ms: z.number()
});

export const GatewayParser: VendorParser<z.infer<typeof GatewayLogSchema>> = {
  vendorName: 'custom_gateway',
  expectedSchema: GatewayLogSchema,
  parse(rawPayload) {
    return {
      schema_version: '1.0',
      vendor: 'custom_gateway',
      product: 'internal_llm_proxy',
      model: rawPayload.routed_to_model,
      event_timestamp: rawPayload.time,
      input_tokens: rawPayload.tokens.in,
      output_tokens: rawPayload.tokens.out,
      total_tokens: rawPayload.tokens.in + rawPayload.tokens.out,
      requests: 1,
      cost_amount: null,
      cost_currency: 'USD',
      cost_status: 'pending',
      source_user_id: null,
      source_email: null,
      source_device_id: rawPayload.device_id,
      raw_extra: { 
        client_ip: rawPayload.client_ip,
        latency_ms: rawPayload.latency_ms
      }
    };
  }
};
