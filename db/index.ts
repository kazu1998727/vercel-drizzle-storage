import { Signer } from "@aws-sdk/rds-signer";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema";

/**
 * Aurora PostgreSQL への接続。
 *
 * - ローカル等で DATABASE_URL がある場合はそれをそのまま使う。
 * - それ以外は Vercel の AWS Aurora 統合が注入する PG* / AWS_* 環境変数を使い、
 *   RDS IAM 認証でパスワードの代わりに一時トークンを生成して接続する。
 *   トークンは約15分で失効するため、接続確立ごとに毎回生成する
 *   （node-postgres の password は関数を受け付け、新規接続時に評価される）。
 */
function createPool(): Pool {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;
  const region = process.env.AWS_REGION;

  if (!host || !user || !database || !region) {
    throw new Error(
      "DB接続情報が不足しています。DATABASE_URL、または PGHOST / PGUSER / PGDATABASE / AWS_REGION を設定してください。",
    );
  }

  const port = Number(process.env.PGPORT ?? 5432);

  // 認証情報は AWS SDK の標準プロバイダチェーンから解決される。
  // Vercel の OIDC 連携では AWS_ROLE_ARN + Web Identity Token 経由で
  // ロールが引き受けられる。
  const signer = new Signer({ hostname: host, port, username: user, region });

  return new Pool({
    host,
    port,
    user,
    database,
    // Aurora は TLS 必須。厳密な CA 検証を行う場合は RDS のグローバル CA
    // バンドルを ssl.ca に渡す。
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    // IAM 認証トークンをパスワードとして毎接続時に生成する。
    password: () => signer.getAuthToken(),
  });
}

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
