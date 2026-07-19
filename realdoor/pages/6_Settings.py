"""Settings — household id, as-of date, dark mode, session reset."""
from __future__ import annotations

import json
import os

import streamlit as st

from utils.state import bootstrap, page_header

bootstrap()
page_header("Settings", "Runtime preferences and session controls.", icon="⚙️")

st.markdown("<div class='rd-card'><h3>Session</h3>", unsafe_allow_html=True)
c1, c2 = st.columns(2)
st.session_state["household_id"] = c1.text_input(
    "Household ID", value=st.session_state["household_id"],
    help="Selects the required document checklist.",
)
st.session_state["as_of_date"] = c2.text_input(
    "As-of date (YYYY-MM-DD)", value=st.session_state["as_of_date"],
    help="Frozen challenge date used for staleness checks.",
)
st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<div class='rd-card'><h3>AI</h3>", unsafe_allow_html=True)
has_key = bool(os.getenv("OPENAI_API_KEY"))
st.markdown(
    f"OPENAI_API_KEY: **{'detected' if has_key else 'not set'}** — "
    f"set as environment variable to enable GPT vision OCR and rule synthesis.",
    unsafe_allow_html=True,
)
st.session_state["use_gpt"] = st.checkbox(
    "Use GPT when available", value=st.session_state.get("use_gpt", has_key),
    disabled=not has_key,
)
st.session_state["dark_mode"] = st.checkbox(
    "Dark mode", value=st.session_state.get("dark_mode", False),
)
st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<div class='rd-card'><h3>Data</h3>", unsafe_allow_html=True)
export = {
    "household_id": st.session_state["household_id"],
    "as_of_date": st.session_state["as_of_date"],
    "profile": st.session_state["profile"],
    "documents": [{k: v for k, v in d.items() if k != "preview_png"}
                  for d in st.session_state["documents"]],
}
st.download_button(
    "⬇ Export session as JSON",
    data=json.dumps(export, indent=2, default=str),
    file_name="realdoor_session.json",
    mime="application/json",
)
if st.button("Reset session", type="secondary"):
    for k in ("profile", "documents", "rule_history", "packet_pdf"):
        st.session_state[k] = [] if k in ("documents", "rule_history") else ({} if k == "profile" else None)
    st.toast("Session cleared.", icon="🧹")
    st.rerun()
st.markdown("</div>", unsafe_allow_html=True)
