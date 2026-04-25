# math-v2 项目整理清单

## 结论先说

后面如果你只维护升级后的这套项目，主代码目录就定为：

`D:\网站开发\math数模项目上线`

后续开发、修 bug、重新部署，都以这份代码为准。

`D:\shumo` 不再作为日常维护目录，只保留作参考或备份。

---

## 一. 现在这台电脑上哪些目录可以删

### 1. 可以直接删的迁移残留

这些不是主项目，只是你从服务器拷回来的临时副本或压缩包：

1. `D:\网站开发\math数模项目上线\math-v2_J7EcL`
2. `D:\网站开发\math数模项目上线\math-v2_J7EcL.tar.gz`

删除前提：

1. 你已经确认 `D:\网站开发\math数模项目上线` 里的代码就是你现在要维护的最终版本
2. 你不再需要用这两个文件做二次比对

建议删除命令：

```powershell
Remove-Item -LiteralPath "D:\网站开发\math数模项目上线\math-v2_J7EcL" -Recurse -Force
Remove-Item -LiteralPath "D:\网站开发\math数模项目上线\math-v2_J7EcL.tar.gz" -Force
```

### 2. 可以按需清理的运行产物

这些不是核心源码，后面如果出现可以删：

1. `.next/`
2. `node_modules/`
3. `dist/`
4. `coverage/`
5. `*.log`
6. `*.tsbuildinfo`

这些在当前仓库的 `.gitignore` 已经被忽略，不属于长期维护资产。

### 3. 暂时不要删的文件

下面这些虽然看起来像脚本或临时文件，但我建议先保留：

1. `check_db.ts`
2. `fix_db.sql`
3. `tmp_add_column.sql`
4. `update_pricing.ts`
5. `update_pricing_v2.ts`
6. `部署文档.md`
7. `部署文档_Docker版.md`
8. `数据库安全与备份说明.md`
9. `数据库巡检清单.md`
10. `数据库恢复应急流程.md`
11. `用户系统与金币计费_实施方案.md`
12. `用户系统与金币计费_开发任务清单.md`

原因：

1. 这些文件很多是你当前项目运营和运维过程中已经积累的资料
2. 即使不是每天都用，也有较大概率在后续排障或回看时用到

如果未来确定完全不再使用，可以再单独做一次“文档归档”。

---

## 二. 哪些目录和文件必须保留

### 1. 核心源码目录

这些是后续长期维护的主体：

1. `app/`
2. `backend/`
3. `docker/`
4. `pages/`
5. `project/`
6. `public/`
7. `scripts/`
8. `src/`
9. `tests/`

### 2. 核心配置文件

这些是构建和部署必须依赖的：

1. `.env`
2. `.env.example`
3. `.dockerignore`
4. `.gitignore`
5. `docker-compose.yml`
6. `Dockerfile`
7. `package.json`
8. `package-lock.json`
9. `tsconfig.json`
10. `next.config.ts`
11. `eslint.config.mjs`

### 3. 必须特别注意保管的文件

最重要的是：

1. `.env`

因为你当前这份 `.env` 里包含生产环境信息，例如：

1. 数据库账号密码
2. JWT 密钥
3. API Key
4. 支付相关密钥
5. 邮件发送密钥

处理原则：

1. 不要把 `.env` 提交到 git
2. 不要把这份目录随便打包发人
3. 建议本地再额外保存一份离线备份
4. 如果以后要共享给同事，只共享 `.env.example`，不要共享真实 `.env`

---

## 三. 本地目录的推荐整理方式

建议最终保留成这样：

1. 主维护目录：
   `D:\网站开发\math数模项目上线`
2. 参考目录：
   `D:\shumo`

建议理解为：

1. `D:\网站开发\math数模项目上线` 是“线上正在跑的版本”的源码基线
2. `D:\shumo` 是历史参考，不参与日常发版

如果你后面不再需要参考旧 `shumo`，也可以把它压缩归档，但不建议立刻删。

---

## 四. 以后这套项目的正确维护原则

### 1. 只维护一个主目录

以后不要再同时改这几个地方：

1. `D:\网站开发\math数模项目上线`
2. `D:\shumo`
3. 服务器目录 `/www/wwwroot/math-v2`

正确方式：

1. 本地只改 `D:\网站开发\math数模项目上线`
2. 测试通过后上传到服务器 `/www/wwwroot/math-v2`
3. 服务器只作为部署目标，不作为长期开发目录

### 2. 服务器上的真实运行目录

当前线上升级版目录是：

`/www/wwwroot/math-v2`

以后部署都更新这套目录，不要再回头更新旧的：

`/www/wwwroot/math`

---

## 五. 本地 -> 服务器 的正确部署流程

下面这套流程建议以后固定下来，每次都按这个顺序走。

### 第 1 步：在本地改代码

本地只改：

`D:\网站开发\math数模项目上线`

改完后至少自查：

1. 改动文件是否准确
2. `.env` 是否没有被误改成测试值
3. 是否不小心把生产密钥写进了源码文件

### 第 2 步：本地构建自检

在本地项目目录执行：

```powershell
cd D:\网站开发\math数模项目上线
npm install
npm run build
```

如果只改了后端 Python 服务，也要额外检查对应构建逻辑。

### 第 3 步：整理上传内容

上传到服务器前，不要把这些东西带上：

1. `.next`
2. `node_modules`
3. `coverage`
4. `dist`
5. 本地日志文件
6. 个人临时压缩包

推荐只上传源码和必要配置文件。

### 第 4 步：先备份服务器当前版本

每次上线前，先在服务器备份：

1. 当前项目目录
2. 当前 `.env`
3. 数据库

建议至少做：

```bash
mkdir -p /www/backup/math-v2
cp /www/wwwroot/math-v2/.env /www/backup/math-v2/math-v2_env_$(date +%F_%H%M%S).bak
docker exec mathv2-aittco-db-1 pg_dump -U mathv2user -d mathv2db --clean --if-exists --no-owner --no-privileges > /www/backup/math-v2/mathv2db_$(date +%F_%H%M%S).sql
```

### 第 5 步：上传本地代码到服务器

上传目标目录固定为：

`/www/wwwroot/math-v2`

不要再上传到：

1. `/www/wwwroot/math`
2. 另一个 `aittco` 项目目录

### 第 6 步：确认服务器 `.env` 不被覆盖错

上线前重点检查：

1. `COMPOSE_PROJECT_NAME`
2. `COMPOSE_NETWORK_NAME`
3. `DB_VOLUME_NAME`
4. `POSTGRES_USER`
5. `POSTGRES_PASSWORD`
6. `POSTGRES_DB`
7. `POSTGRES_PRISMA_URL`
8. `POSTGRES_URL_NON_POOLING`
9. `BACKEND_PORT`
10. `FRONTEND_PORT`
11. `BACKEND_ALLOWED_ORIGINS`
12. `NEXT_PUBLIC_APP_URL`

尤其要防止把本地测试配置带到线上。

### 第 7 步：在服务器重新构建并启动

在服务器执行：

```bash
cd /www/wwwroot/math-v2
docker compose build aittco-backend aittco-frontend
docker compose up -d aittco-db aittco-backend aittco-frontend
docker compose ps
```

### 第 8 步：查看启动日志

```bash
cd /www/wwwroot/math-v2
docker compose logs -f --tail=150 aittco-backend aittco-frontend
```

重点确认：

1. 数据库健康
2. 后端健康
3. 前端正常启动
4. 没有明显的 Prisma、权限、端口冲突、环境变量缺失报错

### 第 9 步：上线后验收

每次上线后至少验这几项：

1. 首页能打开
2. 老用户能登录
3. 新用户能注册/发验证码
4. 模型列表正常
5. 聊天正常
6. 生图正常
7. 管理后台能打开
8. 充值页和套餐正常

---

## 六. 推荐的日常发布节奏

建议以后每次发布都走：

1. 本地开发
2. 本地构建检查
3. 服务器备份
4. 上传代码
5. `docker compose build`
6. `docker compose up -d`
7. 看日志
8. 业务验收

不要再走这种高风险路径：

1. 直接在服务器生产目录里临时改代码
2. 不备份就重建容器
3. 同时维护多个本地版本
4. 不确认 `.env` 就直接部署

---

## 七. 我建议你现在立刻做的整理动作

建议顺序：

1. 保留 `D:\网站开发\math数模项目上线` 作为唯一主目录
2. 删除 `math-v2_J7EcL`
3. 删除 `math-v2_J7EcL.tar.gz`
4. 检查 `.env` 不进入版本库
5. 以后所有发版只更新服务器 `/www/wwwroot/math-v2`

---

## 八. 一句话规则

以后你只记这三句就够了：

1. 本地只维护 `D:\网站开发\math数模项目上线`
2. 服务器只部署 `/www/wwwroot/math-v2`
3. `.env` 永远单独保管，不提交、不乱传
