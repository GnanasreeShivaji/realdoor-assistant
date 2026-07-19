// Global data-mode: keeps synthetic fixtures and real uploads strictly separated.
import { HOUSEHOLDS, type Household } from "./mock-data";
import { useSyncExternalStore } from "react";

export type DataMode = "synthetic" | "uploaded";
const KEY = "realdoor:mode";
const EVT = "realdoor:mode-change";
export const UPLOAD_EVT = "realdoor:uploads-change";
export const UPLOAD_HH_ID = "UP-001";

export function getMode(): DataMode {
  if (typeof window === "undefined") return "synthetic";
  return (localStorage.getItem(KEY) as DataMode) || "synthetic";
}

export function setMode(m: DataMode) {
  localStorage.setItem(KEY, m);
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener(UPLOAD_EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener(UPLOAD_EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useDataMode(): [DataMode, (m: DataMode) => void] {
  const mode = useSyncExternalStore(subscribe, getMode, () => "synthetic" as DataMode);
  return [mode, setMode];
}

// Notifies every page that upload storage changed (same-tab).
export function notifyUploadsChanged() {
  window.dispatchEvent(new Event(UPLOAD_EVT));
}

type StoredFile = { name: string; size: number; fields: Record<string, string>; missing: string[] };

export function loadStoredFiles(hh: string): StoredFile[] {
  try {
    const raw = localStorage.getItem(`realdoor:extract:${hh}`);
    if (!raw) return [];
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

function inferDocType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gig")) return "gig_statement";
  if (n.includes("stub") || n.includes("paystub") || n.includes("pay_stub")) return "pay_stub";
  if (n.includes("benefit")) return "benefit_letter";
  if (n.includes("employment") || n.includes("offer") || n.includes("letter")) return "employment_letter";
  if (n.includes("application") || n.includes("summary")) return "application_summary";
  return "pay_stub";
}

const FREQ_MAP: Record<string, Household["frequency"]> = {
  weekly: "weekly", biweekly: "biweekly", biweeekly: "biweekly", bimonthly: "biweekly",
  semimonthly: "semimonthly", monthly: "monthly",
};

export function buildUploadedHousehold(id: string = UPLOAD_HH_ID): Household | null {
  const files = loadStoredFiles(id);
  if (files.length === 0) return null;
  const first = (k: string) => { for (const f of files) if (f.fields[k]) return f.fields[k]; return undefined; };
  const applicant = first("person_name") ?? "Uploaded applicant";
  const address = first("address") ?? "—";
  const size = Number(first("household_size") ?? "1") || 1;
  const freqRaw = (first("pay_frequency") ?? "biweekly").toLowerCase().replace(/[-\s]/g, "");
  const frequency = FREQ_MAP[freqRaw] ?? "biweekly";
  const gross = Number((first("gross_pay") ?? "0").replace(/[^0-9.]/g, "")) || 0;
  const employer = first("employer_name") ?? "—";
  const reasons: string[] = [];
  const anyMissing = files.some((f) => f.missing.length > 0);
  if (anyMissing) reasons.push("PAY_STUB_MISSING_FIELDS");

  return {
    id,
    applicant,
    address,
    size,
    frequency,
    grossPerPeriod: gross,
    employer,
    documents: files.map((f) => ({
      fileName: f.name,
      documentType: inferDocType(f.name),
      status: f.missing.length === 0 ? "complete" : "review",
      confidence: f.missing.length === 0 ? 0.95 : 0.72,
      pages: 1,
    })),
    reviewReasons: reasons,
  };
}

export function getEffectiveHouseholds(mode: DataMode): Household[] {
  if (mode === "synthetic") return HOUSEHOLDS;
  const up = buildUploadedHousehold();
  return up ? [up] : [];
}
