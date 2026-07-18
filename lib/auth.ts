import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db, schema } from "@/db";

/**
 * ベースURLを決定する。
 * - 明示指定の BETTER_AUTH_URL を最優先。
 * - Vercel では本番ドメイン（VERCEL_PROJECT_PRODUCTION_URL）を使う。
 * - ローカルは未指定（Better Auth が http://localhost:3000 を既定にする）。
 */
function getBaseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return undefined;
}

// プレビューデプロイ等、ベースURL以外のオリジンからのリクエストを許可する。
const trustedOrigins = [
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
].filter((v): v is string => Boolean(v));

export const auth = betterAuth({
  // secret は BETTER_AUTH_SECRET から自動で読まれる。本番では必須。
  baseURL: getBaseURL(),
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // メール + パスワード認証を有効化（最低限の構成）。
  emailAndPassword: {
    enabled: true,
  },
  // OAuth を追加する場合はここに設定する。
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID!,
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  //   },
  // },
  // nextCookies は必ずプラグイン配列の最後に置く。
  // サーバーアクションで Set-Cookie を自動処理するために必要。
  plugins: [nextCookies()],
});
