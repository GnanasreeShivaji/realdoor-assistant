"""Evidence-bound rule lookup presented as a reference tool, not a chatbot."""

from utils.ui import configure_page
configure_page("Rules Assistant", "📚")

from dataclasses import asdict
import streamlit as st

from utils.db import get_fields, log_event
from utils.rules_engine import annualize, answer_rule_question, threshold_for
from utils.session import init_session
from utils.ui import confidence_badge, page_header, safety_notice, sidebar

session_id = init_session()
sidebar("Rules Assistant", session_id)
page_header("Step 2 · Evidence-bound reference", "Rules Assistant", "Search only the supplied affordable-housing rule corpus. Answers require an official citation and never determine eligibility.")
safety_notice()

st.markdown("#### Rule lookup")
suggestions = ["What are the FY 2026 60% income limits?", "When did the FY 2026 MTSP limits become effective?", "How should biweekly pay be annualized?"]


def apply_suggested_lookup() -> None:
    """Widget callbacks run before Streamlit recreates the question input."""
    st.session_state.rule_query = st.session_state.rule_suggestion


st.session_state.setdefault("rule_query", "")
question = st.text_input("Question", key="rule_query", placeholder="Example: How is biweekly gross pay annualized?", help="This is a corpus search, not an open-ended chat.")
with st.expander("Suggested lookups"):
    st.radio("Choose a common question", suggestions, key="rule_suggestion", label_visibility="collapsed")
    st.button("Use selected lookup", on_click=apply_suggested_lookup)

if st.button("Search supplied rules", type="primary", disabled=not question.strip()):
    answer = answer_rule_question(question)
    st.session_state.last_rule_answer = asdict(answer)
    log_event(session_id, "RULE_LOOKUP", {"query": question[:160], "rule_id": answer.rule_id, "abstained": answer.abstained})

answer = st.session_state.get("last_rule_answer")
if answer:
    st.markdown('<div class="rule-answer">', unsafe_allow_html=True)
    st.markdown("##### Evidence-backed answer")
    st.write(answer["answer"])
    if answer.get("rule_id"):
        cols = st.columns(3)
        cols[0].markdown(f"**Official citation**  \n[{answer['rule_id']}]({answer['citation']})")
        cols[1].markdown(f"**Page / locator**  \n{answer['page_or_locator']}")
        cols[2].markdown(f"**Effective date**  \n{answer['effective_date']}")
        st.markdown(confidence_badge(answer["confidence"]), unsafe_allow_html=True)
    else:
        st.warning("No supporting rule citation was returned.")
    st.markdown('</div>', unsafe_allow_html=True)

st.divider()
st.markdown("#### Transparent calculation ledger")
st.caption("Calculations organize evidence for a reviewer; comparisons are not eligibility decisions.")
fields = get_fields(session_id)
latest = {field["name"]: field for field in fields if field.get("confirmed")}
c1, c2, c3 = st.columns(3)
amount = c1.number_input("Gross pay per period", min_value=0.0, value=float(latest.get("gross_pay", {}).get("value") or 0.0), step=50.0)
frequency_options = ["weekly", "biweekly", "semimonthly", "monthly", "annual"]
known_frequency = str(latest.get("pay_frequency", {}).get("value", "biweekly")).lower()
frequency = c2.selectbox("Frequency", frequency_options, index=frequency_options.index(known_frequency) if known_frequency in frequency_options else 1)
household_size = c3.number_input("Household size", min_value=1, max_value=8, value=int(float(latest.get("household_size", {}).get("value") or 1)))
if st.button("Calculate and record inputs"):
    annual, formula = annualize(amount, frequency)
    threshold, citation = threshold_for(int(household_size), 60)
    st.session_state.calculation = {"annualized": annual, "formula": f"{formula} = ${annual:,.2f} annualized gross amount", "threshold": threshold, "citation": citation}
    log_event(session_id, "CALCULATION_RECORDED", {"amount": amount, "frequency": frequency, "household_size": household_size, "formula": formula})

if st.session_state.get("calculation"):
    calc = st.session_state.calculation
    left, right = st.columns(2)
    left.metric("Annualized gross amount", f"${calc['annualized']:,.2f}")
    right.metric("Frozen 60% reference threshold", f"${calc['threshold']:,.0f}" if calc.get("threshold") else "Unavailable")
    st.code(calc["formula"], language=None)
    st.caption(f"Source: {calc.get('citation') or 'No supplied table match'} · No eligibility conclusion is produced.")
