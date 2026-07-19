"""Shared presentation components for the RealDoor agency workbench.

Everything visual routes through this module so the design system stays
consistent across pages. Keep semantics here (badge kinds, metric accents,
masthead), not in the individual pages.
"""

from __future__ import annotations

import html
from datetime import date
from pathlib import Path

import streamlit as st

from utils.confidence import confidence_label, confidence_percent

ROOT = Path(__file__).resolve().parents[1]


def configure_page(title: str, icon: str = "📄") -> None:
    st.set_page_config(
        page_title=f"{title} · RealDoor",
        page_icon=icon,
        layout="wide",
        initial_sidebar_state="expanded",
    )
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


def sidebar(active: str, session_id: str) -> None:
    """Editorial masthead sidebar. `active` unused today but preserved for future
    active-link highlighting without touching every page."""
    _ = active
    with st.sidebar:
        st.markdown(
            '<div class="brand-mark">R</div>'
            '<div class="brand-copy"><b>RealDoor</b><span>Readiness Copilot</span></div>',
            unsafe_allow_html=True,
        )
        st.caption("Workspace")
        st.page_link("app.py", label="Dashboard", icon="🏠")
        st.page_link("pages/0_Upload_Documents.py", label="Document intake", icon="📄")
        st.page_link("pages/1_Profile.py", label="Applicant profile", icon="👤")
        st.page_link("pages/2_Rules.py", label="Rules reference", icon="📚")
        st.page_link("pages/3_Prepare.py", label="Application packet", icon="📦")
        st.page_link("pages/4_History.py", label="Audit history", icon="📜")
        st.page_link("pages/5_Settings.py", label="Settings", icon="⚙️")
        st.markdown('<div class="sidebar-spacer"></div>', unsafe_allow_html=True)
        st.caption("Current application")
        st.code(session_id, language=None)
        st.markdown(
            '<span class="safe-chip">● Human review required</span>',
            unsafe_allow_html=True,
        )


def _masthead(section: str) -> None:
    today = date.today().strftime("%B %d, %Y").upper()
    st.markdown(
        f"""
        <div class="masthead">
          <div><b>RealDoor</b><span class="dot">·</span>{html.escape(section.upper())}</div>
          <div>{today}<span class="dot">·</span>Vol. I</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def page_header(eyebrow: str, title: str, description: str) -> None:
    _masthead(eyebrow)
    st.markdown(
        f'<div class="eyebrow">{html.escape(eyebrow)}</div>'
        f"<h1>{html.escape(title)}</h1>"
        f'<p class="page-copy">{html.escape(description)}</p>',
        unsafe_allow_html=True,
    )


def status_badge(status: str) -> str:
    normalized = (status or "").lower().replace("_", " ")
    if normalized in {"complete", "processed", "ready for review", "present"}:
        kind = "success"
    elif normalized in {"review", "needs review", "expired"}:
        kind = "warning"
    elif normalized in {"missing", "incomplete"}:
        kind = "danger"
    else:
        kind = "neutral"
    return f'<span class="badge badge-{kind}">{html.escape(status)}</span>'


def confidence_badge(score: float) -> str:
    label = confidence_label(score)
    kind = "success" if label == "High" else "warning" if label == "Medium" else "danger"
    return f'<span class="badge badge-{kind}">{confidence_percent(score)}% · {label}</span>'


def metric_card(label: str, value: str, detail: str = "", accent: str = "navy") -> None:
    st.markdown(
        f'<div class="metric-card accent-{accent}">'
        f"<span>{html.escape(label)}</span>"
        f"<strong>{html.escape(str(value))}</strong>"
        f"<small>{html.escape(detail)}</small>"
        f"</div>",
        unsafe_allow_html=True,
    )


def readiness_hero(score: int, status: str, present: int, missing: int, expired: int) -> None:
    """Big dossier plate used on Dashboard and Application Packet pages."""
    st.markdown(
        f"""
        <div class="readiness-hero">
          <div>
            <div class="lbl">Document readiness</div>
            <div class="pct">{score}%</div>
          </div>
          <div>
            <div class="lbl" style="margin-bottom:.4rem;">Case status · {html.escape(status)}</div>
            <div class="sub">Document completeness only. This score does not
              constitute an eligibility determination. A qualified housing
              specialist reviews every application.</div>
          </div>
          <div class="stat">
            <div>Present <b>{present}</b></div>
            <div>Missing <b>{missing}</b></div>
            <div>Expired <b>{expired}</b></div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def safety_notice() -> None:
    st.markdown(
        '<div class="safety-notice"><b>Decision boundary</b>'
        "This workspace organizes evidence and document completeness. "
        "A qualified human makes every eligibility decision.</div>",
        unsafe_allow_html=True,
    )
