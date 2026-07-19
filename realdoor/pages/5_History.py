"""History — saved intake sessions and rulebook queries."""
from __future__ import annotations

from datetime import datetime

import pandas as pd
import streamlit as st

from utils.state import bootstrap, page_header
from utils import db

bootstrap()
page_header("History", "Autosaved intake sessions and rulebook queries.", icon="📜")

sessions = db.list_sessions()
st.markdown("<div class='rd-card'><h3>Saved sessions</h3>", unsafe_allow_html=True)
if sessions:
    df = pd.DataFrame(sessions)
    df["created"] = df["created_at"].map(lambda t: datetime.fromtimestamp(t).strftime("%Y-%m-%d %H:%M"))
    st.dataframe(df[["id", "household_id", "created"]], hide_index=True, use_container_width=True)

    sel = st.number_input("Load session id", min_value=0, step=1, value=0)
    if st.button("Restore into current session", disabled=sel == 0):
        rec = db.load_session(int(sel))
        if rec:
            st.session_state["profile"] = rec["profile"]
            st.session_state["documents"] = rec["documents"]
            st.session_state["household_id"] = rec["household_id"]
            st.toast(f"Restored session {sel}.", icon="↩")
            st.rerun()
else:
    st.info("Generate a packet to autosave the first session.")
st.markdown("</div>", unsafe_allow_html=True)

queries = db.list_rule_queries(50)
st.markdown("<div class='rd-card'><h3>Rulebook queries</h3>", unsafe_allow_html=True)
if queries:
    for q in queries:
        st.markdown(
            f"<div style='padding:8px 0; border-bottom:1px dashed var(--rd-border);'>"
            f"<div><b>{q['question']}</b></div>"
            f"<div class='rd-muted' style='font-size:12px;'>"
            f"{datetime.fromtimestamp(q['ts']).strftime('%Y-%m-%d %H:%M')} · "
            f"confidence {int((q['confidence'] or 0)*100)}% · "
            f"{len(q['citations'])} citation(s)</div>"
            f"<div style='margin-top:4px; font-size:13px;'>{q['answer']}</div>"
            f"</div>",
            unsafe_allow_html=True,
        )
else:
    st.info("Ask the Rules Assistant to build query history.")
st.markdown("</div>", unsafe_allow_html=True)
