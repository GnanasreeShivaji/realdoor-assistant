"""Typed application models.

The challenge requires an explicit field allowlist. Keeping the data contracts here
makes it difficult for OCR or a model to silently add sensitive attributes.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


ALLOWED_FIELDS = {
    "person_name",
    "household_size",
    "address",
    "application_date",
    "pay_date",
    "pay_period_start",
    "pay_period_end",
    "pay_frequency",
    "regular_hours",
    "hourly_rate",
    "gross_pay",
    "net_pay",
    "employer_name",
    "employment_start_date",
    "annual_salary",
    "benefit_type",
    "benefit_amount",
    "benefit_frequency",
    "letter_date",
    "statement_date",
    "gig_gross_income",
}


@dataclass
class Evidence:
    page: int = 1
    bbox: list[float] | None = None
    excerpt: str = ""
    bbox_units: str = "pdf_points_bottom_left_origin"


@dataclass
class ExtractedField:
    name: str
    value: Any
    confidence: float
    source_document: str
    evidence: Evidence = field(default_factory=Evidence)
    confirmed: bool = False
    original_value: Any = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RuleAnswer:
    answer: str
    rule_id: str | None
    citation: str | None
    page_or_locator: str | None
    effective_date: str | None
    confidence: float
    formula: str | None = None
    abstained: bool = False


@dataclass
class ReadinessItem:
    label: str
    status: str  # complete, missing, expired, review
    detail: str
    document_type: str | None = None

