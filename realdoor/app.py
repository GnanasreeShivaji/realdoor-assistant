"""RealDoor agency operations dashboard."""

from utils.ui import configure_page
configure_page("Dashboard", "🏠")

import streamlit as st

from utils.db import get_documents, get_fields
from utils.readiness import assess_readiness
from utils.session import init_session
from utils.ui import metric_card, page_header, safety_notice, sidebar, status_badge

session_id = init_session()
sidebar("Dashboard", session_id)
documents = get_documents(session_id)
fields = get_fields(session_id)
readiness = assess_readiness(documents, st.session_state.demo_household)

page_header("Case workspace", "Application overview", "Review document evidence, confirm extracted facts, and prepare a complete packet for a qualified housing specialist.")
safety_notice()

cols = st.columns(4)
with cols[0]: metric_card("Documents", str(len(documents)), "Indexed in this application")
with cols[1]: metric_card("Extracted fields", str(len(fields)), f"{sum(f['confirmed'] for f in fields)} confirmed", "teal")
with cols[2]: metric_card("Completeness", f"{readiness['score']}%", readiness["disclaimer"], "amber")
with cols[3]: metric_card("Workflow status", readiness["status"], "Human review remains required")

st.subheader("Review queue")
left, right = st.columns([1.5, 1])
with left:
    if not documents:
        st.info("No documents have been added. Start with the synthetic demo household or upload approved test documents.")
        if st.button("Open document intake", type="primary", use_container_width=True):
            st.switch_page("pages/0_Upload_Documents.py")
    else:
        for item in readiness["items"]:
            with st.container(border=True):
                c1, c2 = st.columns([4, 1])
                c1.markdown(f"**{item.label}**  \n<span class='muted'>{item.detail}</span>", unsafe_allow_html=True)
                c2.markdown(status_badge(item.status), unsafe_allow_html=True)
with right:
    st.markdown("### Next actions")
    if not fields or any(not field["confirmed"] for field in fields):
        st.page_link("pages/1_Profile.py", label="Review and confirm extracted fields", icon="👤")
    st.page_link("pages/2_Rules.py", label="Consult supplied program rules", icon="📚")
    st.page_link("pages/3_Prepare.py", label="Prepare application packet", icon="📦")
    st.caption("RealDoor records key actions in an audit history. Raw OCR text is not written to logs.")

