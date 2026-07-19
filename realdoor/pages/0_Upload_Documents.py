"""Document intake, OCR, allowlisted extraction, and evidence preview."""

from utils.ui import configure_page
configure_page("Upload Documents", "📄")

import hashlib
from pathlib import Path
import streamlit as st

from utils.db import add_document, record_consent, upsert_field
from utils.extractor import load_gold, process_document
from utils.ocr import render_preview
from utils.paths import SAMPLE_DOCUMENTS
from utils.session import init_session
from utils.ui import confidence_badge, page_header, safety_notice, sidebar

session_id = init_session()
sidebar("Upload Documents", session_id)
page_header("Step 1 · Document intake", "Upload and extract evidence", "Process synthetic or approved test documents, inspect the source, and send extracted facts to human confirmation.")
safety_notice()

with st.container(border=True):
    st.markdown("#### Processing consent")
    consent = st.checkbox("I confirm these are synthetic documents or approved test records and consent to processing for this demonstration.", value=st.session_state.consent)
    if consent and not st.session_state.consent:
        st.session_state.consent = True
        record_consent(session_id)

tab_upload, tab_demo = st.tabs(["Upload documents", "Load synthetic household"])
files_to_process: list[tuple[str, bytes, str]] = []
with tab_upload:
    doc_type = st.selectbox("Document category", ["Auto-detect", "Pay Stub", "Bank Statement", "Benefit Letter", "Employment Letter", "Government ID", "Lease", "Utility Bill"])
    uploads = st.file_uploader("Drop PDF or image files here", type=["pdf", "png", "jpg", "jpeg", "tif", "tiff"], accept_multiple_files=True)
    if uploads:
        files_to_process = [(upload.name, upload.getvalue(), doc_type) for upload in uploads]
with tab_demo:
    households = sorted({record.get("household_id") for record in load_gold().values() if record.get("household_id")})
    household = st.selectbox("Synthetic scenario", households, format_func=lambda value: f"{value} · Organizer-provided synthetic evidence")
    matching = [record for record in load_gold().values() if record.get("household_id") == household]
    st.caption(f"{len(matching)} source documents available. These records contain no real applicant data.")
    if st.button("Stage this household", use_container_width=True):
        st.session_state.demo_household = household
        st.session_state.staged_demo = [record["file_name"] for record in matching]
        st.toast(f"{household} staged", icon="✅")
    for file_name in st.session_state.get("staged_demo", []):
        path = SAMPLE_DOCUMENTS / file_name
        if path.exists():
            files_to_process.append((file_name, path.read_bytes(), "Auto-detect"))

settings = st.session_state.get("settings", {})
if files_to_process:
    st.markdown(f"#### Ready to process · {len(files_to_process)} file(s)")
    if st.button("Run extraction", type="primary", disabled=not consent, use_container_width=True):
        progress = st.progress(0, text="Starting secure document processing…")
        results = []
        for index, (file_name, file_bytes, selected_type) in enumerate(files_to_process):
            with st.spinner(f"Reading {file_name}"):
                result = process_document(file_name, file_bytes, selected_type,
                                          use_ai=settings.get("use_ai", False), model=settings.get("model", "gpt-5"),
                                          api_key=settings.get("api_key", ""))
                digest = hashlib.sha256(file_bytes).hexdigest()
                metadata = {"file_name": file_name, "document_type": result["document_type"], "sha256": digest,
                            "status": "processed" if result["fields"] else "needs review", "confidence": result["confidence"],
                            "processing_ms": result["processing_ms"]}
                add_document(session_id, metadata)
                for field in result["fields"]:
                    upsert_field(session_id, field)
                st.session_state.document_bytes[file_name] = file_bytes
                results.append((file_name, result))
            progress.progress((index + 1) / len(files_to_process), text=f"Processed {index + 1} of {len(files_to_process)}")
        st.session_state.last_results = results
        st.toast("Document extraction complete", icon="✅")
        st.rerun()
elif not consent:
    st.caption("Consent is required before processing is enabled.")

if st.session_state.get("last_results"):
    st.markdown("### Processing results")
    for file_name, result in st.session_state.last_results:
        with st.expander(file_name, expanded=True):
            left, right = st.columns([1, 1.15])
            with left:
                try:
                    st.image(render_preview(st.session_state.document_bytes[file_name], file_name), use_container_width=True)
                except Exception as exc:
                    st.info(f"Preview unavailable: {exc}")
            with right:
                c1, c2 = st.columns(2)
                c1.metric("OCR status", result["ocr_status"])
                c2.metric("Processing time", f"{result['processing_ms']} ms")
                st.markdown(confidence_badge(result["confidence"]), unsafe_allow_html=True)
                st.caption(result["method"])
                for field in result["fields"]:
                    st.markdown(f"**{field['name'].replace('_',' ').title()}** · `{field['value']}`  \n<span class='muted'>Evidence: {field['evidence'].get('excerpt') or 'Bounding box recorded'}</span>", unsafe_allow_html=True)
                if not result["fields"]:
                    st.warning("No allowlisted fields were confidently extracted. Keep this document in human review.")
