# 部署手册 v0.7：AI Works 主线 + 服务器兜底

## 路线一（主线）：知乎 AI Works 免费发布
1. 打上传包：`npm run submit` → `jiijian-submit-<日期>.zip`（已排除 node_modules/.env/.next/*.log）
2. AI Works 控制台建项目 → 上传 zip → 填环境变量 `ZHIPU_KEY` / `DASHSCOPE_KEY` / 四个模型名 → 构建 → 预览自测
3. 预览要覆盖四条链路：`/`、`/prices/iphone-13-128g`、`/verify`、`/report/iphone-13-128g`
4. **周三 12:00 前提交审核**（要公网游客可访问才算过）
5. 构建命令 `npm run build`，启动命令 `npm start`，端口取平台注入的 `PORT`（`next start -p ${PORT:-3000}`）
6. 数据文件随包上传；改了数据就重新发布一次

## 路线二（兜底，仅周三 12:00 审核未过时启用）
成本：云工开物 buycenter 学生价「轻量应用服务器 2核2G ¥68/年」（杭州，整年）。大陆机不买域名，用 `http://IP:3000` 直连演示。

1. 购买：university.aliyun.com/buycenter → 轻量应用服务器 2核2G → 杭州 → Ubuntu 22.04 → 1 年
2. 控制台防火墙放行 22 / 3000
3. 服务器初始化（Node 20 + pm2）：
```bash
ssh root@HOST
apt-get update -y && apt-get install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
npm i -g pm2
git clone https://gitee.com/its-a-shame/hackathon-competition.git /opt/jijian
cd /opt/jijian && npm install && cp .env.example .env
nano .env            # 填 ZHIPU_KEY / DASHSCOPE_KEY
npm run build
pm2 start npm --name jijian -- start && pm2 save && pm2 startup
```
4. 验证：`curl -sI http://HOST:3000 | head -1` → `HTTP/1.1 200 OK`
5. 自动更新：`deploy/pull_data.sh`（git pull --ff-only + build + pm2 restart），crontab 每小时第 17 分执行：
```bash
chmod +x /opt/jijian/deploy/pull_data.sh
( crontab -l 2>/dev/null; echo "17 * * * * /opt/jijian/deploy/pull_data.sh >> /var/log/jijian_pull.log 2>&1" ) | crontab -
```
6. 需要 HTTPS/域名再启用 `deploy/Caddyfile`（域名解析到 HOST 后 `systemctl reload caddy` 自动签证书）

## 每晚 21:00 合并后的发布动作
1. `npm run build` 本地过一遍（四条链路）
2. AI Works：重新上传 zip 发布会话
3. 兜底机：等 crontab 自动 pull，或手动 `/opt/jijian/deploy/pull_data.sh`
4. 数据刷新（现价/二手）走 `prices_current.csv` → `python scripts/import_prices.py` → 提交 → 自动 pull

## 常见坑
1. 2G 内存 build 爆 → 加 swap：`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab`
2. 3000 端口不通 → 阿里云控制台「防火墙」也要放行（system 内 ufw 只管本机）
3. 私有仓 clone 失败 → 用带 token 的 URL 或部署公钥
4. AI Works 构建失败先看是不是把 `node_modules` 打进去了（用 `npm run submit` 就不会）
