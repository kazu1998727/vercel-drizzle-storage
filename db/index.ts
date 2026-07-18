import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import { createPool } from "./connection";
import { schema } from "./schema";

/**
 * アプリ用の Drizzle インスタンス。
 * サーバーレス環境でのコネクション枯渇を避けるため、ホットリロード時は
 * グローバルにプールを保持して再利用する。
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
