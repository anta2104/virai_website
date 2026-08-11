import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type DB = DrizzleD1Database<typeof schema>;

const cache = new WeakMap<D1Database, DB>();

/** Bọc binding D1 bằng Drizzle, cache theo binding để không tạo lại mỗi request. */
export function getDb(d1: D1Database): DB {
  const existing = cache.get(d1);
  if (existing) return existing;
  const db = drizzle(d1, { schema });
  cache.set(d1, db);
  return db;
}

export * as tables from './schema';
export { schema };
