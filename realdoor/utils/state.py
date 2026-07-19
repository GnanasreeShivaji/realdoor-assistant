"""Shared session state helpers, CSS injection, sidebar branding.

Keeps every page consistent without a heavyweight framework.
"""
from __future__ import annotations

import os
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"
STYLES = ROOT / "styles.css"

# ---- Defaults kept in one place so every page can rely on them ----
DEFAULT_STATE = {
    "documents": [],          # list[dict] uploaded doc records
    "profile": {},            # confirmed field -> {value, source, confidence}
    "rule_history": [],       # [{question, answer, citations, ts}]
    "packet_pdf": None,       # bytes
    "dark_mode": False,
    "use_gpt": bool(os.getenv("OPENAI_API_KEY")),
    "household_id": "HH-001",
    "as_of_date": "2026-07-18",   # frozen challenge date
    "toast_queue": [],
}


def init_session():
    for k, v in DEFAULT_STATE.items():
        st.session_state.setdefault(k, v)


def load_css():
    """Inject the shared stylesheet and optional dark override."""
    if STYLES.exists():
        css = STYLES.read_text()
        if st.session_state.get("dark_mode"):
            css += """
            :root {
              --rd-bg:#0b1220; --rd-surface:#121a2b; --rd-border:#1f2a44;
              --rd-text:#e5e7eb; --rd-muted:#94a3b8;
            }
            html, body, [class*="stApp"] { background: var(--rd-bg) !important; color: var(--rd-text); }
            .rd-answer { background:#0f172a; }
            """
        st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


def page_header(title: str, subtitle: str = "", icon: str = ""):
    st.markdown(
        f"""
        <div style="margin-bottom:8px;">
          <div style="font-size:11px; letter-spacing:.14em; text-transform:uppercase;
                      color:var(--rd-muted);">RealDoor · Application Readiness Copilot</div>
          <h1 style="margin:.2rem 0 .2rem 0; font-size:28px; font-weight:650;">
            {icon} {title}
          </h1>
          <div class="rd-muted">{subtitle}</div>
        </div>
        <hr style="border:none; border-top:1px solid var(--rd-border); margin:12px 0 20px;">
        """,
        unsafe_allow_html=True,
    )


def sidebar_brand():
    with st.sidebar:
        st.markdown(
            """
            <div style="padding:8px 0 18px 0;">
              <div style="font-size:22px; font-weight:700; color:#fff;">🏘️ RealDoor</div>
              <div style="font-size:12px; color:#94a3b8; margin-top:2px;">
                Application Readiness Copilot
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.markdown(
            f"<div style='font-size:12px;color:#94a3b8;'>Household: "
            f"<b style='color:#e2e8f0'>{st.session_state.get('household_id','—')}</b><br>"
            f"As of: <b style='color:#e2e8f0'>{st.session_state.get('as_of_date','—')}</b></div>",
            unsafe_allow_html=True,
        )
        st.markdown("---")
        st.caption("Navigation")


def badge(text: str, kind: str = "neutral") -> str:
    return f'<span class="rd-badge {kind}">{text}</span>'


def bootstrap():
    """Call at the top of every page."""
    st.set_page_config(
        page_title="RealDoor",
        page_icon="🏘️",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    init_session()
    load_css()
    sidebar_brand()
