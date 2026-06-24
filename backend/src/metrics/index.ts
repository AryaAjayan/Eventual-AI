import { db } from '../db';

export class MetricsService {
  /**
   * The ONE canonical metrics definition. 
   * It aggregates cost, requests, and tokens from the current materialized state.
   * Other views derive from this by supplying dimensions to group by.
   */
  getAggregateMetrics(groupByDimensions: ('vendor' | 'product' | 'canonical_user_id' | 'cost_status')[] = []) {
    const selectFields = [
      'SUM(cost_amount) as total_cost',
      'SUM(input_tokens) as total_input_tokens',
      'SUM(output_tokens) as total_output_tokens',
      'SUM(total_tokens) as total_tokens',
      'SUM(requests) as total_requests'
    ];

    const groupByClause = groupByDimensions.length > 0 
      ? `GROUP BY ${groupByDimensions.join(', ')}` 
      : '';
    
    const selectClause = groupByDimensions.length > 0 
      ? `${groupByDimensions.join(', ')}, ${selectFields.join(', ')}` 
      : selectFields.join(', ');

    const query = `
      SELECT ${selectClause}
      FROM canonical_events_current
      ${groupByClause}
    `;

    const stmt = db.prepare(query);
    return stmt.all();
  }

  // --- Multiple Readers ---

  getPerToolDashboard() {
    return this.getAggregateMetrics(['vendor', 'product']);
  }

  getPerUserDashboard() {
    return this.getAggregateMetrics(['canonical_user_id']);
  }

  getUnresolvedSpend() {
    const query = `
      SELECT SUM(cost_amount) as total_cost 
      FROM canonical_events_current 
      WHERE canonical_user_id IS NULL
    `;
    return db.prepare(query).get();
  }

  getMonthlyTrends() {
    const query = `
      SELECT 
        strftime('%Y-%m', event_timestamp) as month,
        vendor,
        SUM(cost_amount) as total_cost,
        SUM(total_tokens) as total_tokens
      FROM canonical_events_current
      GROUP BY month, vendor
      ORDER BY month ASC
    `;
    return db.prepare(query).all();
  }
}

export const metricsService = new MetricsService();
