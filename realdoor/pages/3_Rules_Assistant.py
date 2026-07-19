"""Rules Assistant — retrieval-only answers with citations.

This is NOT a chatbot. Every answer must cite rule_id, source URL, page,
effective date, and confidence. If retrieval score is too low, we refuse.
"""
from __future__ import annotations

import streamlit as st

from utils.state import bootstrap, page_header, badge
from utils.rules_engine import answer, _corpus
from utils import db

bootstrap()
page_header(
    "Rules Assistant",
    "Grounded answers from the frozen affordable-housing rulebook. Never eligibility, never general knowledge.",
    icon="📚",
)

corpus = _corpus()
st.markdown(
    f"<div class='rd-card'><h3>Rulebook coverage</h3>"
    f"<div class='rd-muted'>{len(corpus)} rules indexed · authorities: "
    f"{', '.join(sorted({r.get('authority','—') for r in corpus}))} · "
    f"as of {st.session_state['as_of_date']}</div></div>",
    unsafe_allow_html=True,
)

examples = [
    "What is the FY 2026 60% AMI limit for a household of 3 in Boston-Cambridge-Quincy?",
    "How should biweekly pay be annualized for this challenge?",
    "When is a document considered current under the frozen convention?",
    "Does the assistant determine eligibility?",
]
cols = st.columns(len(examples))
for i, ex in enumerate(examples):
    if cols[i].button(ex, key=f"ex-{i}"):
        st.session_state["_rules_q"] = ex

question = st.text_input(
    "Ask the rulebook",
    value=st.session_state.get("_rules_q", ""),
    placeholder="e.g. What is the 60% AMI limit for a household of 4?",
)
col_q, _ = st.columns([1, 6])
ask = col_q.button("Ask", type="primary", disabled=not question.strip())

if ask and question.strip():
    with st.spinner("Searching the rulebook…"):
        result = answer(question, use_gpt=st.session_state.get("use_gpt", False))

    st.session_state["rule_history"].insert(0, {"q": question, "r": result})
    db.log_rule_query(question, result["answer"], result["citations"], result["confidence"])

    if result.get("refused"):
        st.markdown(
            f"<div class='rd-answer' style='border-left-color:#b7791f;'>"
            f"<div class='txt'>⚠ {result['answer']}</div></div>",
            unsafe_allow_html=True,
        )
    else:
        conf = result["confidence"]
        kind = "ok" if conf >= 0.5 else ("warn" if conf >= 0.3 else "danger")
        st.markdown(
            f"<div class='rd-answer'>"
            f"<div class='txt'>{result['answer']}</div>"
            f"<div class='rd-cite'>Confidence {badge(f'{int(conf*100)}%', kind)} · "
            f"{len(result['citations'])} citation(s)</div>"
            f"</div>",
            unsafe_allow_html=True,
        )

        st.markdown("#### Citations")
        for c in result["citations"]:
            score_badge = badge(f"score {c['score']:.2f}", "info")
            st.markdown(
                f"<div class='rd-card' style='margin-bottom:8px;'>"
                f"<div style='display:flex; justify-content:space-between; align-items:center;'>"
                f"<div><b>{c['rule_id']}</b> · <span class='rd-muted'>{c.get('authority','')}</span></div>"
                f"<div>{score_badge}</div>"
                f"</div>"
                f"<div style='margin-top:8px;'>{c['text']}</div>"
                f"<div class='rd-cite'>"
                f"Effective {c.get('effective_date','—')} · "
                f"<a href='{c.get('source_url','#')}' target='_blank'>{c.get('source_url','')}</a>"
                f" · {c.get('source_locator','')}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )


# Session history
if st.session_state["rule_history"]:
    st.markdown("### Session history")
    for h in st.session_state["rule_history"][:10]:
        with st.expander(h["q"], expanded=False):
            st.write(h["r"]["answer"])
            for c in h["r"]["citations"]:
                st.caption(f"[{c['rule_id']}] {c.get('source_url','')}")
