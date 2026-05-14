export interface DbAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: readonly unknown[]): Promise<void>;
  getAllAsync<T>(sql: string, params: readonly unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: readonly unknown[]): Promise<T | null>;
}
