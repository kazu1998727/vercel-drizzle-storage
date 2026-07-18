This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 認証・DB 構成 (Drizzle + Better Auth + Aurora)

[Drizzle ORM](https://orm.drizzle.team) と [Better Auth](https://www.better-auth.com) の最小構成です。
DB は **Amazon Aurora PostgreSQL**（[Vercel Marketplace の AWS 統合](https://vercel.com/marketplace/aws/aws-apg)）を使い、
**静的なパスワードを一切持たず、RDS IAM 認証**で接続します。

### 接続の仕組み（重要）

Vercel の AWS 統合は、DB のパスワードではなく以下を提供します。

- 接続情報の環境変数: `PGHOST` / `PGPORT` / `PGUSER` / `PGDATABASE` / `AWS_REGION` / `AWS_ROLE_ARN`
- Vercel の OIDC トークン（`VERCEL_OIDC_TOKEN`、ビルド時・実行時とも利用可能）

接続時は次の流れでトークンを生成します（[db/connection.ts](db/connection.ts)）。

```
Vercel OIDC トークン
  └─(awsCredentialsProvider: STS AssumeRoleWithWebIdentity で AWS_ROLE_ARN を引き受け)
        └─ AWS 一時認証情報
              └─(@aws-sdk/rds-signer: 15分有効の IAM 認証トークンを生成)
                    └─ pg の password として渡して Aurora に接続
```

`pg` の `password` に関数を渡しているため、接続確立ごとに新しいトークンが生成され、失効しません。
ローカルなど `DATABASE_URL` がある場合はそちらを優先します。

### ファイル構成

| パス | 役割 |
| --- | --- |
| [db/schema.ts](db/schema.ts) | Better Auth のテーブル定義 (user / session / account / verification) |
| [db/connection.ts](db/connection.ts) | Vercel OIDC + RDS IAM でトークンを生成する pg Pool の生成 |
| [db/index.ts](db/index.ts) | アプリ用 Drizzle インスタンス（Pool を再利用） |
| [db/migrate.ts](db/migrate.ts) | マイグレーション適用スクリプト（プログラム的マイグレータ） |
| [drizzle.config.ts](drizzle.config.ts) | drizzle-kit の設定（`generate` 用。`DATABASE_URL` / `PG*` に対応） |
| [lib/auth.ts](lib/auth.ts) | Better Auth サーバー（email+password、baseURL / trustedOrigins を Vercel 向けに設定） |
| [lib/auth-client.ts](lib/auth-client.ts) | クライアント用フック (`signIn` / `signUp` / `signOut` / `useSession`) |
| [app/api/auth/[...all]/route.ts](app/api/auth/[...all]/route.ts) | Better Auth の API ハンドラ |
| [app/auth-demo/page.tsx](app/auth-demo/page.tsx) | 動作確認用デモページ |
| [vercel.json](vercel.json) | インストールコマンド上書き（`--ignore-scripts`、下記参照） |

### 環境変数

`PGHOST` などの DB 接続系は **Vercel の AWS 統合が自動注入**します。手動で設定が必要なのは Better Auth 関連です。

| 変数 | 用途 | 設定場所 |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | セッション署名・暗号化（**本番必須**）。`openssl rand -base64 32` で生成 | Vercel / `.env` |
| `BETTER_AUTH_URL` | 本番の正規URL（未設定時は Vercel の本番ドメインを自動採用） | Vercel（任意） |
| `DATABASE_URL` | ローカルで通常の Postgres に繋ぐ場合のみ | `.env`（任意） |

### マイグレーション（ビルド時に自動適用）

`build` スクリプトは `tsx db/migrate.ts && next build`（[package.json](package.json)）。
**Vercel のデプロイ時に、アプリ本体と同じ IAM 認証で `drizzle/` の未適用マイグレーションを適用**してから
Next.js をビルドします。マイグレータは冪等（適用済みは `__drizzle_migrations` で管理）です。

スキーマを変更したときの流れ:

```bash
# 1. db/schema.ts を編集
# 2. マイグレーションSQLを生成（DB接続不要）
pnpm db:generate
# 3. 生成された drizzle/ をコミットして push → Vercel デプロイ時に自動適用
```

ローカルの Postgres に対して手動適用したい場合は、`DATABASE_URL` を設定して `pnpm db:migrate` を実行します。

> **注意**: この方式はデプロイが DB 到達性に依存します（ビルド環境から Aurora に接続できないとビルドが失敗）。
> ビルド環境から到達できない構成の場合は、マイグレーションを実行時（保護された API ルート等）に移す方式へ切り替えてください。

### ローカル開発

Vercel の OIDC はローカルには無いため、ローカルで DB を使うには `.env` に `DATABASE_URL` を設定してください
（別途ローカル/リモートの Postgres を用意）。設定後:

```bash
pnpm dev
# http://localhost:3000/auth-demo でサインアップ / サインイン / サインアウトを確認
```

### 認証の使い方

クライアント（[lib/auth-client.ts](lib/auth-client.ts)）:

```tsx
"use client";
import { signIn, signUp, signOut, useSession } from "@/lib/auth-client";

const { data: session } = useSession();
await signUp.email({ name, email, password });
await signIn.email({ email, password });
await signOut();
```

サーバーコンポーネントでセッション取得:

```ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({ headers: await headers() });
```

### インストールについて（vercel.json）

pnpm 10/11 は未承認のビルドスクリプトがあると `pnpm install` を失敗させます
（`esbuild` など）。マイグレーション/ビルドにこれらのネイティブビルドは不要で、必要な
バイナリは optionalDependencies から入るため、[vercel.json](vercel.json) で
`pnpm install --frozen-lockfile --ignore-scripts` を指定して回避しています。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
