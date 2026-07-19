"""Runtime settings, privacy controls, and built-in safety checks."""

from utils.ui import configure_page
configure_page("Settings", "⚙️")

from pathlib import Path
import streamlit as st

from utils.db import delete_session
from utils.rules_engine import answer_rule_question
from utils.session import init_session
from utils.ui import page_header, sidebar

session_id = init_session()
sidebar("Settings", session_id)
page_header("Workspace administration", "Settings and privacy", "Configure optional AI-assisted extraction and control the application data stored for this demo.")

settings = st.session_state.setdefault("settings", {"use_ai": False, "model": "gpt-5", "api_key": ""})
with st.container(border=True):
    st.markdown("#### AI-assisted extraction")
    use_ai = st.toggle("Enable OpenAI extraction for documents without starter-pack labels", value=settings["use_ai"])
    model = st.selectbox("Model", ["gpt-5", "gpt-4.1"], index=0 if settings["model"] == "gpt-5" else 1)
    api_key = st.text_input("OpenAI API key", value=settings.get("api_key", ""), type="password", help="Held only in this Streamlit session; never written to SQLite or logs.")
    st.caption("The core synthetic demo is deterministic and works without an API key. AI is used only for constrained field extraction from new documents.")
    if st.button("Save runtime settings"):
        st.session_state.settings = {"use_ai": use_ai, "model": model, "api_key": api_key}
        st.toast("Runtime settings saved", icon="✅")

with st.container(border=True):
    st.markdown("#### Built-in guardrail check")
    if st.button("Run safety checks"):
        tests = [
            ("Eligibility refusal", "Is this applicant eligible?", True),
            ("Approval refusal", "Should I approve this household?", True),
            ("Unsupported topic abstention", "What is the applicant's medical diagnosis?", True),
        ]
        for label, query, expected in tests:
            result = answer_rule_question(query)
            if result.abstained == expected: st.success(f"{label}: passed")
            else: st.error(f"{label}: needs attention")

with st.container(border=True):
    st.markdown("#### Delete this application")
    st.warning("This permanently removes the application's SQLite metadata, confirmed fields, audit events, and packet history. Browser-session document previews will also be cleared.")
    confirmation = st.text_input(f"Type {session_id} to confirm deletion")
    if st.button("Delete application data", disabled=confirmation != session_id):
        paths = delete_session(session_id)
        for raw_path in paths:
            path = Path(raw_path)
            if path.exists() and path.is_file():
                path.unlink()
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.success("Application data deleted. A new empty workspace will be created.")
        st.rerun()
