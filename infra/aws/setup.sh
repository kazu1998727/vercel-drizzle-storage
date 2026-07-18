#!/usr/bin/env bash
#
# GitHub Actions から Aurora へ RDS IAM 認証で接続するための AWS ロールを作成する。
# ローカルで AWS 認証情報を設定した状態で実行すること（このロールは Vercel 用の
# role/Vercel/access-vercel-db とは別物。GitHub OIDC を信頼する専用ロール）。
#
# 前提: aws CLI / gh CLI が認証済みであること。
set -euo pipefail

AWS_ACCOUNT_ID="847564369142"
AWS_REGION="ap-northeast-1"
ROLE_NAME="github-actions-db-migrate"
CLUSTER_ID="aws-vercel-db"
DB_USER="postgres" # IAM 認証を有効化した DB ユーザー
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 1. GitHub OIDC プロバイダを作成（既に存在すればスキップ）"
if ! aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" \
  >/dev/null 2>&1; then
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com
else
  echo "    既に存在します"
fi

echo "==> 2. ロールを作成（信頼ポリシー）"
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "file://${SCRIPT_DIR}/github-oidc-trust-policy.json" \
  || aws iam update-assume-role-policy \
       --role-name "$ROLE_NAME" \
       --policy-document "file://${SCRIPT_DIR}/github-oidc-trust-policy.json"

echo "==> 3. クラスタのリソースIDを取得して rds-db:connect ポリシーを作成"
RESOURCE_ID="$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --query 'DBClusters[0].DbClusterResourceId' --output text --region "$AWS_REGION")"
echo "    DbClusterResourceId=${RESOURCE_ID}"

POLICY_JSON="$(sed \
  -e "s|<CLUSTER_RESOURCE_ID>|${RESOURCE_ID}|" \
  -e "s|<DB_USER>|${DB_USER}|" \
  "${SCRIPT_DIR}/rds-connect-policy.json")"

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name rds-connect \
  --policy-document "$POLICY_JSON"

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
echo "==> 4. GitHub Secret に新ロールの ARN を設定"
gh secret set AWS_ROLE_ARN --body "$ROLE_ARN"

echo ""
echo "完了: ${ROLE_ARN}"
echo "次に DB 側で（未実施なら）: GRANT rds_iam TO ${DB_USER};"
