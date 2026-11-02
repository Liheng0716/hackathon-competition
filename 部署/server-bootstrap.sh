#!/usr/bin/env bash
# 机鉴 · 服务器一次性初始化（Ubuntu 26.04 / 2核4G）
# 用法：ssh root@IP 后粘贴执行；完成后 pm2 常驻 + 80 端口反代 3000
set -euo pipefail

apt-get update -y
apt-get install -y curl git nginx ufw build-essential python3

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v
npm i -g pnpm pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# 拉代码（GitHub 主仓；若慢改用 Gitee 镜像地址）
mkdir -p /opt && cd /opt
if [ ! -d jiijian ]; then
  git clone https://gitee.com/its-a-shame/hackathon-competition.git jiijian
fi
cd /opt/jiijian
git remote set-url --add origin https://github.com/xcr2795576719-dot/hackathon-competition.git || true

# 环境变量（把两个 key 填进去；不要提交任何文件）
cat > .env <<'EOF'
ZHIPU_KEY=填智谱key
DASHSCOPE_KEY=填百炼key
GLM_TEXT_MODEL=glm-5.3-flash
QWEN_TEXT_MODEL=qwen-plus
GLM_VISION_MODEL=glm-4v-flash
QWEN_VISION_MODEL=qwen3-vl-plus
EOF
chmod 600 .env

pnpm install --frozen-lockfile || pnpm install
pnpm build

pm2 delete jiijian 2>/dev/null || true
pm2 start pnpm --name jiijian -- start
pm2 save

# nginx 反代 80 -> 3000
cat > /etc/nginx/sites-available/jiijian <<'EOF'
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 12m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
EOF
ln -sf /etc/nginx/sites-available/jiijian /etc/nginx/sites-enabled/jiijian
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 3000/tcp
ufw --force enable

echo "== 完成：http://<ECS公网IP>/  健康检查 http://<ECS公网IP>/api/models =="
