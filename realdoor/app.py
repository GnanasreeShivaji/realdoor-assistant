"""RealDoor — Dashboard (home).

Streamlit entry point. Run with:

    streamlit run app.py
"""
from __future__ import annotations

from utils.state import bootstrap, page_header, badge
from utils.checklist import build as build_checklist
from utils import db

import streamlit as st
import plotly.graph_objects as go

bootstrap()
db.init()

page_header(
    "Dashboard",
    "Real-time status for the current household intake.",
    icon="🏠",
)

docs = st.session_state["documents"]
profile = st.session_state["profile"]
hh = st.session_state["household_id"]
as_of = st.session_state["as_of_date"]
checklist = build_checklist(hh, docs, as_of)

# ---- KPI tiles ---------------------------------------------------------------
col1, col2, col3, col4 = st.columns(4)
tiles = [
    ("Documents Uploaded", str(len(docs)), f"{len(checklist['required'])} required"),
    ("Confirmed Fields",   str(len(profile)), "auto-extracted"),
    ("Readiness",          f"{checklist['readiness_pct']}%", "document completeness"),
    ("Est. Time to Ready", f"{checklist['estimated_minutes']} min", "based on remaining items"),
]
for col, (label, value, delta) in zip((col1, col2, col3, col4), tiles):
    col.markdown(
        f"<div class='rd-kpi'><div class='label'>{label}</div>"
        f"<div class='value'>{value}</div>"
        f"<div class='delta'>{delta}</div></div>",
        unsafe_allow_html=True,
    )

st.write("")
left, right = st.columns([1.4, 1])

with left:
    st.markdown("<div class='rd-card'>", unsafe_allow_html=True)
    st.markdown("### Application Readiness")

    # Readiness banner
    pct = checklist["readiness_pct"]
    st.markdown(
        f"""
        <div class="rd-readiness">
          <div>
            <div class="lbl">Overall</div>
            <div class="pct">{pct}%</div>
            <div class="sub">Document completeness · not an eligibility determination</div>
          </div>
          <div style="flex:1;"></div>
          <div style="text-align:right; font-size:13px;">
            <div>Present <b>{len(checklist['present'])}</b></div>
            <div>Missing <b>{len(checklist['missing'])}</b></div>
            <div>Expired <b>{len(checklist['expired'])}</b></div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.write("")
    for item in checklist["items"]:
        icon = {"present": "✅", "missing": "⛔", "expired": "⚠️"}[item["status"]]
        kind = {"present": "ok", "missing": "danger", "expired": "warn"}[item["status"]]
        detail = f" · {item.get('detail','')}" if item.get("detail") else ""
        st.markdown(
            f"<div style='display:flex; align-items:center; justify-content:space-between;"
            f" padding:8px 0; border-bottom:1px dashed var(--rd-border);'>"
            f"<div>{icon} &nbsp; <b>{item['label']}</b>"
            f" <span class='rd-muted'>{detail}</span></div>"
            f"{badge(item['status'].upper(), kind)}</div>",
            unsafe_allow_html=True,
        )
    st.markdown("</div>", unsafe_allow_html=True)

with right:
    st.markdown("<div class='rd-card'>", unsafe_allow_html=True)
    st.markdown("### Completeness")

    fig = go.Figure(go.Pie(
        values=[len(checklist["present"]),
                len(checklist["missing"]) + len(checklist["expired"])],
        labels=["Complete", "Outstanding"],
        hole=0.7,
        marker=dict(colors=["#1f4bd8", "#e2e8f0"]),
        textinfo="none",
    ))
    fig.update_layout(
        showlegend=False, height=220, margin=dict(t=10, b=10, l=10, r=10),
        annotations=[dict(text=f"<b>{pct}%</b>", showarrow=False, font=dict(size=28))],
        paper_bgcolor="rgba(0,0,0,0)",
    )
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("<div class='rd-muted' style='text-align:center;'>"
                "Score reflects document completeness only.</div>",
                unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div class='rd-card'>", unsafe_allow_html=True)
    st.markdown("### Quick actions")
    st.page_link("pages/1_Upload_Documents.py", label="📄  Upload documents", icon=None)
    st.page_link("pages/2_Profile.py",           label="👤  Review profile")
    st.page_link("pages/3_Rules_Assistant.py",   label="📚  Ask the rulebook")
    st.page_link("pages/4_Application_Packet.py",label="📦  Generate packet PDF")
    st.markdown("</div>", unsafe_allow_html=True)

# Recent activity
recent = db.list_rule_queries(limit=5)
if recent:
    st.markdown("<div class='rd-card'>", unsafe_allow_html=True)
    st.markdown("### Recent rulebook queries")
    for r in recent:
        st.markdown(
            f"<div style='padding:8px 0; border-bottom:1px dashed var(--rd-border);'>"
            f"<div style='font-weight:500;'>{r['question']}</div>"
            f"<div class='rd-muted'>confidence {int((r['confidence'] or 0)*100)}% · "
            f"{len(r['citations'])} citation(s)</div></div>",
            unsafe_allow_html=True,
        )
    st.markdown("</div>", unsafe_allow_html=True)
