// ローカル実行時に .env を読み込む（Vercel では環境変数が直接注入されるため
// .env は存在せず、その場合は何もしない）。
import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createPool } from "./connection";

/**
 * drizzle/ にコミット済みのマイグレーションを適用する。
 * アプリ本体と同じ接続方式（Vercel OIDC + RDS IAM）を使うため、
 * Vercel のビルド/実行環境でそのまま動く。
 *
 * 実行: `tsx db/migrate.ts`
 */
async function main() {
  const pool = createPool();
  const db = drizzle(pool);

  console.log("マイグレーションを適用します...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("マイグレーション完了。");

  await pool.end();
}

main().catch((error) => {
  console.error("マイグレーションに失敗しました:", error);
  process.exit(1);
});
