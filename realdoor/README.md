# RealDoor — Application Readiness Copilot

Internal-style enterprise app for affordable-housing agencies. Uploads
tenant documents, runs OCR + field extraction with confidence and evidence,
answers rulebook questions **only from cited sources**, tracks application
readiness, and generates a professional application packet PDF.

Built for the Hack-Nation × RealPage RealDoor Challenge.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optional: enable GPT-powered OCR / extraction / rule answering
export OPENAI_API_KEY=sk-...

# For image OCR fallback, install tesseract system binary:
#   macOS:  brew install tesseract
#   Ubuntu: sudo apt-get install tesseract-ocr

streamlit run app.py
```

Open http://localhost:8501.

## What it does

1. **Upload** — Pay stubs, bank statements, benefit letters, employment
   letters, IDs, leases, utility bills. Runs OCR (Tesseract or GPT vision),
   extracts fields, shows evidence boxes and confidence.
2. **Profile** — Confirmed household profile with per-field source,
   confidence, and inline edit.
3. **Rules Assistant** — Retrieval-only Q&A over the frozen rule corpus in
   `data/rule_corpus.jsonl`. Every answer cites `rule_id`, source URL,
   effective date, and page. Refuses when unsure.
4. **Application Packet** — Readiness score (document completeness only,
   never eligibility), missing/expired list, PDF export.
5. **History / Settings** — Autosaved SQLite sessions, JSON export,
   session reset, dark mode.

## Design boundaries

- Never determines eligibility.
- Never answers rule questions from general knowledge.
- Readiness score = document completeness, nothing else.

## Data

Everything under `data/` comes from the official RealDoor starter pack
(HUD MTSP FY 2026, LIHTC Boston metro, frozen rule corpus, gold QA,
application checklists).
