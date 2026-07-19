<div align="center">

# 🏠 RealDoor — Application-Readiness Copilot

**A renter-side copilot that turns synthetic household documents into a human-confirmed profile, explains one affordable-housing program's rules *with citations*, flags missing or expired documents, and prepares a renter-controlled packet — without ever deciding eligibility.**

**Team InnovHer** · Hack-Nation 6th Global AI Hackathon · Challenge 03 (RealPage)

🌐 **Live demo:** https://realdoor-copilot.lovable.app
· 💻 **Repository:** https://github.com/GnanasreeShivaji/realdoor-assistant

</div>

---

## 👥 Team InnovHer** — *assistive, not adjudicative.* 🏠

- **Gnanasree Shivaji**
- **Kaniksha**
- **Kavin Ganapathy**

---

## 📌 Project brief

Maria works two jobs and is trying to move her family into affordable housing. The
paperwork is fragmented, every program asks for something different, and one small
mistake can delay an application for weeks.

**RealDoor doesn't try to make the decision for her — it removes the friction around
it.** It reads the documents Maria already has, makes the published program rules
legible, shows its uncertainty honestly, and helps her assemble a packet that a
*qualified human* can review.

Our guiding principle, straight from the challenge:

> **The AI extracts, explains, retrieves, calculates, and prepares. The renter
> confirms. A qualified human decides.**

Scope is deliberately narrow and deep: **one metro** (Boston), **one program**
(LIHTC), **one frozen rule year** (FY2026 MTSP) — depth and correctness over broad
coverage.

---

## ✨ What it does — the three-stage journey

### 1 · Profile — human-confirmed extraction
Upload synthetic pay stubs or benefit letters → OCR → extract **only allowlisted
fields**, each with a source/evidence box and a calibrated **confidence** score. No
value is reused until the renter **confirms or corrects** it.

### 2 · Understand — cited rules & deterministic math
Ask about the program's rules and get an answer drawn only from a **versioned,
frozen rule corpus** — with the confirmed value, threshold, **formula**, **source
citation**, and **effective date**. Income math is plain arithmetic, not a model
guess. When the rule or input is uncertain, the assistant **abstains** — and it
**never labels a renter eligible**.

### 3 · Prepare — renter-controlled packet
Missing or expired documents are flagged against a **gold checklist**. The renter can
**preview, edit, download, and delete** everything. Nothing is ever auto-sent to a
property or provider.

---

## 🛡️ Responsible AI — built in, demonstrated live

The challenge requires these controls to *work*, not just be promised. RealDoor
implements every one:

| Non-negotiable | How RealDoor honours it |
|---|---|
| **No decisioning** | Never approves, denies, scores, or ranks. "Decide for me" requests are deflected to the rule + confirmed input + calculation. |
| **No hidden proxies** | No protected traits, demographic, or landlord-revenue features. Every feature is disclosed. |
| **Consent & correction** | Every extracted value is correctable; consent, actions, and rule versions are logged — **never raw document contents**. |
| **Privacy & security** | Synthetic documents only, field allowlists, isolated/ephemeral processing, and full **session deletion**. Never trains on uploads. |
| **Untrusted input** | Document text is treated as untrusted; embedded instructions are **quarantined** and cannot alter behaviour, rules, or data access. |
| **Accessible journey** | Targets **WCAG 2.2 AA**: keyboard operation, visible focus, labelled controls/errors, **no color-only status**, structured headings. |

---

## ✅ Acceptance demo — mapped to the app

| # | Required demo step | Where to show it |
|---|---|---|
| 1 | Upload a synthetic document, show extracted evidence | **Intake / Upload** |
| 2 | Correct one field, watch downstream values update | **Profile** |
| 3 | Ask a rules question, show the authoritative citation | **Rules Assistant** |
| 4 | Show the deterministic calculation and its effective date | **Profile / Packet** |
| 5 | Identify a missing/expired item, then export the packet | **Application Packet** |
| 6 | Run the refusal, prompt-injection & session-deletion tests | **Trust & Safety / Settings** |

---

## 🧭 How our build maps to the judging rubric

| Criterion (weight) | What we deliver |
|---|---|
| **Profile accuracy (25%)** | Allowlisted field extraction, evidence boxes, calibrated confidence, correction, and abstention. |
| **Rules & math (25%)** | Correct program + year, authoritative citations, exact deterministic calculations, preserved effective dates. |
| **Safety & privacy (20%)** | Refusal of decisioning, no scores/inferences, prompt-injection resistance, minimal retention, export & deletion. |
| **Accessibility (15%)** | Keyboard-complete journey, understandable errors/status, readable source presentation. |
| **End-to-end usefulness (15%)** | One coherent journey producing a clear, editable, renter-controlled packet. |

---

## 🧱 Tech stack

### Web app (`src/`) — the live product

| Layer | Technology | Why we chose it |
|---|---|---|
| **Framework** | TanStack Start (React 18 + TypeScript, SSR) | Type-safe, server-rendered React for a fast, accessible journey |
| **Build** | Vite | Instant dev server and optimized production builds |
| **Routing** | TanStack Router | Type-safe routes for the Profile → Understand → Prepare flow |
| **Data / state** | TanStack Query, Zod, React Hook Form | Predictable data handling and validated, correctable inputs |
| **Styling** | Tailwind CSS + Radix UI | Accessible primitives (visible focus, keyboard nav) toward WCAG 2.2 AA |
| **Icons / charts** | lucide-react, Recharts | Clear iconography and data-only visualizations |
| **PDF / documents** | jsPDF, pdfjs-dist | In-browser packet generation and document preview — no server needed |
| **Deployment** | Lovable | Auto-syncs to GitHub and hosts the live demo |

### Companion Python app (`realdoor/`) — reference implementation

A second implementation of the same three-stage journey, built to run **fully offline
and deterministically** for reproducible demos.

| Layer | Technology | Purpose |
|---|---|---|
| **UI** | Streamlit | Rapid, keyboard-friendly multipage interface |
| **Data** | pandas | Deterministic income and rule calculations |
| **Document parsing** | pdfplumber, PyMuPDF | Text extraction and OCR of synthetic documents |
| **Packet export** | reportlab | Renter-controlled PDF packet generation |

---

## 🚀 Getting started

### Prerequisites
- **Node.js 20.19+ or 22.12+** (for the web app) — check with `node -v`
- **Python 3.10+** (for the companion app)
- No API keys required — everything runs on the bundled synthetic data.

### Run the web app (the live product)

```bash
git clone https://github.com/GnanasreeShivaji/realdoor-assistant.git
cd realdoor-assistant
npm install        # or: bun install
npm run dev        # or: bun run dev
```

Open the printed URL — usually **http://localhost:5173**.

### Run from a downloaded ZIP

1. Extract the ZIP (you'll get a `RealDoor Assistant` folder).
2. In Terminal: `cd "RealDoor Assistant"`
3. `npm install`  →  `npm run dev`  →  open **http://localhost:5173**

> A ZIP has no `node_modules`, so the `npm install` step is required once (needs internet).

### Run the companion Python app

```bash
cd realdoor            # inside the project
pip install -r requirements.txt
streamlit run app.py
```

Opens **http://localhost:8501**. Works fully on synthetic data; the OpenAI key in
Settings is **optional**.

---

## 📁 Project structure

```
realdoor-assistant/
├── src/                 # Web app (Lovable / TanStack Start + React)
│   ├── routes/          # dashboard, intake, profile, rules, packet,
│   │                    #   analytics, history, git-sync, settings
│   ├── components/      # reusable UI
│   ├── hooks/  lib/     # hooks & utilities
│   └── styles.css       # Tailwind styling
├── realdoor/            # Companion Python (Streamlit) implementation
│   ├── app.py  pages/  utils/  data/  tests/
│   └── requirements.txt
├── public/              # static assets
├── package.json         # scripts & dependencies
└── vite.config.ts       # Vite / TanStack Start config
```

---

## 🗂️ Data & attribution

- **Synthetic documents only** — no real renter data is used anywhere.
- Rules and limits use the **frozen FY2026 MTSP income limits** and official LIHTC
  rule corpus provided in the organizer pack, with effective dates preserved.
- Public datasets are **never** used to profile applicants or infer protected traits.

---

## 📄 License

Built for the Hack-Nation 6th Global AI Hackathon (Challenge 03, RealPage). Data and
rule content follow the organizer pack's license manifest. Add your chosen code
license (e.g. MIT) here.

---

<div align="center">


</div>
