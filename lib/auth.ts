import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db, schema } from "@/db";

export const auth = betterAuth({
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
