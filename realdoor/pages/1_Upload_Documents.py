"""Document upload + OCR + extraction."""
from __future__ import annotations

import io
import time
from statistics import mean

import streamlit as st
from PIL import Image

from utils.state import bootstrap, page_header, badge
from utils.ocr import run_ocr
from utils.extractor import extract, classify, DOC_TYPE_LABELS, DOC_TYPES

bootstrap()
page_header(
    "Upload Documents",
    "Drop tenant documents. We OCR, classify, and extract fields with evidence.",
    icon="📄",
)

with st.container():
    st.markdown("<div class='rd-card'>", unsafe_allow_html=True)
    st.markdown("### Drop files")
    files = st.file_uploader(
        "Pay stubs, bank statements, benefit letters, employment letters, IDs, leases, utility bills.",
        type=["pdf", "png", "jpg", "jpeg", "webp", "tif", "tiff", "docx"],
        accept_multiple_files=True,
        label_visibility="visible",
    )
    col_a, col_b, col_c = st.columns([1, 1, 3])
    doc_type_override = col_a.selectbox(
        "Document type",
        ["auto-detect"] + DOC_TYPES,
        format_func=lambda x: "Auto-detect" if x == "auto-detect" else DOC_TYPE_LABELS.get(x, x),
    )
    use_gpt = col_b.checkbox("Use GPT vision when needed",
                              value=st.session_state.get("use_gpt", False))
    process = col_c.button("Process uploads", type="primary", use_container_width=True,
                            disabled=not files)
    st.markdown("</div>", unsafe_allow_html=True)


def _classify(text: str, filename: str) -> str:
    if doc_type_override != "auto-detect":
        return doc_type_override
    return classify(text, filename)


if process and files:
    progress = st.progress(0.0, text="Starting…")
    log = st.empty()

    new_docs = []
    for i, f in enumerate(files, start=1):
        progress.progress((i - 1) / len(files),
                          text=f"Reading {f.name} ({i}/{len(files)})")
        raw = f.read()
        ocr = run_ocr(raw, f.name, use_gpt=use_gpt)
        doc_type = _classify(ocr["text"], f.name)

        fields = extract(ocr["text"], doc_type, f.name)
        avg_conf = mean([v["confidence"] for v in fields.values()]) if fields else 0.0

        preview_png = None
        try:
            if f.name.lower().endswith(".pdf"):
                import fitz
                with fitz.open(stream=raw, filetype="pdf") as pdf:
                    pix = pdf[0].get_pixmap(dpi=120)
                    preview_png = pix.tobytes("png")
            else:
                img = Image.open(io.BytesIO(raw))
                img.thumbnail((900, 900))
                buf = io.BytesIO(); img.save(buf, format="PNG")
                preview_png = buf.getvalue()
        except Exception:
            preview_png = None

        new_docs.append({
            "filename": f.name,
            "size": len(raw),
            "doc_type": doc_type,
            "doc_type_label": DOC_TYPE_LABELS.get(doc_type, doc_type),
            "ocr_engine": ocr["engine"],
            "ocr_ms": ocr["elapsed_ms"],
            "ocr_error": ocr.get("error"),
            "text_preview": ocr["text"][:2500],
            "fields": fields,
            "confidence_avg": round(avg_conf, 2),
            "preview_png": preview_png,
            "uploaded_at": time.time(),
        })
        log.info(f"✓ {f.name} — {DOC_TYPE_LABELS.get(doc_type, doc_type)} "
                 f"· {len(fields)} field(s) · avg {int(avg_conf*100)}%")

    st.session_state["documents"].extend(new_docs)
    progress.progress(1.0, text="Done")
    st.toast(f"Processed {len(new_docs)} document(s).", icon="✅")

# ---- Existing documents -----------------------------------------------------
docs = st.session_state["documents"]
st.write("")
st.markdown(f"### Processed documents  <span class='rd-muted'>({len(docs)})</span>",
            unsafe_allow_html=True)

if not docs:
    st.info("Upload documents above to see OCR results, extracted fields, and confidence.")
else:
    for idx, d in enumerate(docs):
        with st.expander(
            f"📎 {d['filename']}  ·  {d['doc_type_label']}  ·  "
            f"avg confidence {int(d['confidence_avg']*100)}%",
            expanded=idx == len(docs) - 1,
        ):
            left, right = st.columns([1, 1.3])
            with left:
                if d.get("preview_png"):
                    st.image(d["preview_png"], caption="Preview", use_container_width=True)
                ok = not d.get("ocr_error")
                badges_html = " ".join([
                    badge(d["ocr_engine"], "info"),
                    badge(f"{d['ocr_ms']} ms", "neutral"),
                    badge("OCR OK" if ok else "OCR ERROR", "ok" if ok else "danger"),
                ])
                st.markdown(badges_html, unsafe_allow_html=True)

                if d.get("ocr_error"):
                    st.error(d["ocr_error"])
                with st.expander("Raw OCR text"):
                    st.code(d["text_preview"] or "(empty)", language="text")

            with right:
                st.markdown("**Extracted fields**")
                if not d["fields"]:
                    st.warning("No structured fields were extracted. Try enabling GPT vision "
                               "or upload a clearer copy.")
                for fname, obj in d["fields"].items():
                    conf = obj["confidence"]
                    kind = "ok" if conf >= 0.75 else ("warn" if conf >= 0.55 else "danger")
                    st.markdown(
                        f"<div class='rd-field'>"
                        f"<div class='k'>{fname.replace('_',' ').title()}</div>"
                        f"<div class='v'>{obj['value']}</div>"
                        f"<div class='src'>{obj['source']}</div>"
                        f"<div>{badge(f'{int(conf*100)}%', kind)}</div>"
                        f"</div>",
                        unsafe_allow_html=True,
                    )
                    with st.expander(f"Evidence for {fname}", expanded=False):
                        st.markdown(f"<code style='background:#f6f7fb;padding:6px;"
                                    f"border-radius:6px;display:block;'>…{obj['evidence']}…</code>",
                                    unsafe_allow_html=True)

                col_x, col_y = st.columns(2)
                if col_x.button("Confirm into profile", key=f"confirm-{idx}", type="primary"):
                    for fname, obj in d["fields"].items():
                        st.session_state["profile"][fname] = {
                            "value": obj["value"],
                            "confidence": obj["confidence"],
                            "source": d["filename"],
                        }
                    st.toast(f"Merged {len(d['fields'])} field(s) into profile.", icon="👤")
                if col_y.button("Remove document", key=f"rm-{idx}"):
                    st.session_state["documents"].pop(idx)
                    st.rerun()
