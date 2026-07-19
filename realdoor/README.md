# RealDoor — Application Readiness Copilot

RealDoor is an internal-style Streamlit workbench for affordable-housing application preparation. It extracts allowlisted facts from documents, keeps every fact linked to evidence, retrieves answers only from the supplied rule corpus, measures document completeness, and creates a reviewer packet.

It deliberately **does not** make eligibility, approval, denial, ranking, or priority decisions.

## Quick start

Use Python 3.10 or later.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

The synthetic household workflow works without an API key. In **Settings**, an OpenAI key can optionally enable constrained extraction for newly uploaded documents. The default model is `gpt-5`; `gpt-4.1` is also supported.

## Demo path

1. Open **Upload Documents**, record consent, and load synthetic household `HH-001`.
2. Run extraction and inspect document previews and confidence.
3. Open **Profile**, correct or confirm extracted fields, and view highlighted source evidence.
4. Use **Rules Assistant** for a cited corpus lookup and transparent annualization.
5. Open **Application Packet**, review completeness, and download the PDF or JSON.

## Privacy and safety

- Raw OCR text and API keys are never written to SQLite or audit logs.
- Uploaded bytes stay in Streamlit session memory unless a deployment explicitly adds persistence.
- Extraction is limited to a field allowlist in `utils/models.py`.
- Rule retrieval abstains when the supplied corpus lacks evidence.
- Packet output includes an explicit human-review boundary.
- The Settings page can delete all records associated with the current application.

See `docs/ARCHITECTURE.md` and `docs/SAFETY.md` for implementation details.

