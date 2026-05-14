import Database from 'better-sqlite3';
import type { DbAdapter } from '@/repository/db/DbAdapter';

export class BetterSqliteAdapter implements DbAdapter {
  private readonly db: Database.Database;

  constructor(filePath: string = ':memory:') {
    this.db = new Database(filePath);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params: readonly unknown[]): Promise<void> {
    this.db.prepare(sql).run(...(params as unknown[]));
  }

  async getAllAsync<T>(sql: string, params: readonly unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as unknown[])) as T[];
  }

  async getFirstAsync<T>(sql: string, params: readonly unknown[]): Promise<T | null> {
    const result = this.db.prepare(sql).get(...(params as unknown[]));
    return (result ?? null) as T | null;
  }

  close(): void {
    this.db.close();
  }
}
