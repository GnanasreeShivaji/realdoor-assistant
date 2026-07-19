"""Evidence-bound rule retrieval and transparent calculation helpers."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

import pandas as pd

from utils.models import RuleAnswer
from utils.paths import MTSP_LIMITS, RULE_CORPUS

ABSTENTION = "I cannot answer because this information is not available in the provided rule documents."
DECISION_TERMS = ("eligible", "eligibility", "approve", "approved", "deny", "denied", "priority", "rank")


@lru_cache(maxsize=1)
def load_rules() -> list[dict[str, Any]]:
    if not RULE_CORPUS.exists():
        return []
    return [json.loads(line) for line in RULE_CORPUS.read_text(encoding="utf-8").splitlines() if line.strip()]


def _tokens(value: str) -> set[str]:
    stop = {"the", "a", "an", "is", "are", "for", "of", "to", "and", "what", "how", "my", "do"}
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) > 2 and token not in stop}


def answer_rule_question(question: str) -> RuleAnswer:
    lowered = question.lower()
    if any(term in lowered for term in DECISION_TERMS):
        return RuleAnswer(
            answer="RealDoor cannot determine eligibility, approval, denial, ranking, or priority. It can only retrieve documented rules and show calculations for a qualified reviewer.",
            rule_id=None, citation=None, page_or_locator=None, effective_date=None,
            confidence=1.0, abstained=True,
        )
    query_tokens = _tokens(question)
    ranked = []
    for rule in load_rules():
        rule_tokens = _tokens(f"{rule.get('text', '')} {rule.get('source_locator', '')}")
        overlap = len(query_tokens & rule_tokens)
        coverage = overlap / max(1, len(query_tokens))
        ranked.append((overlap, coverage, rule))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    if not ranked or ranked[0][0] < 1 or ranked[0][1] < .16:
        return RuleAnswer(ABSTENTION, None, None, None, None, 0.0, abstained=True)
    overlap, coverage, rule = ranked[0]
    confidence = min(.98, .62 + coverage * .35 + min(overlap, 4) * .02)
    return RuleAnswer(
        answer=rule["text"], rule_id=rule["rule_id"], citation=rule.get("source_url"),
        page_or_locator=rule.get("source_locator"), effective_date=rule.get("effective_date"),
        confidence=confidence,
    )


def annualize(amount: float, frequency: str) -> tuple[float, str]:
    multipliers = {"weekly": 52, "biweekly": 26, "bi-weekly": 26, "semimonthly": 24,
                   "semi-monthly": 24, "monthly": 12, "annual": 1, "annually": 1}
    multiplier = multipliers.get(str(frequency).lower())
    if multiplier is None:
        raise ValueError("A supported pay frequency is required for annualization.")
    return amount * multiplier, f"${amount:,.2f} × {multiplier} {frequency} periods"


def threshold_for(household_size: int, percent: int = 60) -> tuple[float | None, str]:
    if not MTSP_LIMITS.exists():
        return None, ""
    frame = pd.read_csv(MTSP_LIMITS)
    # The frozen starter data may be in wide or long form; support both.
    columns = {str(column).lower(): column for column in frame.columns}
    if "household_size" in columns:
        row = frame[frame[columns["household_size"]] == household_size]
        candidates = [key for key in columns if str(percent) in key and ("limit" in key or "%" in key)]
        if not row.empty and candidates:
            return float(row.iloc[0][columns[candidates[0]]]), "FY 2026 frozen MTSP table"
    for column in frame.columns:
        if str(column).strip() in {str(household_size), f"{household_size} Person"}:
            candidate_rows = frame[frame.astype(str).apply(lambda row: row.str.contains(f"{percent}%", case=False).any(), axis=1)]
            if not candidate_rows.empty:
                return float(candidate_rows.iloc[0][column]), "FY 2026 frozen MTSP table"
    # Exact frozen values from the supplied HUD-MTSP-002 corpus entry.
    frozen_60 = [72000, 82320, 92580, 102840, 111120, 119340, 127560, 135780]
    if percent == 60 and 1 <= household_size <= 8:
        return float(frozen_60[household_size - 1]), "HUD-MTSP-002, PDF page 130"
    return None, ""

