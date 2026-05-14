import * as SQLite from 'expo-sqlite';
import type { SQLiteBindParams } from 'expo-sqlite';
import type { DbAdapter } from '@/repository/db/DbAdapter';

export class ExpoSqliteAdapter implements DbAdapter {
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(databaseName: string): Promise<ExpoSqliteAdapter> {
    const db = await SQLite.openDatabaseAsync(databaseName);
    return new ExpoSqliteAdapter(db);
  }

  async execAsync(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async runAsync(sql: string, params: readonly unknown[]): Promise<void> {
    await this.db.runAsync(sql, params as SQLiteBindParams);
  }

  async getAllAsync<T>(sql: string, params: readonly unknown[]): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params as SQLiteBindParams);
  }

  async getFirstAsync<T>(sql: string, params: readonly unknown[]): Promise<T | null> {
    const result = await this.db.getFirstAsync<T>(sql, params as SQLiteBindParams);
    return result ?? null;
  }
}
