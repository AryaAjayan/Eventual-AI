import { z } from 'zod';
import { VendorParser } from './index';

// Fake Copilot usage API response schema
const CopilotUsageSchema = z.object({
  github_id: z.string(),
  day: z.string(), // YYYY-MM-DD
  total_acceptances: z.number(),
  total_lines_suggested: z.number(),
  total_lines_accepted: z.number(),
  active_users: z.number().optional() // Some aggregate fields we might get
});

export const CopilotParser: VendorParser<z.infer<typeof CopilotUsageSchema>> = {
  vendorName: 'github_copilot',
  expectedSchema: CopilotUsageSchema,
  parse(rawPayload) {
    return {
      schema_version: '1.0',
      vendor: 'github_copilot',
      product: 'copilot_for_business',
      model: null,
      event_timestamp: new Date(`${rawPayload.day}T00:00:00Z`).toISOString(),
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      requests: rawPayload.total_acceptances,
      cost_amount: null, // Copilot is usually billed monthly per seat, not per event
      cost_currency: 'USD',
      cost_status: 'pending',
      source_user_id: rawPayload.github_id,
      source_email: null,
      source_device_id: null,
      raw_extra: { 
        lines_suggested: rawPayload.total_lines_suggested,
        lines_accepted: rawPayload.total_lines_accepted
      }
    };
  }
};
