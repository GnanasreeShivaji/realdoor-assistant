"""Document classification + field extraction.

Deterministic regex first (fast, cheap, auditable). If OPENAI_API_KEY is set,
we optionally ask GPT to fill only the fields regex missed, still returning
the raw evidence string for every filled field so the UI can highlight it.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

from .confidence import score

DOC_TYPES = [
    "pay_stub", "bank_statement", "benefit_letter", "employment_letter",
    "government_id", "lease", "utility_bill", "application_summary",
]

DOC_TYPE_LABELS = {
    "pay_stub": "Pay Stub",
    "bank_statement": "Bank Statement",
    "benefit_letter": "Benefit Letter",
    "employment_letter": "Employment Letter",
    "government_id": "Government ID",
    "lease": "Lease",
    "utility_bill": "Utility Bill",
    "application_summary": "Application Summary",
}

_CLASSIFY_HINTS = {
    "pay_stub":         [r"pay\s*stub", r"gross\s+pay", r"net\s+pay", r"ytd", r"pay\s+period"],
    "bank_statement":   [r"bank\s+statement", r"account\s+summary", r"beginning\s+balance", r"ending\s+balance"],
    "benefit_letter":   [r"social\s+security", r"benefit\s+letter", r"ssa", r"snap", r"tanf", r"award\s+letter"],
    "employment_letter":[r"to\s+whom\s+it\s+may\s+concern", r"is\s+employed", r"employment\s+verification"],
    "government_id":    [r"driver'?s?\s+license", r"identification\s+card", r"passport", r"date\s+of\s+birth"],
    "lease":            [r"lease\s+agreement", r"landlord", r"tenant", r"monthly\s+rent"],
    "utility_bill":     [r"electric", r"gas\s+bill", r"utility", r"kwh", r"service\s+address"],
    "application_summary":[r"application\s+summary", r"household\s+id"],
}


def classify(text: str, filename: str = "") -> str:
    hay = f"{filename}\n{text}".lower()
    best, best_hits = "pay_stub", 0
    for t, patterns in _CLASSIFY_HINTS.items():
        hits = sum(1 for p in patterns if re.search(p, hay))
        if hits > best_hits:
            best, best_hits = t, hits
    return best


# ---- Regex helpers ------------------------------------------------------

_MONEY = r"\$?\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})"
_DATE  = r"(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})"


def _search(pattern: str, text: str, flags=re.I) -> tuple[str | None, str]:
    m = re.search(pattern, text, flags)
    if not m:
        return None, ""
    val = m.group(m.lastindex or 0)
    start = max(0, m.start() - 40); end = min(len(text), m.end() + 40)
    return val.strip(), text[start:end].replace("\n", " ")


def _norm_money(v: str | None) -> str | None:
    if v is None: return None
    return v.replace("$", "").replace(",", "").strip()


def _norm_date(v: str | None) -> str | None:
    if v is None: return None
    from dateutil import parser as dp
    try:
        return dp.parse(v, dayfirst=False, fuzzy=True).date().isoformat()
    except Exception:
        return v


def _field(value, kind: str, evidence: str, source: str) -> dict[str, Any]:
    return {
        "value": value,
        "kind": kind,
        "confidence": score(value, kind, evidence),
        "evidence": evidence,
        "source": source,
    }


def extract(text: str, doc_type: str, filename: str) -> dict[str, Any]:
    """Return {field_name: {value, confidence, evidence, source}}."""
    out: dict[str, Any] = {}
    t = text or ""

    if doc_type == "pay_stub":
        name, ev = _search(r"(?:Employee|Name)[:\s]+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+){1,3})", t)
        out["employee_name"] = _field(name, "name", ev, filename)

        emp, ev = _search(r"(?:Employer|Company)[:\s]+([A-Z][A-Za-z0-9&,.\-'\s]{2,60})", t)
        out["employer"] = _field((emp or "").strip(", "), "employer", ev, filename)

        gross, ev = _search(r"gross(?:\s+pay|\s+wages)?[^$\n]{0,20}" + _MONEY, t)
        out["gross_pay_period"] = _field(_norm_money(gross), "money", ev, filename)

        ytd, ev = _search(r"ytd[^$\n]{0,20}" + _MONEY, t)
        out["ytd_gross"] = _field(_norm_money(ytd), "money", ev, filename)

        freq, ev = _search(r"pay\s+frequency[:\s]+(weekly|biweekly|bi-weekly|semi-monthly|monthly)", t)
        out["pay_frequency"] = _field((freq or "").lower().replace("bi-weekly", "biweekly"), "id", ev, filename)

        period_end, ev = _search(r"pay\s+period\s+end[:\s]+" + _DATE, t)
        out["pay_period_end"] = _field(_norm_date(period_end), "date", ev, filename)

    elif doc_type == "bank_statement":
        holder, ev = _search(r"(?:Account\s+Holder|Name)[:\s]+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+){1,3})", t)
        out["account_holder"] = _field(holder, "name", ev, filename)

        acct, ev = _search(r"account\s+(?:number|#)[:\s]+(\*+\d{2,4}|\d{4,})", t)
        out["account_number"] = _field(acct, "id", ev, filename)

        beg, ev = _search(r"beginning\s+balance[^$\n]{0,20}" + _MONEY, t)
        out["beginning_balance"] = _field(_norm_money(beg), "money", ev, filename)

        end, ev = _search(r"ending\s+balance[^$\n]{0,20}" + _MONEY, t)
        out["ending_balance"] = _field(_norm_money(end), "money", ev, filename)

        stmt, ev = _search(r"statement\s+date[:\s]+" + _DATE, t)
        out["statement_date"] = _field(_norm_date(stmt), "date", ev, filename)

    elif doc_type == "benefit_letter":
        name, ev = _search(r"(?:Recipient|Beneficiary|Name)[:\s]+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+){1,3})", t)
        out["recipient_name"] = _field(name, "name", ev, filename)

        prog, ev = _search(r"(social\s+security|ssi|ssdi|snap|tanf|section\s+8)", t)
        out["program"] = _field((prog or "").upper(), "id", ev, filename)

        amt, ev = _search(r"(?:monthly|benefit)\s+amount[^$\n]{0,20}" + _MONEY, t)
        out["monthly_benefit"] = _field(_norm_money(amt), "money", ev, filename)

        eff, ev = _search(r"effective\s+date[:\s]+" + _DATE, t)
        out["effective_date"] = _field(_norm_date(eff), "date", ev, filename)

    elif doc_type == "employment_letter":
        name, ev = _search(r"(?:this\s+is\s+to\s+confirm\s+that\s+)?([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+){1,3})\s+(?:is|has\s+been)\s+employed", t)
        out["employee_name"] = _field(name, "name", ev, filename)

        emp, ev = _search(r"employed\s+by\s+([A-Z][A-Za-z0-9&,.\-'\s]{2,60})", t)
        out["employer"] = _field((emp or "").strip(", "), "employer", ev, filename)

        salary, ev = _search(r"(?:annual\s+salary|salary)[^$\n]{0,20}" + _MONEY, t)
        out["annual_salary"] = _field(_norm_money(salary), "money", ev, filename)

        start, ev = _search(r"(?:start\s+date|since)[:\s]+" + _DATE, t)
        out["start_date"] = _field(_norm_date(start), "date", ev, filename)

    elif doc_type == "government_id":
        name, ev = _search(r"(?:Name)[:\s]+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+){1,3})", t)
        out["full_name"] = _field(name, "name", ev, filename)

        dob, ev = _search(r"(?:DOB|Date\s+of\s+Birth)[:\s]+" + _DATE, t)
        out["date_of_birth"] = _field(_norm_date(dob), "date", ev, filename)

        exp, ev = _search(r"(?:Exp|Expires)[:\s]+" + _DATE, t)
        out["expiration_date"] = _field(_norm_date(exp), "date", ev, filename)

        idn, ev = _search(r"(?:ID|License)\s*#?[:\s]+([A-Z0-9\-]{5,20})", t)
        out["id_number"] = _field(idn, "id", ev, filename)

    elif doc_type == "lease":
        tenant, ev = _search(r"tenant[:\s]+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+){1,3})", t)
        out["tenant_name"] = _field(tenant, "name", ev, filename)

        addr, ev = _search(r"(?:premises|unit\s+address)[:\s]+([0-9]+\s+[A-Za-z0-9,.\s]{5,80})", t)
        out["unit_address"] = _field(addr, "address", ev, filename)

        rent, ev = _search(r"monthly\s+rent[^$\n]{0,20}" + _MONEY, t)
        out["monthly_rent"] = _field(_norm_money(rent), "money", ev, filename)

        start, ev = _search(r"lease\s+start[:\s]+" + _DATE, t)
        out["lease_start"] = _field(_norm_date(start), "date", ev, filename)

    elif doc_type == "utility_bill":
        acct, ev = _search(r"account\s+(?:number|#)[:\s]+([A-Z0-9\-]{4,20})", t)
        out["account_number"] = _field(acct, "id", ev, filename)

        addr, ev = _search(r"service\s+address[:\s]+([0-9]+\s+[A-Za-z0-9,.\s]{5,80})", t)
        out["service_address"] = _field(addr, "address", ev, filename)

        bill_date, ev = _search(r"(?:bill|statement)\s+date[:\s]+" + _DATE, t)
        out["bill_date"] = _field(_norm_date(bill_date), "date", ev, filename)

        amount, ev = _search(r"amount\s+due[^$\n]{0,20}" + _MONEY, t)
        out["amount_due"] = _field(_norm_money(amount), "money", ev, filename)

    # Prune empty
    out = {k: v for k, v in out.items() if v.get("value")}

    # Optional GPT top-up for empty required fields
    if os.getenv("OPENAI_API_KEY") and doc_type in DOC_TYPES:
        try:
            out = _gpt_fill(out, t, doc_type, filename)
        except Exception:
            pass

    return out


def _gpt_fill(current: dict, text: str, doc_type: str, filename: str) -> dict:
    """Ask GPT for JSON completion of missing fields for this doc type."""
    from openai import OpenAI

    schemas = {
        "pay_stub": ["employee_name", "employer", "gross_pay_period", "ytd_gross", "pay_frequency", "pay_period_end"],
        "bank_statement": ["account_holder", "account_number", "beginning_balance", "ending_balance", "statement_date"],
        "benefit_letter": ["recipient_name", "program", "monthly_benefit", "effective_date"],
        "employment_letter": ["employee_name", "employer", "annual_salary", "start_date"],
        "government_id": ["full_name", "date_of_birth", "expiration_date", "id_number"],
        "lease": ["tenant_name", "unit_address", "monthly_rent", "lease_start"],
        "utility_bill": ["account_number", "service_address", "bill_date", "amount_due"],
    }
    wanted = [f for f in schemas.get(doc_type, []) if f not in current]
    if not wanted or not text.strip():
        return current

    client = OpenAI()
    prompt = (
        f"Document type: {doc_type}. Extract ONLY these fields as JSON: {wanted}. "
        "For each field return an object with keys value (string) and evidence "
        "(short quoted snippet from the text). Money as digits only. Dates ISO. "
        "If not present, omit the key. No prose.\n\nDOCUMENT TEXT:\n" + text[:6000]
    )
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You extract structured fields. Never invent values."},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )
    try:
        payload = json.loads(r.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        return current

    for k, obj in payload.items():
        if not isinstance(obj, dict) or not obj.get("value"):
            continue
        kind = "money" if "salary" in k or "balance" in k or "rent" in k or "gross" in k or "benefit" in k or "amount" in k else (
            "date" if "date" in k or "start" in k or "end" in k else (
                "name" if "name" in k else "id"
            )
        )
        current[k] = _field(str(obj["value"]), kind, str(obj.get("evidence", ""))[:200], filename + " (LLM)")
    return current
