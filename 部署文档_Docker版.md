# 终端命令：Docker 一键部署指南

相比于手动配置环境，Docker 部署能为您省去大部分繁琐的依赖安装步骤，确保前端和后端运行环境的一致性。本文档将指导您如何通过服务器终端命令行进行全流程的 Docker 部署。

---

## 1. 准备工作：安装 Docker 环境

在服务器终端中执行以下命令，安装 Docker 和 Docker Compose插件（如果您使用的是宝塔面板或系统已安装，可跳过此步）：

```bash
# 1. 下载并运行官方自动化安装脚本
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 启动并设置 Docker 开机自启
sudo systemctl enable docker
sudo systemctl start docker

# 3. 安装 Docker Compose 插件
sudo apt-get install docker-compose-plugin
```

---

## 2. 上传项目文件

准备好包含了配置文件的整个项目代码。

1. **核心配置文件**均已为您准备好：
   - 前端配置：`Dockerfile` (位于项目根目录)
   - 后端配置：`backend/Dockerfile`
   - 编排配置：`docker-compose.yml`

2. **上传到服务器**：
   将您本地的 `aittco` 文件夹内容（上传前建议删除 `.next` 和 `node_modules` 文件夹以大幅减小体积）上传至您的服务器指定目录。例如通过 SFTP 上传 zip 并解压到 `/www/wwwroot/aittco`：

```bash
# 进入部署存放目录
cd /www/wwwroot/aittco

# (如果您上传了 aittco.zip 包，可在此解压)
unzip aittco.zip
```

---

## 3. 编译与启动 (核心)

在包含 `docker-compose.yml` 的项目根目录下，执行以下步骤：

### 3.0 中转站 (Relay) 专项配置 (重要)
由于您的所有模型都是通过中转站获取的，您必须在 `.env` 中通过 **API_HOST** 将请求导向您的代理地址。

请在 `.env` 中确保以下项填写正确：

```env
# --- 1. 聊天模型密钥 (中转站提供的 API Key) ---
OPENAI_API_KEY="您的中转站令牌"
GEMINI_API_KEY="您的中转站令牌"

# --- 2. 接口地址 (将请求重定向到中转站) ---
# 绝大多数中转站地址形如 https://api.xxx.com
OPENAI_API_HOST="https://您的中转站域名/v1"
GEMINI_API_HOST="https://您的中转站域名"
IMAGE_PROVIDER_API_HOST="https://您的中转站域名" # 新增：支持生图服务重定向

# --- 3. 生图模型密钥 (对接中转站) ---
BACKEND_API_KEY="您的中转站令牌"

# --- 4. 系统核心配置 ---
JWT_SECRET="随意写一串长字符"
JWT_REFRESH_SECRET="再写一串不同的"
POSTGRES_PRISMA_URL="postgresql://aittcouser:mathpassword@aittco-db:3339/aittcodb?schema=public"
```

### 3.1 配置环境变量
确保您的 `.env` 文件已更新。重点检查以下三项：
```bash
# JWT 密钥 (随意输入长字符串)
JWT_SECRET="your_secret_here"
JWT_REFRESH_SECRET="your_refresh_secret_here"

# 数据库连接 (指向 docker-compose 中的 aittco-db 容器)
POSTGRES_PRISMA_URL="postgresql://aittcouser:mathpassword@aittco-db:3339/aittcodb?schema=public"
POSTGRES_URL_NON_POOLING="postgresql://aittcouser:mathpassword@aittco-db:3339/aittcodb?schema=public"
```

### 3.2 启动容器
```bash
# 在后台构建并启动所有服务 (-d 代表后台运行，--build 代表强制重新构建)
docker compose up -d --build
```
**注意：** 初次启动会拉取 PostgreSQL 镜像并构建前端镜像，大约需要 5-10 分钟。

### 3.3 初始化数据库 (仅第一次或更新表结构后执行)
容器启动成功后，需要初始化数据库表结构并注入初始价格数据：

```bash
# 1. 创建数据库表结构
docker exec -it aittco-frontend npx prisma db push

# 2. 注入模型价格与默认管理员账号
# (默认账号: admin@banana.com  密码: admin123456)
docker exec -it aittco-frontend npx tsx src/server/prisma/seed.ts
```

---

## 4. 绑定域名与 Nginx 反向代理

为了让 AI 聊天流式输出（打字机效果）不卡顿，Nginx 配置**至关重要**。确保您的站点配置文件包含以下参数：

```nginx
server {
    listen 80;
    server_name www.aittco.com; # 替换您的域名

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 【关键】防止 Nginx 缓冲导致流式输出失效
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
        proxy_read_timeout 600s;
    }
}
```

---

## 5. 日常管理与更新

### 更新代码
1. 将新代码上传并覆盖服务器文件。
2. 执行 `docker compose up -d --build` 自动完成热重载。

### 🛡️ 常用管理命令
- **查看日志**：`docker compose logs -f aittco-frontend`
- **数据库备份脚本**：
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/www/backup/aittco/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
ALERT_SCRIPT="${ALERT_SCRIPT:-/www/wwwroot/aittco/scripts/notify-webhook.sh}"
TS="$(date +%F_%H%M%S)"
FILE="$BACKUP_DIR/aittcodb_$TS.sql"
LATEST="$BACKUP_DIR/latest.sql"

alert_and_fail() {
  local message="$1"
  echo "[db-backup] ERROR: $message"
  if [ -x "$ALERT_SCRIPT" ]; then
    "$ALERT_SCRIPT" "数据库备份失败" "$message" || true
  fi
  exit 1
}

mkdir -p "$BACKUP_DIR"

echo "[db-backup] Writing backup to $FILE"

if ! docker exec aittco-db pg_dump -U aittcouser -d aittcodb --clean --if-exists --no-owner --no-privileges > "$FILE"; then
  alert_and_fail "pg_dump 执行失败"
fi

if [ ! -s "$FILE" ]; then
  alert_and_fail "备份文件为空: $FILE"
fi

cp "$FILE" "$LATEST"

find "$BACKUP_DIR" -type f -name 'aittcodb_*.sql' -mtime +"$RETENTION_DAYS" -delete

echo "[db-backup] Backup complete"
echo "[db-backup] Latest backup: $FILE"
```
- **重置数据库**（危险）：`docker exec -it aittco-frontend npx prisma db push --force-reset`
- **查看金币余额同步情况**：如果用户反映余额不准，可尝试重启前端容器 `docker compose restart aittco-frontend`。
