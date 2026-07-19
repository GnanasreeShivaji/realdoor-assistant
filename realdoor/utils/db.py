"""Tiny SQLite persistence layer for autosave + history."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "realdoor.db"


def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              household_id TEXT,
              created_at REAL,
              updated_at REAL,
              profile_json TEXT,
              documents_json TEXT
            );
            CREATE TABLE IF NOT EXISTS rule_queries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ts REAL,
              question TEXT,
              answer TEXT,
              citations_json TEXT,
              confidence REAL
            );
            """
        )


def save_session(household_id: str, profile: dict, documents: list[dict]) -> int:
    init()
    now = time.time()
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO sessions(household_id, created_at, updated_at, profile_json, documents_json)"
            " VALUES(?,?,?,?,?)",
            (household_id, now, now, json.dumps(profile), json.dumps(documents, default=str)),
        )
        return cur.lastrowid


def list_sessions() -> list[dict]:
    init()
    with _conn() as c:
        rows = c.execute(
            "SELECT id, household_id, created_at, updated_at FROM sessions ORDER BY id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def load_session(session_id: int) -> dict[str, Any] | None:
    init()
    with _conn() as c:
        row = c.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["profile"] = json.loads(d.pop("profile_json") or "{}")
    d["documents"] = json.loads(d.pop("documents_json") or "[]")
    return d


def log_rule_query(question: str, answer: str, citations: list[dict], confidence: float):
    init()
    with _conn() as c:
        c.execute(
            "INSERT INTO rule_queries(ts, question, answer, citations_json, confidence) VALUES(?,?,?,?,?)",
            (time.time(), question, answer, json.dumps(citations), confidence),
        )


def list_rule_queries(limit: int = 100) -> list[dict]:
    init()
    with _conn() as c:
        rows = c.execute(
            "SELECT * FROM rule_queries ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["citations"] = json.loads(d.pop("citations_json") or "[]")
        out.append(d)
    return out
