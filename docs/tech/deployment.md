---
name: deployment
description: 生产环境部署：阿里云 ECS（宝塔面板）、GitHub 仓库、Node.js + PM2 + Nginx、更新流程、常见问题
---

# 生产环境部署

## 服务器

| 项目 | 值 |
|------|-----|
| 实例 ID | `5c9003751245429bae2bc9c99ba0afec` |
| 名称 | 宝塔Linux面板-jlqg |
| 地域 | 华南3（广州） |
| 规格 | 通用型 |
| 公网 IP | `8.138.248.158` |
| 内网 IP | `172.19.15.236` |
| 镜像 | 宝塔Linux面板（阿里云专享版 9.2.0） |
| 到期 | 2026-07-15 |
| SSH | `ssh admin@8.138.248.158` |

## GitHub

| 项目 | 值 |
|------|-----|
| 仓库 | `https://github.com/walkeryi/huashijie.git` |
| 分支 | `master` |

## 部署架构

```
用户 → 8.138.248.158:80 (Nginx)
         → proxy_pass http://127.0.0.1:3000
              → PM2 fork 守护 npm start
                   → Next.js 16.2.9
```

部署目录：`/www/wwwroot/huashijie`

PM2 进程名：`huashijie`

## 首次部署

### 1. 宝塔面板安装环境

软件商店 → 安装 Node.js（≥ 18.x）、PM2 管理器、Nginx。

### 2. 克隆项目

```bash
cd /www/wwwroot
git clone https://github.com/walkeryi/huashijie.git
```

### 3. 生产环境变量

```bash
# /www/wwwroot/huashijie/.env.production
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 4. 换淘宝镜像（提速）

```bash
npm config set registry https://registry.npmmirror.com
```

### 5. 构建并启动

```bash
cd /www/wwwroot/huashijie
npm install
npm run build
pm2 start npm --name "huashijie" -- start
pm2 save
```

### 6. Nginx 反向代理

宝塔「网站」→ 添加站点 → 域名填 `8.138.248.158`，配置：

```nginx
server {
    listen 80;
    server_name 8.138.248.158;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 日常更新

**本机必须先 `git add && git commit && git push`**，然后服务器执行：

```bash
cd /www/wwwroot/huashijie && \
  git checkout -- package-lock.json && \
  git pull && \
  npm install && \
  npm run build && \
  pm2 restart huashijie
```

> 每次都必须 `npm run build`，因为 `.next` 目录不在 git 中。

## 常见问题

### `package-lock.json` 冲突

Linux 和 Windows 的 `package-lock.json` 有微小差异。`git pull` 前先 `git checkout -- package-lock.json` 丢弃本地改动。

### `Module not found` / 缺包

可能是 `package.json` 更新了新增的依赖。执行 `npm install`。

如果还不行，完全重装：

```bash
rm -rf node_modules package-lock.json && npm install
```

### `Could not find a production build in '.next'`

忘了 `npm run build`。构建后再启动。

### `npm install` 太慢

已配置淘宝镜像 `registry.npmmirror.com`。用 `npm config get registry` 确认。

## PM2 常用命令

```bash
pm2 list              # 进程状态
pm2 logs huashijie    # 实时日志
pm2 restart huashijie # 重启
pm2 stop huashijie    # 停止
```

## 相关文档

→ technical-architecture.md：技术栈全貌、构建命令
→ ../business/ai-engine.md：API key 和 provider 配置
→ ../business/save-system.md：服务端存档路径（`data/saves/`）
