"""Application readiness page + packet PDF generator."""
from __future__ import annotations

import json
from datetime import datetime

import streamlit as st

from utils.state import bootstrap, page_header, badge
from utils.checklist import build as build_checklist
from utils.packet_generator import generate as generate_packet
from utils import db

bootstrap()
page_header(
    "Application Packet",
    "Generate a professional intake packet for review. Document completeness only — not an eligibility decision.",
    icon="📦",
)

hh   = st.session_state["household_id"]
docs = st.session_state["documents"]
prof = st.session_state["profile"]
as_of = st.session_state["as_of_date"]

check = build_checklist(hh, docs, as_of)
pct = check["readiness_pct"]

st.markdown(
    f"""
    <div class="rd-readiness">
      <div>
        <div class="lbl">Application Readiness</div>
        <div class="pct">{pct}%</div>
        <div class="sub">
          Estimated completion time: {check['estimated_minutes']} minute(s) ·
          Score reflects document completeness only.
        </div>
      </div>
      <div style="flex:1"></div>
      <div style="text-align:right; font-size:13px;">
        Present <b>{len(check['present'])}</b><br>
        Missing <b>{len(check['missing'])}</b><br>
        Expired <b>{len(check['expired'])}</b>
      </div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.write("")
st.markdown("<div class='rd-card'><h3>Checklist</h3>", unsafe_allow_html=True)
for item in check["items"]:
    icon = {"present": "✅", "missing": "⛔", "expired": "⚠️"}[item["status"]]
    kind = {"present": "ok", "missing": "danger", "expired": "warn"}[item["status"]]
    detail = f" · {item.get('detail','')}" if item.get("detail") else ""
    st.markdown(
        f"<div style='display:flex; align-items:center; justify-content:space-between;"
        f" padding:8px 0; border-bottom:1px dashed var(--rd-border);'>"
        f"<div>{icon} <b>{item['label']}</b> <span class='rd-muted'>{detail}</span></div>"
        f"{badge(item['status'].upper(), kind)}</div>",
        unsafe_allow_html=True,
    )
st.markdown("</div>", unsafe_allow_html=True)

# ---- Generate ---------------------------------------------------------------
st.markdown("<div class='rd-card'><h3>Generate packet</h3>", unsafe_allow_html=True)
c1, c2, c3 = st.columns([1, 1, 3])
if c1.button("Generate PDF", type="primary", disabled=len(prof) == 0 and len(docs) == 0):
    with st.spinner("Rendering packet…"):
        pdf = generate_packet(prof, docs, check, hh, as_of)
        st.session_state["packet_pdf"] = pdf
        db.save_session(hh, prof, docs)
    st.toast("Packet generated.", icon="📦")

if st.session_state.get("packet_pdf"):
    c2.download_button(
        "⬇ Download PDF",
        data=st.session_state["packet_pdf"],
        file_name=f"realdoor_packet_{hh}_{datetime.now():%Y%m%d_%H%M}.pdf",
        mime="application/pdf",
        use_container_width=True,
    )
    c3.download_button(
        "⬇ Download JSON",
        data=json.dumps({
            "household_id": hh,
            "as_of": as_of,
            "profile": prof,
            "documents": [{k: v for k, v in d.items() if k != "preview_png"} for d in docs],
            "checklist": check,
        }, default=str, indent=2),
        file_name=f"realdoor_packet_{hh}.json",
        mime="application/json",
    )
st.markdown("</div>", unsafe_allow_html=True)
