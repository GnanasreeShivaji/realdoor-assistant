"""Application-readiness checklist logic.

Compares required document types (from the frozen challenge checklists) to
what the user has uploaded. Measures completeness ONLY — never eligibility.
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from dateutil import parser as dateparser

from .extractor import DOC_TYPE_LABELS

CHECKLIST_PATH = Path(__file__).resolve().parent.parent / "data" / "application_checklists.json"

# Challenge convention: documents older than 60 days are stale.
STALE_DAYS = 60


def load_checklist(household_id: str) -> dict[str, Any] | None:
    if not CHECKLIST_PATH.exists():
        return None
    data = json.loads(CHECKLIST_PATH.read_text())
    for row in data:
        if row.get("household_id") == household_id:
            return row
    return data[0] if data else None


def _doc_date(doc: dict) -> date | None:
    for k in ("pay_period_end", "statement_date", "effective_date",
              "bill_date", "start_date", "lease_start"):
        val = (doc.get("fields", {}).get(k, {}) or {}).get("value")
        if not val:
            continue
        try:
            return dateparser.parse(val).date()
        except Exception:
            pass
    return None


def build(household_id: str, documents: list[dict], as_of: str) -> dict[str, Any]:
    row = load_checklist(household_id) or {"required_document_types": ["pay_stub", "government_id"]}
    required: list[str] = row.get("required_document_types", [])
    as_of_d = dateparser.parse(as_of).date()
    stale_before = as_of_d - timedelta(days=STALE_DAYS)

    by_type: dict[str, list[dict]] = {}
    for d in documents:
        by_type.setdefault(d["doc_type"], []).append(d)

    items = []
    present, missing, expired = [], [], []
    for req in required:
        docs = by_type.get(req, [])
        if not docs:
            items.append({"type": req, "label": DOC_TYPE_LABELS.get(req, req), "status": "missing"})
            missing.append(req)
            continue
        newest_d = max((_doc_date(d) or date.min) for d in docs)
        if newest_d < stale_before:
            items.append({
                "type": req, "label": DOC_TYPE_LABELS.get(req, req),
                "status": "expired",
                "detail": f"newest dated {newest_d.isoformat()}",
            })
            expired.append(req)
        else:
            items.append({"type": req, "label": DOC_TYPE_LABELS.get(req, req), "status": "present"})
            present.append(req)

    # Extras user uploaded but not required
    for t, docs in by_type.items():
        if t not in required:
            items.append({"type": t, "label": DOC_TYPE_LABELS.get(t, t) + " (extra)",
                          "status": "present"})

    readiness_pct = int(round(100 * len(present) / max(1, len(required))))
    # Rough time estimate: 2 min per outstanding item
    remaining = len(missing) + len(expired)
    est_min = max(0, remaining * 2)

    return {
        "items": items,
        "present": present,
        "missing": missing,
        "expired": expired,
        "readiness_pct": readiness_pct,
        "estimated_minutes": est_min,
        "required": required,
    }
