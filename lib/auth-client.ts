import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // 同一オリジンで動かす場合は baseURL 省略で自動解決される。
  // 別ドメインの場合は環境変数などで指定する。
  // baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;

export type Session = typeof authClient.$Infer.Session;
