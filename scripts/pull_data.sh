#!/usr/bin/env bash
# scripts/pull_data.sh —— 服务器每小时拉 main 并热重启（01 第三步第 9 条）
# 部署位置：/opt/jijian/scripts/pull_data.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/jijian}"
cd "$APP_DIR"

BEFORE=$(git rev-parse --short HEAD)
git pull --ff-only origin main
AFTER=$(git rev-parse --short HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "$(date -Is) no change ($AFTER)"
  exit 0
fi

echo "$(date -Is) $BEFORE -> $AFTER 开始构建"
pnpm install --frozen-lockfile || pnpm install
pnpm build
pm2 restart jijian --update-env
echo "$(date -Is) 完成，当前 $AFTER"
