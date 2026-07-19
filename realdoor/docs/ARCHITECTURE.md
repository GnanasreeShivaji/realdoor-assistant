# Architecture

## Workflow

`Document intake → local text/OCR → allowlisted extraction → evidence review → human confirmation → completeness checklist → reviewer packet`

The UI is a Streamlit multipage application. Shared presentation lives in `utils/ui.py`; domain services are isolated under `utils/`. SQLite stores document metadata, profile fields, and audit events. It intentionally excludes raw OCR text and secrets.

## Extraction strategy

The organizer's synthetic documents use deterministic gold labels and bounding boxes. This makes the demo reproducible and lets reviewers see exact evidence. New documents first use local text extraction and regex patterns. Optional OpenAI extraction is constrained to the same allowlist and treats document content as untrusted data.

## Rules strategy

`utils/rules_engine.py` ranks only entries in `data/rule_corpus.jsonl`. Every supported response carries a rule ID, locator, effective date, source link, and confidence. Decision requests are refused; unsupported questions receive the required abstention message.

## Production extension points

For a real deployment, replace session memory with encrypted object storage, add agency SSO and role-based access, use managed key storage, enforce retention schedules, run OCR in a private service boundary, and complete accessibility/security testing.

