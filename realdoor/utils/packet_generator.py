"""Application packet PDF generator (reportlab)."""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)


PRIMARY = colors.HexColor("#1f4bd8")
MUTED   = colors.HexColor("#64748b")
BORDER  = colors.HexColor("#e5e8ef")
OK      = colors.HexColor("#0f9d58")
WARN    = colors.HexColor("#b7791f")


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("H1", parent=ss["Heading1"], fontSize=20, spaceAfter=6, textColor=colors.HexColor("#0f172a")))
    ss.add(ParagraphStyle("H2", parent=ss["Heading2"], fontSize=13, spaceBefore=14, spaceAfter=6, textColor=PRIMARY))
    ss.add(ParagraphStyle("Muted", parent=ss["Normal"], fontSize=9, textColor=MUTED))
    ss.add(ParagraphStyle("Cell", parent=ss["Normal"], fontSize=9))
    return ss


def _kv_table(rows: list[tuple[str, str]]):
    data = [[Paragraph(f"<b>{k}</b>", _styles()["Cell"]),
             Paragraph(v or "—", _styles()["Cell"])] for k, v in rows]
    t = Table(data, colWidths=[1.8 * inch, 4.7 * inch])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def generate(profile: dict, documents: list[dict], checklist: dict,
             household_id: str, as_of: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
        title="RealDoor Application Packet",
    )
    ss = _styles()
    story: list[Any] = []

    story.append(Paragraph("RealDoor · Application Packet", ss["H1"]))
    story.append(Paragraph(
        f"Household <b>{household_id}</b> &nbsp;·&nbsp; Generated {datetime.now():%B %d, %Y at %I:%M %p} "
        f"&nbsp;·&nbsp; As-of date {as_of}", ss["Muted"]))
    story.append(Spacer(1, 10))

    # Readiness box
    pct = checklist.get("readiness_pct", 0)
    ready_data = [[
        Paragraph(f"<font size=22 color='#ffffff'><b>{pct}%</b></font><br/>"
                  f"<font size=8 color='#dbe4ff'>DOCUMENT READINESS</font>", ss["Normal"]),
        Paragraph(
            f"<font size=9 color='#ffffff'>Present: {len(checklist.get('present', []))} · "
            f"Missing: {len(checklist.get('missing', []))} · "
            f"Expired: {len(checklist.get('expired', []))}<br/><br/>"
            "<i>This score measures document completeness only. It does not "
            "constitute an eligibility determination.</i></font>", ss["Normal"]),
    ]]
    rt = Table(ready_data, colWidths=[1.8 * inch, 4.7 * inch])
    rt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("BOX", (0, 0), (-1, -1), 0, PRIMARY),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(rt)

    # Profile
    story.append(Paragraph("Confirmed Profile", ss["H2"]))
    prof_rows: list[tuple[str, str]] = []
    for field, obj in profile.items():
        if isinstance(obj, dict):
            v = obj.get("value", "")
            c = obj.get("confidence", 0)
            src = obj.get("source", "")
            prof_rows.append((field.replace("_", " ").title(),
                              f"{v}  <font color='#64748b' size=8>· {int(c*100)}% · {src}</font>"))
        else:
            prof_rows.append((field.replace("_", " ").title(), str(obj)))
    if not prof_rows:
        prof_rows = [("(none)", "No confirmed fields yet.")]
    story.append(_kv_table(prof_rows))

    # Documents
    story.append(Paragraph("Uploaded Documents", ss["H2"]))
    if documents:
        head = ["File", "Type", "OCR", "Confidence", "Fields"]
        rows = [head]
        for d in documents:
            rows.append([
                d.get("filename", "")[:36],
                d.get("doc_type_label", d.get("doc_type", "")),
                d.get("ocr_engine", ""),
                f"{int(d.get('confidence_avg', 0) * 100)}%",
                str(len(d.get("fields", {}))),
            ])
        t = Table(rows, colWidths=[2.4*inch, 1.4*inch, 1.1*inch, 0.9*inch, 0.7*inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("No documents uploaded.", ss["Muted"]))

    # Checklist
    story.append(Paragraph("Application Checklist", ss["H2"]))
    check_rows = []
    for item in checklist.get("items", []):
        status = item["status"]
        color = OK if status == "present" else (WARN if status == "expired" else colors.HexColor("#c0392b"))
        mark = "✓" if status == "present" else ("⚠" if status == "expired" else "✗")
        check_rows.append([
            Paragraph(f"<font color='{color.hexval()}'><b>{mark}</b></font>", ss["Cell"]),
            Paragraph(item["label"], ss["Cell"]),
            Paragraph(f"<font color='#64748b' size=8>{status.upper()}</font>", ss["Cell"]),
        ])
    if check_rows:
        t = Table(check_rows, colWidths=[0.3 * inch, 4.7 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)

    story.append(Spacer(1, 18))
    story.append(Paragraph(
        "Prepared by RealDoor — Application Readiness Copilot. This packet "
        "summarizes submitted documents for intake review. It is not a "
        "compliance determination.", ss["Muted"]))

    doc.build(story)
    return buf.getvalue()
