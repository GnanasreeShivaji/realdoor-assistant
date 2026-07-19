"""Rulebook retrieval engine.

Answers ONLY from `data/rule_corpus.jsonl`. Never uses general knowledge.
Two-stage: TF-IDF retrieval → optional GPT synthesis grounded in the retrieved
rule texts. If retrieval confidence is low, we refuse to answer.
"""
from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

RULES_PATH = Path(__file__).resolve().parent.parent / "data" / "rule_corpus.jsonl"

_STOP = set("a an and or of the to for in on with is are was were be been being this that these those "
            "what which who when where why how do does did as at by from into per".split())

_MIN_CONFIDENCE = 0.28


def _tokenize(s: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9%$/\-]+", s.lower()) if w not in _STOP and len(w) > 1]


@lru_cache(maxsize=1)
def _corpus() -> list[dict]:
    rules: list[dict] = []
    with RULES_PATH.open() as f:
        for line in f:
            if line.strip():
                rules.append(json.loads(line))
    return rules


@lru_cache(maxsize=1)
def _index():
    rules = _corpus()
    docs = [_tokenize(r["text"]) for r in rules]
    df = Counter()
    for d in docs:
        for w in set(d):
            df[w] += 1
    N = len(docs)
    idf = {w: math.log((N + 1) / (c + 1)) + 1.0 for w, c in df.items()}
    vecs = []
    for d in docs:
        tf = Counter(d)
        v = {w: (tf[w] / max(1, len(d))) * idf.get(w, 1.0) for w in tf}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs.append({w: x / norm for w, x in v.items()})
    return rules, vecs, idf


def _query_vec(q: str, idf: dict) -> dict:
    toks = _tokenize(q)
    tf = Counter(toks)
    v = {w: (tf[w] / max(1, len(toks))) * idf.get(w, 1.0) for w in tf}
    norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
    return {w: x / norm for w, x in v.items()}


def _cos(a: dict, b: dict) -> float:
    if len(a) > len(b): a, b = b, a
    return sum(v * b.get(k, 0.0) for k, v in a.items())


def retrieve(question: str, top_k: int = 3) -> list[dict[str, Any]]:
    rules, vecs, idf = _index()
    qv = _query_vec(question, idf)
    scored = [(_cos(qv, vecs[i]), rules[i]) for i in range(len(rules))]
    scored.sort(key=lambda x: x[0], reverse=True)
    out = []
    for s, r in scored[:top_k]:
        out.append({**r, "score": round(float(s), 3)})
    return out


def _refusal() -> dict:
    return {
        "answer": "I cannot answer because this information is not available in the provided rule documents.",
        "citations": [],
        "confidence": 0.0,
        "refused": True,
    }


def answer(question: str, use_gpt: bool | None = None) -> dict[str, Any]:
    """Return {answer, citations:[{rule_id, effective_date, source_url, page, text}], confidence}."""
    q = (question or "").strip()
    if not q:
        return _refusal()

    hits = retrieve(q, top_k=3)
    if not hits or hits[0]["score"] < _MIN_CONFIDENCE:
        return _refusal()

    citations = [
        {
            "rule_id": h["rule_id"],
            "authority": h.get("authority", ""),
            "effective_date": h.get("effective_date", ""),
            "source_url": h.get("source_url", ""),
            "source_locator": h.get("source_locator", ""),
            "text": h["text"],
            "score": h["score"],
        }
        for h in hits
    ]

    use_gpt = bool(os.getenv("OPENAI_API_KEY")) if use_gpt is None else use_gpt
    if use_gpt:
        try:
            synth = _gpt_synthesize(q, hits)
            if synth:
                return {
                    "answer": synth,
                    "citations": citations,
                    "confidence": round(float(hits[0]["score"]), 2),
                    "refused": False,
                }
        except Exception:
            pass

    # Fallback: quote the top rule verbatim
    return {
        "answer": hits[0]["text"],
        "citations": citations,
        "confidence": round(float(hits[0]["score"]), 2),
        "refused": False,
    }


def _gpt_synthesize(question: str, hits: list[dict]) -> str:
    from openai import OpenAI
    client = OpenAI()
    context = "\n\n".join(f"[{h['rule_id']}] {h['text']}" for h in hits)
    msg = (
        "You are a compliance assistant for affordable-housing intake staff. "
        "Answer ONLY using the numbered rule snippets provided. If the snippets do not "
        "contain the answer, reply exactly: I cannot answer because this information is "
        "not available in the provided rule documents. "
        "Never determine eligibility. Cite rule_ids inline like [HUD-MTSP-002]. "
        "Keep the answer under 90 words.\n\n"
        f"RULES:\n{context}\n\nQUESTION: {question}"
    )
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": msg}],
        temperature=0,
    )
    return (r.choices[0].message.content or "").strip()
