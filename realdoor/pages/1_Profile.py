"""Human-in-the-loop field review and confirmation."""

from utils.ui import configure_page
configure_page("Profile", "👤")

import streamlit as st

from utils.db import get_fields, log_event, upsert_field
from utils.ocr import render_preview
from utils.session import init_session
from utils.ui import confidence_badge, page_header, safety_notice, sidebar

session_id = init_session()
sidebar("Profile", session_id)
fields = get_fields(session_id)
page_header("Step 1 · Human confirmation", "Applicant profile", "Every value stays linked to its source. Correct errors and confirm only what the evidence supports.")
safety_notice()

if not fields:
    st.info("No extracted fields are available yet.")
    st.page_link("pages/0_Upload_Documents.py", label="Go to document intake", icon="📄")
    st.stop()

categories = {
    "Personal information": {"person_name", "household_size", "address", "application_date"},
    "Income": {"gross_pay", "net_pay", "hourly_rate", "regular_hours", "annual_salary", "gig_gross_income", "pay_frequency"},
    "Employment": {"employer_name", "employment_start_date", "pay_date", "pay_period_start", "pay_period_end"},
    "Benefits": {"benefit_type", "benefit_amount", "benefit_frequency"},
    "Documents": {"letter_date", "statement_date"},
}
tabs = st.tabs(list(categories))
for tab, (category, names) in zip(tabs, categories.items()):
    with tab:
        matches = [field for field in fields if field["name"] in names]
        if not matches:
            st.caption("No extracted values in this section.")
        for index, field in enumerate(matches):
            with st.container(border=True):
                label_col, value_col, status_col = st.columns([1.2, 2.2, 1])
                label_col.markdown(f"**{field['name'].replace('_', ' ').title()}**")
                new_value = value_col.text_input("Extracted value", value=str(field.get("value", "")), key=f"value_{category}_{field['id']}", label_visibility="collapsed")
                status_col.markdown(confidence_badge(field["confidence"]), unsafe_allow_html=True)
                st.caption(f"Source: {field['source_document']} · Page {field['evidence'].get('page', 1)}")
                c1, c2, c3 = st.columns([1, 1, 2])
                confirmed = c1.checkbox("Confirmed", value=field["confirmed"], key=f"confirm_{field['id']}")
                if c2.button("Save", key=f"save_{field['id']}", use_container_width=True):
                    updated = {**field, "value": new_value, "confirmed": confirmed}
                    upsert_field(session_id, updated)
                    event = "FIELD_CORRECTED" if str(field["value"]) != new_value else "FIELD_CONFIRMED"
                    log_event(session_id, event, {"field": field["name"], "source": field["source_document"]})
                    st.toast("Field saved", icon="✅")
                with c3.expander("View highlighted evidence"):
                    source_bytes = st.session_state.document_bytes.get(field["source_document"])
                    if source_bytes:
                        try:
                            st.image(render_preview(source_bytes, field["source_document"], field["evidence"]), use_container_width=True)
                            excerpt = field["evidence"].get("excerpt")
                            if excerpt: st.caption(f'“{excerpt}”')
                        except Exception as exc:
                            st.info(f"Evidence preview unavailable: {exc}")
                    else:
                        st.info("The source preview is held only for this browser session. Re-upload the document to view it again.")
