import { Signer } from "@aws-sdk/rds-signer";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { Pool } from "pg";

/**
 * Aurora PostgreSQL への pg Pool を生成する。
 *
 * - DATABASE_URL があればそれを使う（ローカルの Postgres 等）。
 * - それ以外は Vercel の AWS Aurora 統合が注入する PG* / AWS_* 環境変数で
 *   RDS IAM 認証を行う。AWS 認証情報は Vercel の OIDC トークンを STS で
 *   交換して取得する（awsCredentialsProvider）。パスワードの代わりに 15 分
 *   有効の一時トークンを、接続確立ごとに生成する。
 */
export function createPool(): Pool {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const database = process.env.PGDATABASE;
  const region = process.env.AWS_REGION;
  const roleArn = process.env.AWS_ROLE_ARN;

  if (!host || !user || !database || !region) {
    throw new Error(
      "DB接続情報が不足しています。DATABASE_URL、または PGHOST / PGUSER / PGDATABASE / AWS_REGION を設定してください。",
    );
  }

  const port = Number(process.env.PGPORT ?? 5432);

  const signer = new Signer({
    hostname: host,
    port,
    username: user,
    region,
    // Vercel 上では OIDC 連携で得た資格情報を使う（環境変数のアクセスキーは無い）。
    // ローカル等で AWS_ROLE_ARN が無ければ AWS SDK 既定のプロバイダチェーンに委ねる。
    ...(roleArn ? { credentials: awsCredentialsProvider({ roleArn }) } : {}),
  });

  return new Pool({
    host,
    port,
    user,
    database,
    // Aurora は TLS 必須。厳密な CA 検証を行う場合は RDS のグローバル CA
    // バンドルを ssl.ca に渡す。
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    password: () => signer.getAuthToken(),
  });
}
