#!/usr/bin/env bash
# deploy/deploy.sh —— 阿里云轻量（Ubuntu 22.04）一次性初始化
# 用法：本地执行  scp deploy/deploy.sh root@HOST:/root/ && ssh root@HOST 'bash /root/deploy.sh DOMAIN'
# 参数：$1=域名（已做好 A 记录）；$2=GitHub 仓库地址（私有则需 token）
set -euo pipefail

DOMAIN="${1:?用法: deploy.sh <域名> [仓库地址]}"
REPO="${2:-https://github.com/xcr2795576719-dot/hackathon-competition.git}"
APP_DIR=/opt/jijian

echo "==> 1/8 系统更新"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git build-essential ufw ca-certificates gnupg

echo "==> 2/8 安装 Node 20 (NodeSource) + pnpm + pm2"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm i -g pnpm pm2
node -v && pnpm -v && pm2 -v

echo "==> 3/8 安装 Caddy（官方 apt 源）"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

echo "==> 4/8 拉代码到 $APP_DIR"
mkdir -p "$APP_DIR" && cd "$APP_DIR"
if [ -d .git ]; then git pull --ff-only; else git clone "$REPO" .; fi
pnpm install --frozen-lockfile || pnpm install
[ -f .env ] || cp .env.example .env
echo "!! 现在填 $APP_DIR/.env 里的 ZHIPU_KEY / DASHSCOPE_KEY，填完回来自动继续"
read -r -p "填好 .env 后按回车继续..." _

echo "==> 5/8 构建"
pnpm build

echo "==> 6/8 pm2 常驻"
pm2 start npm --name jijian -- start || pm2 restart jijian
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "==> 7/8 Caddy 反代 + 自动 HTTPS"
sed "s/jiijian\.top/$DOMAIN/g" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown -R caddy:caddy /var/log/caddy
systemctl enable --now caddy && systemctl reload caddy

echo "==> 8/8 防火墙 + 自动拉取"
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
chmod +x "$APP_DIR/deploy/pull_data.sh"
( crontab -l 2>/dev/null | grep -v pull_data.sh ; echo "17 * * * * $APP_DIR/deploy/pull_data.sh >> /var/log/jijian_pull.log 2>&1" ) | crontab -

echo "==> 完成：https://$DOMAIN"
echo "    体检：curl -sI https://$DOMAIN | head -1 ; pm2 ls ; systemctl status caddy --no-pager | head -5"
