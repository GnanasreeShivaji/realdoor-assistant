"""Household profile — confirmed fields with per-field source and edit."""
from __future__ import annotations

import streamlit as st

from utils.state import bootstrap, page_header, badge

bootstrap()
page_header(
    "Household Profile",
    "Confirmed fields extracted from uploaded documents. Every value shows its source and confidence.",
    icon="👤",
)

profile = st.session_state["profile"]

SECTIONS = {
    "Personal Information": ["full_name", "employee_name", "tenant_name",
                              "account_holder", "recipient_name",
                              "date_of_birth", "id_number", "expiration_date"],
    "Household":            ["household_size", "unit_address", "service_address"],
    "Income":               ["gross_pay_period", "ytd_gross", "pay_frequency",
                              "annual_salary", "beginning_balance", "ending_balance"],
    "Benefits":             ["program", "monthly_benefit", "effective_date"],
    "Employment":           ["employer", "start_date", "pay_period_end"],
    "Housing":              ["monthly_rent", "lease_start", "bill_date", "amount_due"],
}

if not profile:
    st.info("Upload a document and click **Confirm into profile** to populate this view.")
else:
    for section, fields in SECTIONS.items():
        rows = [(f, profile[f]) for f in fields if f in profile]
        if not rows:
            continue
        st.markdown(f"<div class='rd-card'><h3>{section}</h3>", unsafe_allow_html=True)
        for fname, obj in rows:
            c = obj.get("confidence", 0)
            kind = "ok" if c >= 0.75 else ("warn" if c >= 0.55 else "danger")

            cols = st.columns([2, 3, 2, 1, 1])
            cols[0].markdown(f"<div class='rd-muted'>{fname.replace('_',' ').title()}</div>",
                             unsafe_allow_html=True)

            edit_key = f"edit-{fname}"
            editing = st.session_state.get(edit_key, False)
            if editing:
                new_val = cols[1].text_input("value", value=str(obj["value"]),
                                              key=f"val-{fname}", label_visibility="collapsed")
                if cols[3].button("Save", key=f"save-{fname}", type="primary"):
                    profile[fname]["value"] = new_val
                    profile[fname]["confidence"] = 1.0
                    profile[fname]["source"] = "manual edit"
                    st.session_state[edit_key] = False
                    st.rerun()
                if cols[4].button("Cancel", key=f"cancel-{fname}"):
                    st.session_state[edit_key] = False
                    st.rerun()
            else:
                cols[1].markdown(f"**{obj['value']}**")
                cols[2].markdown(f"<span class='rd-muted'>{obj.get('source','')}</span>",
                                  unsafe_allow_html=True)
                cols[3].markdown(badge(f"{int(c*100)}%", kind), unsafe_allow_html=True)
                if cols[4].button("Edit", key=f"btn-{fname}"):
                    st.session_state[edit_key] = True
                    st.rerun()

        # Extras not in a known section
        st.markdown("</div>", unsafe_allow_html=True)

    known = {f for fields in SECTIONS.values() for f in fields}
    extras = [(k, v) for k, v in profile.items() if k not in known]
    if extras:
        st.markdown("<div class='rd-card'><h3>Other</h3>", unsafe_allow_html=True)
        for fname, obj in extras:
            st.markdown(
                f"<div class='rd-field'>"
                f"<div class='k'>{fname.replace('_',' ').title()}</div>"
                f"<div class='v'>{obj['value']}</div>"
                f"<div class='src'>{obj.get('source','')}</div>"
                f"<div>{badge(f'{int(obj.get(\"confidence\",0)*100)}%', 'neutral')}</div>"
                f"</div>",
                unsafe_allow_html=True,
            )
        st.markdown("</div>", unsafe_allow_html=True)

st.write("")
c1, c2 = st.columns([1, 5])
if c1.button("Clear profile"):
    st.session_state["profile"] = {}
    st.rerun()
