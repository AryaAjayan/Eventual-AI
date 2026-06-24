import Database, { Database as BetterSqlite3Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(__dirname, '../../data.db');
const schemaPath = path.join(__dirname, 'schema.sql');

export const db: BetterSqlite3Database = new Database(dbPath, { verbose: console.log });

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema if not exists
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Helper for running transactions
export async function withTransaction<T>(clientAction: () => Promise<T> | T): Promise<T> {
  const runTransaction = db.transaction(() => {
    return clientAction();
  });
  // Since better-sqlite3 is synchronous, we can just await the result if it's a promise,
  // but technically db.transaction runs synchronously. If clientAction is async, 
  // it doesn't wait for promises. So we shouldn't use async inside better-sqlite3 transactions.
  // We'll adjust our services to be synchronous where possible, or just not use transactions for now
  // since our main writes are single INSERTS into the log table.
  return await runTransaction();
}

export function runInTransaction<T>(fn: () => T): T {
  const transaction = db.transaction(fn);
  return transaction();
}
