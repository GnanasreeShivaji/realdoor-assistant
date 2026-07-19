"""Centralized paths so every page uses the same application state."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"
ASSETS_DIR = ROOT / "assets"
DB_PATH = DATA_DIR / "realdoor.db"
UPLOAD_DIR = DATA_DIR / "runtime_uploads"
PACKET_DIR = DATA_DIR / "generated_packets"
RULE_CORPUS = DATA_DIR / "rule_corpus.jsonl"
MTSP_LIMITS = DATA_DIR / "mtsp_2026_boston_cambridge_quincy.csv"
CHECKLISTS = DATA_DIR / "application_checklists.json"
GOLD_FIELDS = DATA_DIR / "document_gold.jsonl"
MANIFEST = DATA_DIR / "document_manifest.csv"
QA_GOLD = DATA_DIR / "qa_gold.jsonl"
ADVERSARIAL_TESTS = DATA_DIR / "adversarial_tests.jsonl"
SAMPLE_DOCUMENTS = DOCS_DIR / "sample_documents"

for directory in (DATA_DIR, DOCS_DIR, ASSETS_DIR, UPLOAD_DIR, PACKET_DIR):
    directory.mkdir(parents=True, exist_ok=True)

