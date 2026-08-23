import { Diagnostics } from '@/lib/diagnostics';

interface IdempotencyRecord {
  id: string;
  response: any;
  processed_at: number;
}

class IdempotencyLedger {
  private cache: Map<string, IdempotencyRecord> = new Map();
  private ttlMs: number = 24 * 60 * 60 * 1000; // 24 hours retention

  /**
   * Checks if an event ID or webhook payload signature has already been processed.
   */
  has(key: string): boolean {
    const record = this.cache.get(key);
    if (!record) return false;
    if (Date.now() - record.processed_at > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  get(key: string): IdempotencyRecord | undefined {
    return this.cache.get(key);
  }

  record(key: string, response: any): void {
    this.cache.set(key, {
      id: key,
      response,
      processed_at: Date.now(),
    });
    Diagnostics.info(`Idempotency key recorded: ${key}`, { component: 'IdempotencyLedger' });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const idempotencyLedger = new IdempotencyLedger();
