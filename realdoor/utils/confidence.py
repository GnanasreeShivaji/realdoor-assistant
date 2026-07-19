"""Confidence scoring for extracted fields.

Combines three signals:
  - regex specificity (did we match a strict pattern?)
  - context density   (surrounding tokens matched the field's vocabulary)
  - value sanity      (parses as expected type / plausible range)
"""
from __future__ import annotations

import re
from datetime import datetime


def score(value: str | None, kind: str, context: str = "") -> float:
    if value is None or str(value).strip() == "":
        return 0.0

    v = str(value).strip()
    base = 0.55  # a regex fired at all → decent floor
    ctx = context.lower()

    if kind == "money":
        base += 0.15 if re.match(r"^\$?\d[\d,]*(\.\d{2})?$", v) else -0.10
        if any(k in ctx for k in ("gross", "net pay", "total", "ytd", "wages", "amount", "balance")):
            base += 0.15
    elif kind == "date":
        try:
            _ = datetime.strptime(v, "%Y-%m-%d")
            base += 0.20
        except ValueError:
            base -= 0.10
        if any(k in ctx for k in ("pay period", "issued", "date", "effective", "expires", "dob")):
            base += 0.10
    elif kind == "name":
        base += 0.10 if re.match(r"^[A-Z][a-zA-Z\-']+(\s+[A-Z][a-zA-Z\-']+){1,3}$", v) else -0.05
        if any(k in ctx for k in ("name", "employee", "tenant", "member")):
            base += 0.10
    elif kind == "ssn":
        base += 0.20 if re.match(r"^\d{3}-\d{2}-\d{4}$", v) else -0.20
    elif kind == "id":
        base += 0.10 if 4 <= len(v) <= 20 else -0.05
    elif kind == "address":
        base += 0.10 if re.search(r"\d+\s+\S+", v) else -0.05
    elif kind == "employer":
        base += 0.10

    return round(max(0.05, min(0.99, base)), 2)
