"""Streamlit session initialization and shared state helpers."""

from __future__ import annotations

import uuid
import streamlit as st

from utils.db import ensure_session, init_db


def init_session() -> str:
    init_db()
    if "session_id" not in st.session_state:
        st.session_state.session_id = f"RD-{uuid.uuid4().hex[:10].upper()}"
    st.session_state.setdefault("consent", False)
    st.session_state.setdefault("document_bytes", {})
    st.session_state.setdefault("selected_document", None)
    st.session_state.setdefault("demo_household", None)
    st.session_state.setdefault("dark_mode", False)
    st.session_state.setdefault("last_rule_answer", None)
    ensure_session(st.session_state.session_id, st.session_state.demo_household)
    return st.session_state.session_id

