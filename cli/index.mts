import { Signer } from "@aws-sdk/rds-signer";
import { Client } from "pg";

const HOST =
  "aws-vercel-db.cluster-c9qe8u0q0us1.ap-northeast-1.rds.amazonaws.com";
const PORT = 5432;
const REGION = "ap-northeast-1";
const USER = "postgres";
const DATABASE = "postgres";

async function main() {
  console.log("[1/3] IAM 認証トークンを生成中...");
  const signer = new Signer({
    hostname: HOST,
    port: PORT,
    username: USER,
    region: REGION,
  });

  let password: string;
  try {
    password = await signer.getAuthToken();
  } catch (error) {
    console.error(
      "[x] トークン生成に失敗（AWS 認証情報が解決できていない可能性）:",
      error,
    );
    throw error;
  }
  console.log(`[1/3] トークン取得OK（長さ ${password.length}）`);

  console.log("[2/3] DB へ接続中...");
  const client = new Client({
    host: HOST,
    port: PORT,
    database: DATABASE,
    user: USER,
    password,
    ssl: { rejectUnauthorized: false },
    // ネットワーク到達不可の場合に無限に待たず、10秒で失敗させる。
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    console.log("[3/3] 接続成功。バージョンを取得します。");
    const res = await client.query("SELECT version()");
    console.log(res.rows[0].version);
  } catch (error) {
    console.error("[x] DB エラー:", error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("実行に失敗しました:", error);
  process.exit(1);
});
