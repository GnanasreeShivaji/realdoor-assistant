"""Confidence display helpers. Scores describe extraction certainty, never eligibility."""

from __future__ import annotations


def clamp(score: float) -> float:
    return max(0.0, min(1.0, float(score)))


def confidence_label(score: float) -> str:
    score = clamp(score)
    if score >= 0.90:
        return "High"
    if score >= 0.70:
        return "Medium"
    return "Needs review"


def confidence_percent(score: float) -> int:
    return round(clamp(score) * 100)


def aggregate_confidence(scores: list[float]) -> float:
    return sum(scores) / len(scores) if scores else 0.0

