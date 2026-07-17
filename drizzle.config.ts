import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit の CLI は Next.js の外で動くため、明示的に .env を読み込む。
config({ path: ".env" });

/**
 * 接続情報を環境変数から組み立てる。
 * - DATABASE_URL があればそれを優先（ローカルの Postgres など）。
 * - なければ libpq 標準の PG* 変数を使う（Aurora + IAM 認証の構成）。
 *   IAM 認証ではパスワードの代わりに一時トークンを PGPASSWORD として渡す。
 * - どちらも無い場合は接続不要コマンド（generate など）向けの空設定を返す。
 */
function dbCredentials() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL };
  }

  if (process.env.PGHOST) {
    return {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? "postgres",
      password: process.env.PGPASSWORD ?? "",
      database: process.env.PGDATABASE ?? "postgres",
      // Aurora は TLS 必須。厳密な CA 検証を行う場合は RDS のグローバル CA
      // バンドルを渡す（README 参照）。ここでは接続の成立を優先している。
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    };
  }

  return { url: "" };
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: dbCredentials(),
  verbose: true,
  strict: true,
});
