#!/usr/bin/env bash
# deploy/pull_data.sh —— 每小时拉一次 main 并热重启（crontab 已装好）
# 只做 ff-only，绝不覆盖服务器上任何本地改动
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
