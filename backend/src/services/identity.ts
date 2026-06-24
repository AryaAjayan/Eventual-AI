import { db } from '../db';
import { storageService } from './storage';
import crypto from 'crypto';

export class IdentityService {
  resolveIdentity(identifiers: {
    source_email?: string | null;
    source_user_id?: string | null;
    source_device_id?: string | null;
  }): string | null {
    const clauses: string[] = [];
    const values: any[] = [];
    
    if (identifiers.source_email) {
      clauses.push(`(alias_type = 'email' AND alias_value = ?)`);
      values.push(identifiers.source_email);
    }
    if (identifiers.source_user_id) {
      clauses.push(`(alias_type = 'vendor_user_id' AND alias_value = ?)`);
      values.push(identifiers.source_user_id);
    }
    if (identifiers.source_device_id) {
      clauses.push(`(alias_type = 'device_id' AND alias_value = ?)`);
      values.push(identifiers.source_device_id);
    }

    if (clauses.length === 0) return null;

    const query = `
      SELECT canonical_user_id 
      FROM identity_aliases 
      WHERE ${clauses.join(' OR ')}
      LIMIT 1
    `;

    const stmt = db.prepare(query);
    const row = stmt.get(...values) as { canonical_user_id: string } | undefined;
    
    if (row) {
      return row.canonical_user_id;
    }

    return null;
  }

  createIdentity(primaryEmail: string): string {
    const canonicalId = crypto.randomUUID();
    const stmt = db.prepare(`INSERT INTO identities (canonical_user_id, primary_email) VALUES (?, ?)`);
    stmt.run(canonicalId, primaryEmail);
    this.linkAlias('email', primaryEmail, canonicalId);
    return canonicalId;
  }

  linkAlias(aliasType: 'email' | 'vendor_user_id' | 'device_id', aliasValue: string, canonicalUserId: string) {
    const stmt = db.prepare(`
      INSERT INTO identity_aliases (alias_type, alias_value, canonical_user_id) 
      VALUES (?, ?, ?)
      ON CONFLICT (alias_type, alias_value) DO NOTHING
    `);
    stmt.run(aliasType, aliasValue, canonicalUserId);

    this.retroactiveResolve(aliasType, aliasValue, canonicalUserId);
  }

  private retroactiveResolve(aliasType: string, aliasValue: string, canonicalUserId: string) {
    let column = '';
    if (aliasType === 'email') column = 'source_email';
    else if (aliasType === 'vendor_user_id') column = 'source_user_id';
    else if (aliasType === 'device_id') column = 'source_device_id';
    else return;

    const stmt = db.prepare(`
      SELECT dedup_key FROM canonical_events_current 
      WHERE ${column} = ? AND canonical_user_id IS NULL
    `);
    
    const rows = stmt.all(aliasValue) as { dedup_key: string }[];

    for (const row of rows) {
      storageService.resolveIdentity(row.dedup_key, canonicalUserId);
    }
  }
}

export const identityService = new IdentityService();
