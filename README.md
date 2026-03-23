# Qingyin

`Qingyin` 是一个面向移动端的戒酒打卡与互相监督 Web 应用 MVP，当前实现为：

- 一个可直接部署的移动端 `PWA` 前端
- 一个可在微信开发者工具中打开的 `miniapp` 小程序工程
- 一个基于 `FastAPI + SQLite` 的轻量后端
- 首页、统计、监督群组、监督动态、个人资料五个基础页面
- 已支持监督群组内的手动催打卡提醒
- 已区分 `戒酒总天数` 与 `连续打卡天数`

## 项目地址

- 线上体验：`https://lvkedang.cn/qingyin/`
- API：`https://lvkedang.cn/qingyin-api/`
- GitHub：`https://github.com/slnlkd/qingyin`

## 最近更新

- 首页主视觉改为点击圆环直接打卡，并补充了更完整的成功动效与联动反馈
- 首页、挑战、社区、我的的状态展示逐步统一为图标化视觉风格
- 社区动态已支持图标化状态正文，不再只有文字描述
- 群组支持手动提醒未打卡成员，社区会同步生成中文提醒动态
- 统计口径拆分为：
  - `戒酒总天数`
  - `连续打卡天数`
- 会话失效不再自动偷偷创建新账号，避免监督关系丢失
- 前端缓存策略已调整，默认尽量优先获取最新数据

## 当前主要功能

- 首页圆环打卡
- 连续打卡、戒酒总天数、节省金额统计
- 月历与最近心情趋势
- 监督群组创建、加入、改名、刷新邀请码
- 群组成员状态查看
- 群组内手动催打卡提醒
- 社区监督动态
- 个人资料维护

## 目录结构

```text
qingyin/
├─ backend/
│  ├─ app/
│  │  └─ main.py
│  └─ qingyin.db
├─ frontend/
│  ├─ assets/
│  ├─ app.js
│  ├─ index.html
│  ├─ manifest.webmanifest
│  ├─ styles.css
│  └─ sw.js
├─ miniapp/
│  ├─ pages/
│  ├─ utils/
│  ├─ app.js
│  ├─ app.json
│  ├─ app.wxss
│  └─ project.config.json
├─ requirements.txt
└─ README.md
```

## 本地启动

### 1. 启动后端

```bash
cd D:\Code\qingyin
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. 启动前端静态服务

```bash
cd D:\Code\qingyin\frontend
python -m http.server 4173
```

打开：

```text
http://127.0.0.1:4173
```

## Docker Compose 部署

### 启动

```bash
cd D:\Code\qingyin
docker compose up -d --build
```

启动后访问：

```text
http://127.0.0.1:18080
```

### 停止

```bash
docker compose down
```

### 部署结构

- `web`：`nginx` 提供前端静态文件
- `backend`：`FastAPI + uvicorn`
- `backend-data/`：数据库持久化目录，容器重建后数据仍保留
- 宿主机 `nginx` 可把 `/qingyin/` 代理到 `127.0.0.1:18080`
- 宿主机 `nginx` 可把 `/qingyin-api/` 代理到 `127.0.0.1:18081/api/`

## 已实现接口

- `POST /api/session/init`
- `GET /api/auth/me`
- `POST /api/auth/transfer-code`
- `POST /api/auth/wechat/mini/login`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/checkins/today`
- `POST /api/checkins`
- `GET /api/checkins/calendar?month=YYYY-MM`
- `GET /api/stats/summary`
- `POST /api/groups`
- `POST /api/groups/join`
- `PUT /api/groups/current`
- `POST /api/groups/remind`
- `GET /api/groups/current`
- `GET /api/groups/feed`

## 部署建议

当前代码最适合先以 `Web + PWA` 部署：

1. 前端静态文件放到 `Nginx` 或宝塔静态站点。
2. 后端用 `systemd`、`Supervisor` 或 `Docker` 跑 `uvicorn`。
3. 数据库先用内置 `SQLite`，用户量上来后再切到 `PostgreSQL`。

当前仓库已经自带：

- [docker-compose.yml](D:/Code/qingyin/docker-compose.yml)
- [backend/Dockerfile](D:/Code/qingyin/backend/Dockerfile)
- [nginx.conf](D:/Code/qingyin/nginx.conf)

微信小程序登录相关环境变量：

```bash
WECHAT_MINI_APPID=your_wechat_mini_appid
WECHAT_MINI_SECRET=your_wechat_mini_secret
```

示例文件见：

- [\.env.example](D:/Code/qingyin/.env.example)

## 微信小程序工程

当前仓库已经包含一个最小可用的小程序工程：

- 目录：[miniapp](D:/Code/qingyin/miniapp)
- 默认后端：
  - 开发版：`https://8.155.168.138/qingyin-api`
  - 体验版/正式版：`https://lvkedang.cn/qingyin-api`
- 已接入：
  - `wx.login()`
  - `POST /api/auth/wechat/mini/login`
  - `GET /api/auth/me`
  - `GET /api/profile`
  - `GET /api/stats/summary`
  - `GET /api/groups/current`
  - `PUT /api/profile`

### 在微信开发者工具中打开

1. 选择项目目录：`D:\Code\qingyin\miniapp`
2. 确认 `project.config.json` 中的小程序 `AppID` 正确
3. 在微信公众平台把请求合法域名配置为：

```text
https://lvkedang.cn
```

### 当前小程序页能力

- 首页：
  - 微信登录
  - 输入迁移码，把 Web 端当前账号迁移到小程序
  - 账号绑定状态
  - 连续打卡 / 戒酒总天数 / 节省金额
  - 当前监督群组与成员状态
  - 首页、打卡、统计、社区、我的底部导航
  - 打卡页、统计页、群组页、社区页入口
- 统计页：
  - 读取 `/api/stats/summary`
  - 读取 `/api/checkins/calendar`
  - 展示核心统计、最近心情趋势和打卡月历
- 今日打卡页：
  - 读取 `/api/checkins/today`
  - 选择心情并提交 `/api/checkins`
  - 查看当日记录与累计签到结果
  - 打卡成功后的圆环和统计反馈动画
- 监督群组页：
  - 读取 `/api/groups/current`
  - 创建群组
  - 通过邀请码加入群组
  - 群主修改群组名称
  - 群主刷新邀请码
  - 查看成员状态
  - 对未打卡成员执行 `/api/groups/remind`
- 社区动态页：
  - 读取 `/api/groups/feed`
  - 中文化展示打卡、提醒、加入群组等动态
- 资料页：
  - 查看账号绑定状态
  - 查看戒酒总天数、连续打卡、节省金额
  - 查看当前监督群组摘要与邀请码复制
  - 编辑昵称
  - 编辑头像表情
  - 编辑戒酒开始日
  - 编辑每日预算

### Web 到小程序迁移

当前已经支持最小迁移桥接：

1. 在 Web 版清饮的“我的”页生成一个 10 分钟有效的迁移码
2. 在微信小程序首页输入迁移码
3. 点击微信登录
4. 后端会把当前 Web 账号的资料、打卡记录和监督群组绑定到这个小程序账号

如果你后面要做微信小程序或安卓 APK，建议下一步把前端迁到 `uni-app` 或 `Taro`，复用现在这套视觉和接口设计。
