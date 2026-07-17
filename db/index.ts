import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL が設定されていません。.env を確認してください。");
}

/**
 * Amazon Aurora PostgreSQL への接続プール。
 * サーバーレス環境（Vercel）でのコネクション枯渇を避けるため、
 * ホットリロード時にプールを使い回す。
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Aurora は TLS 接続が必須。ローカルの Postgres で試す場合は
    // DATABASE_URL に ?sslmode=disable を付けるか、この行を調整する。
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
