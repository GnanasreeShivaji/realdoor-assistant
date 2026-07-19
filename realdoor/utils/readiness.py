"""Document-completeness assessment. This module never assesses eligibility."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from utils.models import ReadinessItem
from utils.paths import CHECKLISTS

DISPLAY_NAMES = {
    "application_summary": "Application Summary", "pay_stub": "Pay Stub",
    "employment_letter": "Employment Letter", "benefit_letter": "Benefit Letter",
    "gig_income_corroboration": "Gig Income Corroboration", "gig_statement": "Gig Statement",
}


@lru_cache(maxsize=1)
def load_checklists() -> list[dict[str, Any]]:
    if not CHECKLISTS.exists():
        return []
    return json.loads(CHECKLISTS.read_text(encoding="utf-8"))


def assess_readiness(documents: list[dict[str, Any]], household_id: str | None = None) -> dict[str, Any]:
    supplied = {str(doc.get("document_type", "")).lower().replace(" ", "_") for doc in documents}
    checklist = next((item for item in load_checklists() if item["household_id"] == household_id), None)
    required = checklist["required_document_types"] if checklist else ["application_summary", "pay_stub", "employment_letter"]
    review_reasons = checklist.get("expected_review_reasons", []) if checklist else []
    items: list[ReadinessItem] = []
    for document_type in required:
        if document_type in supplied:
            items.append(ReadinessItem(DISPLAY_NAMES.get(document_type, document_type.replace("_", " ").title()), "complete", "Uploaded and indexed", document_type))
        else:
            items.append(ReadinessItem(DISPLAY_NAMES.get(document_type, document_type.replace("_", " ").title()), "missing", "Required document has not been uploaded", document_type))
    for reason in review_reasons:
        status = "expired" if "EXPIRED" in reason else "review"
        label = reason.replace("_", " ").title()
        items.append(ReadinessItem(label, status, "A qualified reviewer should verify this issue."))
    complete = sum(item.status == "complete" for item in items)
    score = round(100 * complete / max(1, len(required)))
    missing_count = sum(item.status == "missing" for item in items)
    review_count = sum(item.status in {"review", "expired"} for item in items)
    if missing_count:
        status = "INCOMPLETE"
    elif review_count:
        status = "NEEDS REVIEW"
    else:
        status = "READY FOR REVIEW"
    return {
        "score": score, "status": status, "items": items,
        "estimated_minutes": max(1, missing_count * 2 + review_count * 2),
        "disclaimer": "This score measures document completeness only. It does not indicate eligibility.",
    }

