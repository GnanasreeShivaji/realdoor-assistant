"""Auditable case activity without raw OCR text."""

from utils.ui import configure_page
configure_page("History", "📜")

import pandas as pd
import streamlit as st

from utils.db import get_history
from utils.session import init_session
from utils.ui import page_header, sidebar

session_id = init_session()
sidebar("History", session_id)
page_header("Audit trail", "Application history", "Review material actions taken during this application. Raw document text and API keys are never included.")
history = get_history(session_id)
if not history:
    st.info("No activity has been recorded yet.")
else:
    for event in history:
        with st.container(border=True):
            c1, c2 = st.columns([3, 1])
            c1.markdown(f"**{event['event_type'].replace('_', ' ').title()}**")
            c2.caption(event["created_at"].replace("T", " "))
            safe_data = {key: value for key, value in event["event_data"].items() if key not in {"text", "api_key"}}
            st.json(safe_data, expanded=False)
    with st.expander("Export-friendly table"):
        frame = pd.DataFrame([{"time": e["created_at"], "event": e["event_type"], "details": str(e["event_data"])} for e in history])
        st.dataframe(frame, use_container_width=True, hide_index=True)

