import { z } from 'zod';
import { VendorParser } from './index';

// Fake ChatGPT Enterprise usage export schema
const ChatGPTExportSchema = z.object({
  id: z.string(),
  user_email: z.string().email(),
  workspace_id: z.string(),
  timestamp: z.number(), // Unix timestamp
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }),
  cost: z.number().optional() // Sometimes cost is missing at ingest
});

export const ChatGPTParser: VendorParser<z.infer<typeof ChatGPTExportSchema>> = {
  vendorName: 'openai',
  expectedSchema: ChatGPTExportSchema,
  parse(rawPayload) {
    return {
      schema_version: '1.0',
      vendor: 'openai',
      product: 'chatgpt_enterprise',
      model: rawPayload.model,
      event_timestamp: new Date(rawPayload.timestamp * 1000).toISOString(),
      input_tokens: rawPayload.usage.prompt_tokens,
      output_tokens: rawPayload.usage.completion_tokens,
      total_tokens: rawPayload.usage.total_tokens,
      requests: 1,
      cost_amount: rawPayload.cost ?? null,
      cost_currency: 'USD',
      cost_status: rawPayload.cost !== undefined ? 'resolved' : 'pending',
      source_user_id: null,
      source_email: rawPayload.user_email,
      source_device_id: null,
      raw_extra: { workspace_id: rawPayload.workspace_id, source_event_id: rawPayload.id }
    };
  }
};
