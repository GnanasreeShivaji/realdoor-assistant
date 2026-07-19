"""SQLite persistence.

Only metadata, confirmed fields, user actions, and generated packet history are
persisted. Raw document text is intentionally excluded from logs.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from utils.paths import DB_PATH


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                household_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                consent_at TEXT,
                deleted_at TEXT
            );
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                document_type TEXT NOT NULL,
                sha256 TEXT NOT NULL,
                status TEXT NOT NULL,
                confidence REAL,
                processing_ms INTEGER,
                uploaded_at TEXT NOT NULL,
                persisted_path TEXT,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            );
            CREATE TABLE IF NOT EXISTS profile_fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                field_value TEXT,
                source_document TEXT NOT NULL,
                confidence REAL NOT NULL,
                evidence_json TEXT NOT NULL,
                confirmed INTEGER NOT NULL DEFAULT 0,
                original_value TEXT,
                updated_at TEXT NOT NULL,
                UNIQUE(session_id, field_name, source_document),
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            );
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS packets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                readiness_status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


def ensure_session(session_id: str, household_id: str | None = None) -> None:
    now = utc_now()
    with connection() as conn:
        conn.execute(
            """INSERT INTO sessions(id, household_id, created_at, updated_at)
               VALUES(?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,
               household_id=COALESCE(excluded.household_id, sessions.household_id)""",
            (session_id, household_id, now, now),
        )


def record_consent(session_id: str) -> None:
    now = utc_now()
    with connection() as conn:
        conn.execute("UPDATE sessions SET consent_at=?, updated_at=? WHERE id=?", (now, now, session_id))
    log_event(session_id, "CONSENT_RECORDED", {"scope": "synthetic_document_processing"})


def add_document(session_id: str, metadata: dict[str, Any]) -> None:
    """Insert a new document or refresh an identical reprocessed upload.

    Streamlit reruns make it easy to click extraction twice. Treating the same
    session + SHA-256 as one document keeps readiness counts and history sane.
    """
    now = utc_now()
    with connection() as conn:
        existing = conn.execute(
            "SELECT id FROM documents WHERE session_id=? AND sha256=?",
            (session_id, metadata["sha256"]),
        ).fetchone()
        values = (
            metadata["file_name"], metadata["document_type"], metadata.get("status", "processed"),
            metadata.get("confidence"), metadata.get("processing_ms"), now,
            metadata.get("persisted_path"),
        )
        if existing:
            conn.execute(
                """UPDATE documents SET file_name=?,document_type=?,status=?,confidence=?,
                   processing_ms=?,uploaded_at=?,persisted_path=COALESCE(?,persisted_path) WHERE id=?""",
                (*values, existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO documents(file_name,document_type,status,confidence,processing_ms,
                   uploaded_at,persisted_path,session_id,sha256) VALUES(?,?,?,?,?,?,?,?,?)""",
                (*values, session_id, metadata["sha256"]),
            )
    log_event(session_id, "DOCUMENT_REPROCESSED" if existing else "DOCUMENT_PROCESSED", {
        "file_name": metadata["file_name"],
        "document_type": metadata["document_type"],
        "sha256_prefix": metadata["sha256"][:12],
    })


def upsert_field(session_id: str, item: dict[str, Any]) -> None:
    evidence = json.dumps(item.get("evidence", {}), default=str)
    value = json.dumps(item.get("value"), default=str)
    original = json.dumps(item.get("original_value"), default=str)
    with connection() as conn:
        conn.execute(
            """INSERT INTO profile_fields(session_id,field_name,field_value,source_document,
               confidence,evidence_json,confirmed,original_value,updated_at)
               VALUES(?,?,?,?,?,?,?,?,?)
               ON CONFLICT(session_id,field_name,source_document) DO UPDATE SET
               field_value=excluded.field_value, confidence=excluded.confidence,
               evidence_json=excluded.evidence_json, confirmed=excluded.confirmed,
               original_value=excluded.original_value, updated_at=excluded.updated_at""",
            (session_id, item["name"], value, item["source_document"], item["confidence"],
             evidence, int(item.get("confirmed", False)), original, utc_now()),
        )


def get_fields(session_id: str) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT * FROM profile_fields WHERE session_id=? ORDER BY field_name, updated_at DESC",
            (session_id,),
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["value"] = json.loads(item.pop("field_value"))
        item["name"] = item.pop("field_name")
        item["evidence"] = json.loads(item.pop("evidence_json"))
        item["confirmed"] = bool(item["confirmed"])
        item["original_value"] = json.loads(item["original_value"] or "null")
        result.append(item)
    return result


def get_documents(session_id: str) -> list[dict[str, Any]]:
    with connection() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM documents WHERE session_id=? ORDER BY uploaded_at DESC", (session_id,)
        ).fetchall()]


def log_event(session_id: str, event_type: str, data: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute(
            "INSERT INTO audit_events(session_id,event_type,event_data,created_at) VALUES(?,?,?,?)",
            (session_id, event_type, json.dumps(data, default=str), utc_now()),
        )


def get_history(session_id: str) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_events WHERE session_id=? ORDER BY created_at DESC", (session_id,)
        ).fetchall()
    return [{**dict(r), "event_data": json.loads(r["event_data"])} for r in rows]


def add_packet(session_id: str, file_name: str, readiness_status: str) -> None:
    with connection() as conn:
        conn.execute(
            "INSERT INTO packets(session_id,file_name,readiness_status,created_at) VALUES(?,?,?,?)",
            (session_id, file_name, readiness_status, utc_now()),
        )
    log_event(session_id, "PACKET_GENERATED", {"file_name": file_name, "status": readiness_status})


def delete_session(session_id: str) -> list[str]:
    """Delete all session-linked records and return persisted file paths to remove."""
    with connection() as conn:
        paths = [r[0] for r in conn.execute(
            "SELECT persisted_path FROM documents WHERE session_id=? AND persisted_path IS NOT NULL",
            (session_id,),
        ).fetchall()]
        for table in ("documents", "profile_fields", "audit_events", "packets"):
            conn.execute(f"DELETE FROM {table} WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    return paths
