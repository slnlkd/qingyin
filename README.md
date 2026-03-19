# Qingyin

`Qingyin` 是一个面向移动端的戒酒打卡与互相监督 Web 应用 MVP，当前实现为：

- 一个可直接部署的移动端 `PWA` 前端
- 一个基于 `FastAPI + SQLite` 的轻量后端
- 首页、统计、监督群组、监督动态、个人资料五个基础页面

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
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/checkins/today`
- `POST /api/checkins`
- `GET /api/checkins/calendar?month=YYYY-MM`
- `GET /api/stats/summary`
- `POST /api/groups`
- `POST /api/groups/join`
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

如果你后面要做微信小程序或安卓 APK，建议下一步把前端迁到 `uni-app` 或 `Taro`，复用现在这套视觉和接口设计。
