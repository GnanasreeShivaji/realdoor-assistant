"""Shared presentation components for a consistent agency-workbench UI."""

from __future__ import annotations

import html
from pathlib import Path

import streamlit as st

from utils.confidence import confidence_label, confidence_percent

ROOT = Path(__file__).resolve().parents[1]


def configure_page(title: str, icon: str = "🏠") -> None:
    st.set_page_config(page_title=f"{title} · RealDoor", page_icon=icon, layout="wide", initial_sidebar_state="expanded")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


def sidebar(active: str, session_id: str) -> None:
    with st.sidebar:
        st.markdown('<div class="brand-mark">RD</div><div class="brand-copy"><b>RealDoor</b><span>Readiness Copilot</span></div>', unsafe_allow_html=True)
        st.caption("HOUSING OPERATIONS")
        st.page_link("app.py", label="Dashboard", icon="🏠")
        st.page_link("pages/0_Upload_Documents.py", label="Upload Documents", icon="📄")
        st.page_link("pages/1_Profile.py", label="Profile", icon="👤")
        st.page_link("pages/2_Rules.py", label="Rules Assistant", icon="📚")
        st.page_link("pages/3_Prepare.py", label="Application Packet", icon="📦")
        st.page_link("pages/4_History.py", label="History", icon="📜")
        st.page_link("pages/5_Settings.py", label="Settings", icon="⚙️")
        st.markdown('<div class="sidebar-spacer"></div>', unsafe_allow_html=True)
        st.caption("CURRENT APPLICATION")
        st.code(session_id, language=None)
        st.markdown('<span class="safe-chip">● Human review required</span>', unsafe_allow_html=True)


def page_header(eyebrow: str, title: str, description: str) -> None:
    st.markdown(f'<div class="eyebrow">{html.escape(eyebrow)}</div><h1>{html.escape(title)}</h1><p class="page-copy">{html.escape(description)}</p>', unsafe_allow_html=True)


def status_badge(status: str) -> str:
    normalized = status.lower().replace("_", " ")
    kind = "success" if normalized in {"complete", "processed", "ready for review"} else "warning" if normalized in {"review", "needs review", "expired"} else "danger" if normalized in {"missing", "incomplete"} else "neutral"
    return f'<span class="badge badge-{kind}">{html.escape(status)}</span>'


def confidence_badge(score: float) -> str:
    label = confidence_label(score)
    kind = "success" if label == "High" else "warning" if label == "Medium" else "danger"
    return f'<span class="badge badge-{kind}">{confidence_percent(score)}% · {label}</span>'


def metric_card(label: str, value: str, detail: str = "", accent: str = "navy") -> None:
    st.markdown(f'<div class="metric-card accent-{accent}"><span>{html.escape(label)}</span><strong>{html.escape(value)}</strong><small>{html.escape(detail)}</small></div>', unsafe_allow_html=True)


def safety_notice() -> None:
    st.markdown('<div class="safety-notice"><b>Decision boundary</b><br>This workspace organizes evidence and document completeness. A qualified human makes every eligibility decision.</div>', unsafe_allow_html=True)

