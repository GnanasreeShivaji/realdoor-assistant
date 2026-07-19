"""Application completeness checklist and packet generation."""

from utils.ui import configure_page
configure_page("Application Packet", "📦")

import json
from datetime import datetime
import streamlit as st

from utils.db import add_packet, get_documents, get_fields
from utils.packet_generator import generate_packet
from utils.readiness import assess_readiness
from utils.session import init_session
from utils.ui import metric_card, page_header, safety_notice, sidebar, status_badge

session_id = init_session()
sidebar("Application Packet", session_id)
documents = get_documents(session_id)
fields = get_fields(session_id)
readiness = assess_readiness(documents, st.session_state.demo_household)
page_header("Step 3 · Completeness review", "Application readiness", "Resolve missing or review items, then create a structured packet for a qualified housing specialist.")
safety_notice()

cols = st.columns(3)
with cols[0]: metric_card("Document completeness", f"{readiness['score']}%", readiness["disclaimer"], "teal")
with cols[1]: metric_card("Review state", readiness["status"], "This is not an eligibility result", "amber")
with cols[2]: metric_card("Estimated completion", f"{readiness['estimated_minutes']} min", "Based on unresolved checklist items")
st.progress(readiness["score"] / 100, text=f"{readiness['score']}% of required document types present")

st.markdown("### Professional checklist")
for item in readiness["items"]:
    with st.container(border=True):
        c1, c2 = st.columns([5, 1])
        symbol = "✓" if item.status == "complete" else "⚠"
        c1.markdown(f"**{symbol} {item.label}**  \n<span class='muted'>{item.detail}</span>", unsafe_allow_html=True)
        c2.markdown(status_badge(item.status), unsafe_allow_html=True)

st.divider()
st.markdown("### Generate reviewer packet")
confirmed_count = sum(field["confirmed"] for field in fields)
st.caption(f"The packet will include {confirmed_count} confirmed profile fields, {len(documents)} document records, the checklist, missing items, and generation time.")
if st.button("Generate application packet", type="primary", disabled=not documents, use_container_width=True):
    with st.spinner("Assembling a review-safe PDF…"):
        pdf = generate_packet(session_id, fields, documents, readiness, st.session_state.get("calculation"))
        file_name = f"RealDoor_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
        st.session_state.packet = {"bytes": pdf, "file_name": file_name}
        add_packet(session_id, file_name, readiness["status"])
    st.toast("Application packet created", icon="✅")

download_data = {
    "session_id": session_id,
    "generated_at": datetime.now().isoformat(timespec="seconds"),
    "decision_boundary": "Document completeness only; no eligibility determination.",
    "confirmed_profile": [{k: field[k] for k in ("name", "value", "source_document", "confidence")} for field in fields if field["confirmed"]],
    "documents": [{k: doc.get(k) for k in ("file_name", "document_type", "status", "confidence")} for doc in documents],
    "readiness": {"score": readiness["score"], "status": readiness["status"], "items": [item.__dict__ for item in readiness["items"]]},
}
left, right = st.columns(2)
left.download_button("Download application JSON", json.dumps(download_data, indent=2), f"{session_id}.json", "application/json", use_container_width=True)
if st.session_state.get("packet"):
    packet = st.session_state.packet
    right.download_button("Download professional PDF", packet["bytes"], packet["file_name"], "application/pdf", type="primary", use_container_width=True)
