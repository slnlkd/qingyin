from __future__ import annotations

import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("QINGYIN_DB_PATH", str(BASE_DIR / "qingyin.db")))
MOODS = ["开心", "平静", "一般", "渴望", "不适"]
APP_TZ = timezone(timedelta(hours=8))


app = FastAPI(title="Qingyin API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionInitResponse(BaseModel):
    token: str
    profile: dict[str, Any]


class ProfileUpdatePayload(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    avatar_emoji: str = Field(min_length=1, max_length=4)
    sober_start_date: date
    daily_budget: float = Field(ge=0, le=9999)


class CheckinPayload(BaseModel):
    mood: str
    reflection: str = Field(default="", max_length=200)


class GroupCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=30)


class GroupJoinPayload(BaseModel):
    invite_code: str = Field(min_length=6, max_length=12)


class GroupUpdatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    refresh_invite_code: bool = False


@contextmanager
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.now(APP_TZ).isoformat(timespec="seconds")


def is_dev_mode() -> bool:
    if os.getenv("QINGYIN_ENABLE_DEV_TOOLS") == "1":
        return True
    return DB_PATH == BASE_DIR / "qingyin.db"


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                avatar_emoji TEXT NOT NULL,
                sober_start_date TEXT NOT NULL,
                daily_budget REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS checkins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                checkin_date TEXT NOT NULL,
                mood TEXT NOT NULL,
                reflection TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(user_id, checkin_date),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS supervision_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                invite_code TEXT NOT NULL UNIQUE,
                created_by INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                UNIQUE(group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES supervision_groups (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS feed_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                actor_user_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (group_id) REFERENCES supervision_groups (id) ON DELETE CASCADE,
                FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE CASCADE
            );
            """
        )


init_db()


def serialize_profile(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "nickname": row["nickname"],
        "avatar_emoji": row["avatar_emoji"],
        "sober_start_date": row["sober_start_date"],
        "daily_budget": float(row["daily_budget"]),
    }


def compute_sober_days(start_date_str: str) -> int:
    start = date.fromisoformat(start_date_str)
    return max((date.today() - start).days + 1, 1)


def compute_streak_days(checkin_dates: list[str], today: date | None = None) -> int:
    current = today or date.today()
    history = {date.fromisoformat(item) for item in checkin_dates}
    streak = 0
    while current in history:
        streak += 1
        current -= timedelta(days=1)
    return streak


def get_user_row(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return row


def auth_user(x_session_token: str | None = Header(default=None)) -> dict[str, Any]:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="缺少会话令牌")
    with get_db() as conn:
        session = conn.execute(
            "SELECT * FROM sessions WHERE token = ?",
            (x_session_token,),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=401, detail="无效会话")
        conn.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE id = ?",
            (now_iso(), session["id"]),
        )
        user = get_user_row(conn, session["user_id"])
        return {"user_id": user["id"], "profile": serialize_profile(user), "token": x_session_token}


def ensure_group_membership(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT g.*
        FROM supervision_groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.id DESC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()


def require_group_owner(conn: sqlite3.Connection, group_id: int, user_id: int) -> None:
    row = conn.execute(
        """
        SELECT role
        FROM group_members
        WHERE group_id = ? AND user_id = ?
        """,
        (group_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="当前账号未加入监督群组")
    if row["role"] != "owner":
        raise HTTPException(status_code=403, detail="只有群主可以修改群组")


def create_feed_event(
    conn: sqlite3.Connection,
    group_id: int,
    actor_user_id: int,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    conn.execute(
        """
        INSERT INTO feed_events (group_id, actor_user_id, event_type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (group_id, actor_user_id, event_type, json.dumps(payload, ensure_ascii=False), now_iso()),
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/session/init", response_model=SessionInitResponse)
def session_init() -> SessionInitResponse:
    token = secrets.token_urlsafe(24)
    created_at = now_iso()
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (nickname, avatar_emoji, sober_start_date, daily_budget, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("清饮用户", "🌿", date.today().isoformat(), 48, created_at),
        )
        user_id = cursor.lastrowid
        conn.execute(
            """
            INSERT INTO sessions (token, user_id, created_at, last_seen_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, created_at, created_at),
        )
        user = get_user_row(conn, user_id)
    return SessionInitResponse(token=token, profile=serialize_profile(user))


@app.get("/api/profile")
def get_profile(user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    return user["profile"]


@app.put("/api/profile")
def update_profile(payload: ProfileUpdatePayload, user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    with get_db() as conn:
        conn.execute(
            """
            UPDATE users
            SET nickname = ?, avatar_emoji = ?, sober_start_date = ?, daily_budget = ?
            WHERE id = ?
            """,
            (
                payload.nickname,
                payload.avatar_emoji,
                payload.sober_start_date.isoformat(),
                payload.daily_budget,
                user["user_id"],
            ),
        )
        row = get_user_row(conn, user["user_id"])
    return serialize_profile(row)


@app.get("/api/checkins/today")
def checkin_today(user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    today = date.today().isoformat()
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT mood, reflection, created_at
            FROM checkins
            WHERE user_id = ? AND checkin_date = ?
            """,
            (user["user_id"], today),
        ).fetchone()
    return {"date": today, "checked_in": bool(row), "entry": dict(row) if row else None}


@app.post("/api/checkins")
def create_checkin(payload: CheckinPayload, user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    if payload.mood not in MOODS:
        raise HTTPException(status_code=422, detail="无效心情")
    today = date.today().isoformat()
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?",
            (user["user_id"], today),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="今天已经打卡过了")

        conn.execute(
            """
            INSERT INTO checkins (user_id, checkin_date, mood, reflection, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user["user_id"], today, payload.mood, payload.reflection.strip(), now_iso()),
        )
        group = ensure_group_membership(conn, user["user_id"])
        if group:
            create_feed_event(
                conn,
                group["id"],
                user["user_id"],
                "checkin",
                {"mood": payload.mood, "reflection": payload.reflection.strip()},
            )
    return {"success": True, "date": today}


@app.post("/api/dev/reset-today-checkin")
def reset_today_checkin(user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    if not is_dev_mode():
        raise HTTPException(status_code=403, detail="当前环境不允许使用开发工具")

    today = date.today().isoformat()
    with get_db() as conn:
        group = ensure_group_membership(conn, user["user_id"])
        deleted_checkins = conn.execute(
            "DELETE FROM checkins WHERE user_id = ? AND checkin_date = ?",
            (user["user_id"], today),
        ).rowcount
        deleted_events = 0
        if group:
            deleted_events = conn.execute(
                """
                DELETE FROM feed_events
                WHERE group_id = ? AND actor_user_id = ? AND event_type = 'checkin'
                  AND substr(created_at, 1, 10) = ?
                """,
                (group["id"], user["user_id"], today),
            ).rowcount
    return {"reset": bool(deleted_checkins), "deleted_checkins": deleted_checkins, "deleted_events": deleted_events}


@app.get("/api/checkins/calendar")
def checkin_calendar(month: str, user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    month_prefix = f"{month}-"
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT checkin_date, mood
            FROM checkins
            WHERE user_id = ? AND checkin_date LIKE ?
            ORDER BY checkin_date ASC
            """,
            (user["user_id"], f"{month_prefix}%"),
        ).fetchall()
    return {"month": month, "days": [dict(row) for row in rows]}


@app.get("/api/stats/summary")
def stats_summary(user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    with get_db() as conn:
        profile = get_user_row(conn, user["user_id"])
        total_checkins = conn.execute(
            "SELECT COUNT(*) AS count FROM checkins WHERE user_id = ?",
            (user["user_id"],),
        ).fetchone()["count"]
        all_checkin_dates = [
            row["checkin_date"]
            for row in conn.execute(
                """
                SELECT checkin_date
                FROM checkins
                WHERE user_id = ?
                ORDER BY checkin_date DESC
                """,
                (user["user_id"],),
            ).fetchall()
        ]
        last_checkins = conn.execute(
            """
            SELECT checkin_date, mood
            FROM checkins
            WHERE user_id = ?
            ORDER BY checkin_date DESC
            LIMIT 7
            """,
            (user["user_id"],),
        ).fetchall()
    daily_budget = float(profile["daily_budget"])
    return {
        "sober_days": compute_sober_days(profile["sober_start_date"]),
        "streak_days": compute_streak_days(all_checkin_dates),
        "total_checkins": total_checkins,
        "saved_amount": round(total_checkins * daily_budget, 2),
        "daily_budget": daily_budget,
        "recent_moods": [dict(row) for row in reversed(last_checkins)],
    }


@app.post("/api/groups")
def create_group(payload: GroupCreatePayload, user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    invite_code = secrets.token_hex(3).upper()
    with get_db() as conn:
        existing_group = ensure_group_membership(conn, user["user_id"])
        if existing_group:
            raise HTTPException(status_code=409, detail="当前账号已加入监督群组")
        cursor = conn.execute(
            """
            INSERT INTO supervision_groups (name, invite_code, created_by, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (payload.name.strip(), invite_code, user["user_id"], now_iso()),
        )
        group_id = cursor.lastrowid
        conn.execute(
            """
            INSERT INTO group_members (group_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
            """,
            (group_id, user["user_id"], "owner", now_iso()),
        )
        create_feed_event(
            conn,
            group_id,
            user["user_id"],
            "group_created",
            {"group_name": payload.name.strip()},
        )
    return {"group_name": payload.name.strip(), "invite_code": invite_code}


@app.post("/api/groups/join")
def join_group(payload: GroupJoinPayload, user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    with get_db() as conn:
        existing_group = ensure_group_membership(conn, user["user_id"])
        if existing_group:
            raise HTTPException(status_code=409, detail="当前账号已加入监督群组")
        group = conn.execute(
            "SELECT * FROM supervision_groups WHERE invite_code = ?",
            (payload.invite_code.upper(),),
        ).fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="邀请码不存在")
        conn.execute(
            """
            INSERT INTO group_members (group_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
            """,
            (group["id"], user["user_id"], "member", now_iso()),
        )
        create_feed_event(
            conn,
            group["id"],
            user["user_id"],
            "member_joined",
            {"invite_code": payload.invite_code.upper()},
        )
    return {"joined": True, "group_name": group["name"]}


@app.put("/api/groups/current")
def update_current_group(payload: GroupUpdatePayload, user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    if payload.name is None and not payload.refresh_invite_code:
        raise HTTPException(status_code=422, detail="至少提交一项群组修改")

    with get_db() as conn:
        group = ensure_group_membership(conn, user["user_id"])
        if not group:
            raise HTTPException(status_code=404, detail="当前账号未加入监督群组")

        require_group_owner(conn, group["id"], user["user_id"])
        group_name = group["name"]
        invite_code = group["invite_code"]

        if payload.name is not None:
            group_name = payload.name.strip()
            conn.execute(
                "UPDATE supervision_groups SET name = ? WHERE id = ?",
                (group_name, group["id"]),
            )
            create_feed_event(
                conn,
                group["id"],
                user["user_id"],
                "group_updated",
                {"group_name": group_name},
            )

        if payload.refresh_invite_code:
            invite_code = secrets.token_hex(3).upper()
            conn.execute(
                "UPDATE supervision_groups SET invite_code = ? WHERE id = ?",
                (invite_code, group["id"]),
            )
            create_feed_event(
                conn,
                group["id"],
                user["user_id"],
                "invite_code_refreshed",
                {"invite_code": invite_code},
            )

    return {"group": {"name": group_name, "invite_code": invite_code}}


@app.get("/api/groups/current")
def current_group(user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    today = date.today().isoformat()
    with get_db() as conn:
        group = ensure_group_membership(conn, user["user_id"])
        if not group:
            return {"group": None, "members": []}

        rows = conn.execute(
            """
            SELECT
                u.id,
                u.nickname,
                u.avatar_emoji,
                u.sober_start_date,
                u.daily_budget,
                gm.role,
                c.checkin_date,
                c.mood,
                c.reflection,
                (SELECT COUNT(*) FROM checkins ck WHERE ck.user_id = u.id) AS total_checkins,
                (
                    SELECT GROUP_CONCAT(ck2.checkin_date)
                    FROM checkins ck2
                    WHERE ck2.user_id = u.id
                ) AS checkin_date_history
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            LEFT JOIN checkins c
              ON c.user_id = u.id
             AND c.checkin_date = (
                 SELECT MAX(checkin_date) FROM checkins WHERE user_id = u.id
             )
            WHERE gm.group_id = ?
            ORDER BY gm.role DESC, gm.joined_at ASC
            """,
            (group["id"],),
        ).fetchall()

    members = []
    for row in rows:
        members.append(
            {
                "user_id": row["id"],
                "nickname": row["nickname"],
                "avatar_emoji": row["avatar_emoji"],
                "role": row["role"],
                "sober_days": compute_sober_days(row["sober_start_date"]),
                "streak_days": compute_streak_days(
                    [item for item in (row["checkin_date_history"] or "").split(",") if item],
                ),
                "checked_in_today": row["checkin_date"] == today,
                "latest_mood": row["mood"],
                "latest_reflection": row["reflection"] or "",
                "saved_amount": round(float(row["daily_budget"]) * int(row["total_checkins"]), 2),
            }
        )

    viewer_role = "member"
    for member in members:
        if member["user_id"] == user["user_id"]:
            viewer_role = member["role"]
            break

    return {
        "group": {"name": group["name"], "invite_code": group["invite_code"], "viewer_role": viewer_role},
        "members": members,
    }


@app.get("/api/groups/feed")
def group_feed(user: dict[str, Any] = Depends(auth_user)) -> dict[str, Any]:
    with get_db() as conn:
        group = ensure_group_membership(conn, user["user_id"])
        if not group:
            return {"items": []}

        rows = conn.execute(
            """
            SELECT f.event_type, f.payload_json, f.created_at, u.nickname, u.avatar_emoji
            FROM feed_events f
            JOIN users u ON u.id = f.actor_user_id
            WHERE f.group_id = ?
            ORDER BY f.id DESC
            LIMIT 20
            """,
            (group["id"],),
        ).fetchall()

    items = []
    for row in rows:
        payload = json.loads(row["payload_json"])
        items.append(
            {
                "event_type": row["event_type"],
                "nickname": row["nickname"],
                "avatar_emoji": row["avatar_emoji"],
                "created_at": row["created_at"],
                "payload": payload,
            }
        )
    return {"items": items}
