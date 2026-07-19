"""OCR utilities.

Strategy:
  1. If file is a PDF with an embedded text layer → use pdfplumber (fast, exact).
  2. Else if OPENAI_API_KEY is set → use GPT-4o-mini vision for OCR.
  3. Else fall back to pytesseract (requires local tesseract binary).

Every path returns:
    {"text": str, "pages": [str], "engine": str, "elapsed_ms": int}
"""
from __future__ import annotations

import io
import os
import time
from typing import Any

from PIL import Image


def _pdf_text(data: bytes) -> tuple[str, list[str]]:
    import pdfplumber
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for p in pdf.pages:
            pages.append(p.extract_text() or "")
    return "\n".join(pages), pages


def _pdf_needs_ocr(pages: list[str]) -> bool:
    joined = "".join(pages).strip()
    return len(joined) < 40  # essentially empty → scanned pdf


def _tesseract_image(img: Image.Image) -> str:
    import pytesseract
    return pytesseract.image_to_string(img)


def _openai_image(img_bytes: bytes, mime: str = "image/png") -> str:
    """Use OpenAI vision to transcribe an image."""
    from openai import OpenAI
    import base64
    client = OpenAI()
    b64 = base64.b64encode(img_bytes).decode()
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": (
                    "Transcribe every visible text token from this document image. "
                    "Preserve line breaks. Do not add commentary."
                )},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            ],
        }],
        temperature=0,
    )
    return r.choices[0].message.content or ""


def _pdf_to_images(data: bytes) -> list[Image.Image]:
    import fitz  # PyMuPDF
    imgs: list[Image.Image] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            pix = page.get_pixmap(dpi=180)
            imgs.append(Image.open(io.BytesIO(pix.tobytes("png"))))
    return imgs


def run_ocr(file_bytes: bytes, filename: str, use_gpt: bool | None = None) -> dict[str, Any]:
    """Run OCR on a document. Returns structured result."""
    t0 = time.time()
    name = filename.lower()
    use_gpt = bool(os.getenv("OPENAI_API_KEY")) if use_gpt is None else use_gpt
    engine = "unknown"
    pages: list[str] = []

    try:
        if name.endswith(".pdf"):
            text, pages = _pdf_text(file_bytes)
            if _pdf_needs_ocr(pages):
                imgs = _pdf_to_images(file_bytes)
                pages = []
                for img in imgs:
                    if use_gpt:
                        buf = io.BytesIO(); img.save(buf, format="PNG")
                        pages.append(_openai_image(buf.getvalue()))
                        engine = "openai-vision"
                    else:
                        pages.append(_tesseract_image(img))
                        engine = "tesseract"
                text = "\n".join(pages)
            else:
                engine = "pdf-textlayer"
        elif name.endswith((".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp")):
            img = Image.open(io.BytesIO(file_bytes))
            if use_gpt:
                text = _openai_image(file_bytes, mime=f"image/{img.format.lower() if img.format else 'png'}")
                engine = "openai-vision"
            else:
                text = _tesseract_image(img)
                engine = "tesseract"
            pages = [text]
        elif name.endswith(".docx"):
            import docx
            d = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in d.paragraphs)
            pages = [text]
            engine = "docx"
        else:
            text = file_bytes.decode("utf-8", errors="ignore")
            pages = [text]
            engine = "raw-text"
    except Exception as e:  # noqa: BLE001
        return {
            "text": "",
            "pages": [],
            "engine": engine,
            "elapsed_ms": int((time.time() - t0) * 1000),
            "error": str(e),
        }

    return {
        "text": text,
        "pages": pages,
        "engine": engine,
        "elapsed_ms": int((time.time() - t0) * 1000),
    }
