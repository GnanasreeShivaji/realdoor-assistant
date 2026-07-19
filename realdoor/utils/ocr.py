"""Local-first document text extraction and preview rendering.

Optional dependencies are imported defensively so the app still demonstrates its
deterministic starter-pack workflow when a workstation lacks OCR binaries.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any

from PIL import Image, ImageDraw

try:
    import pdfplumber
except ImportError:  # pragma: no cover - dependency fallback
    pdfplumber = None

try:
    import fitz
except ImportError:  # pragma: no cover
    fitz = None

try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None


def extract_text(file_bytes: bytes, file_name: str) -> tuple[str, str]:
    """Return document text and a human-readable processing status."""
    lower = file_name.lower()
    if lower.endswith(".pdf") and pdfplumber:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
        if text.strip():
            return text, "Text layer extracted"

    if lower.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff")):
        image = Image.open(BytesIO(file_bytes)).convert("RGB")
        if pytesseract:
            try:
                return pytesseract.image_to_string(image), "Local OCR complete"
            except Exception as exc:
                if "tesseract" in str(exc).lower():
                    return "", "Tesseract binary not installed — manual review or AI extraction available"
                return "", f"Local OCR unavailable — {type(exc).__name__}"
        return "", "OCR unavailable — install Tesseract or enable AI extraction"

    if lower.endswith(".pdf") and fitz and pytesseract:
        image = render_pdf_page(file_bytes)
        try:
            return pytesseract.image_to_string(image), "Raster OCR complete"
        except Exception as exc:
            if "tesseract" in str(exc).lower():
                return "", "Tesseract binary not installed — manual review or AI extraction available"
            return "", f"Raster OCR unavailable — {type(exc).__name__}"
    return "", "No readable text layer found"


def render_pdf_page(file_bytes: bytes, page: int = 1, scale: float = 1.6) -> Image.Image:
    if fitz:
        document = fitz.open(stream=file_bytes, filetype="pdf")
        pix = document.load_page(max(0, page - 1)).get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
    if pdfplumber:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            return pdf.pages[max(0, page - 1)].to_image(resolution=120).original.convert("RGB")
    raise RuntimeError("PDF preview requires PyMuPDF or pdfplumber.")


def render_preview(file_bytes: bytes, file_name: str, evidence: dict[str, Any] | None = None) -> Image.Image:
    if file_name.lower().endswith(".pdf"):
        page = int((evidence or {}).get("page", 1))
        image = render_pdf_page(file_bytes, page)
    else:
        image = Image.open(BytesIO(file_bytes)).convert("RGB")

    bbox = (evidence or {}).get("bbox")
    if bbox and len(bbox) == 4:
        # Starter-pack coordinates use PDF points with the origin at bottom-left.
        x0, y0, x1, y1 = [float(value) for value in bbox]
        page_width, page_height = 612.0, 792.0
        sx, sy = image.width / page_width, image.height / page_height
        rectangle = (x0 * sx, image.height - y1 * sy, x1 * sx, image.height - y0 * sy)
        overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        draw.rectangle(rectangle, fill=(245, 158, 11, 55), outline=(217, 119, 6, 255), width=4)
        image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    return image
