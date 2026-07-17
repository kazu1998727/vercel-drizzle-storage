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

## 認証・DB セットアップ (Drizzle + Better Auth)

このプロジェクトには [Drizzle ORM](https://orm.drizzle.team) と [Better Auth](https://www.better-auth.com) の最小構成が含まれています。DB は Amazon Aurora PostgreSQL (node-postgres ドライバ) を想定しています。

### 1. 環境変数

`.env.example` をコピーして `.env` を作成し、値を設定します。

```bash
cp .env.example .env
# BETTER_AUTH_SECRET は以下で生成
openssl rand -base64 32
```

### 2. スキーマをDBへ反映

```bash
# マイグレーションファイルを生成
pnpm db:generate
# DBへ適用
pnpm db:migrate
# （プロトタイプ中はマイグレーションを介さず直接反映も可能）
# pnpm db:push
```

### 3. 開発サーバーを起動

```bash
pnpm dev
```

[http://localhost:3000/auth-demo](http://localhost:3000/auth-demo) でサインアップ / サインイン / サインアウトを試せます。

### ファイル構成

| パス | 役割 |
| --- | --- |
| `db/schema.ts` | Better Auth のテーブル定義 (user / session / account / verification) |
| `db/index.ts` | Drizzle + pg コネクションプール |
| `drizzle.config.ts` | drizzle-kit の設定 |
| `lib/auth.ts` | Better Auth サーバーインスタンス (email+password 有効) |
| `lib/auth-client.ts` | クライアント用フック (`signIn` / `signUp` / `signOut` / `useSession`) |
| `app/api/auth/[...all]/route.ts` | Better Auth の API ハンドラ |
| `app/auth-demo/page.tsx` | 動作確認用デモページ |

サーバーコンポーネントでセッションを取得する例:

```ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({ headers: await headers() });
```

## CI での自動マイグレーション (GitHub Actions)

`main` へ push（マージ）され、かつマイグレーションファイル (`drizzle/**`) 等が変更された場合に
[.github/workflows/db-migrate.yml](.github/workflows/db-migrate.yml) が Aurora へマイグレーションを適用します。

**運用フロー**

1. スキーマ (`db/schema.ts`) を変更する
2. ローカルで `pnpm db:generate` を実行し、生成された `drizzle/` をコミットする
3. PR を作成 → `main` にマージ
4. Actions が OIDC で AWS ロールを引き受け、RDS IAM トークンを生成して `drizzle-kit migrate` を実行

静的なDBパスワードやアクセスキーは保存せず、GitHub OIDC + RDS IAM 認証で接続します。

### 事前準備（必須）

1. **GitHub Actions 用の AWS ロール**
   `.env.example` の `AWS_ROLE_ARN` (`role/Vercel/access-vercel-db`) は Vercel 用の信頼ポリシーの
   可能性が高いため、そのままでは GitHub から引き受けられません。GitHub OIDC プロバイダ
   (`token.actions.githubusercontent.com`) を信頼し、`rds-db:connect` を許可した
   ロールを別途用意し、リポジトリ Variables の `AWS_ROLE_ARN` に設定してください。

2. **リポジトリ Variables**（Settings → Secrets and variables → Actions → Variables）
   | 名前 | 値 |
   | --- | --- |
   | `AWS_REGION` | `ap-northeast-1` |
   | `AWS_ROLE_ARN` | GitHub が引き受け可能なロールの ARN |
   | `PGHOST` | Aurora のエンドポイント |
   | `PGPORT` | `5432` |
   | `PGUSER` | IAM 認証を有効化した DB ユーザー |
   | `PGDATABASE` | `postgres` |

3. **DBユーザーの IAM 認証有効化**
   接続に使う DB ユーザーに `rds_iam` ロールを付与しておく必要があります。
   ```sql
   GRANT rds_iam TO <db_user>;
   ```

4. **ネットワーク到達性（重要）**
   GitHub 管理ランナー（動的な公開IP）から Aurora へ TCP 到達できる必要があります。
   Aurora が VPC 内で非公開の場合、このワークフローは接続に失敗します。次のいずれかで解消してください。
   - Aurora を publicly accessible にし、Security Group で接続を許可する
   - VPC 内の **self-hosted runner** を使う（`runs-on` を変更）
   - VPN / bastion / AWS 経由でトンネルする

   到達性が確保できない場合は self-hosted runner 構成に切り替えるのが現実的です。

### パスワード認証で運用する場合（代替）

IAM を使わず接続文字列で運用する場合は、`DATABASE_URL` をリポジトリ Secret に登録し、
ワークフローの「Configure AWS credentials」「Generate RDS IAM auth token」ステップを削除して、
`Run migrations` ステップの前に `DATABASE_URL` を `env` で渡してください。
`drizzle.config.ts` は `DATABASE_URL` があればそちらを優先します。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
