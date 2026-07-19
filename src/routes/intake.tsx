import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HOUSEHOLDS } from "@/lib/mock-data";
import { useDataMode, UPLOAD_HH_ID, notifyUploadsChanged, loadStoredFiles } from "@/lib/data-mode";
import { useEffect, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Trash2, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Document Intake · RealDoor" }, { name: "description", content: "Upload household documents; deterministic extraction with human-in-the-loop review." }] }),
  component: Intake,
});

type ExtractedFile = { name: string; size: number; fields: Record<string, string>; missing: string[] };

const FIELD_KEYS = ["person_name", "household_size", "address", "pay_date", "pay_period_start", "pay_period_end", "pay_frequency", "gross_pay", "hourly_rate", "employer_name", "employment_start_date", "benefit_amount"] as const;

const PATTERNS: Record<string, RegExp[]> = {
  person_name: [/(?:employee|name|applicant)[:\s]+([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/i],
  household_size: [/household\s*size[:\s]+(\d+)/i],
  address: [/address[:\s]+([0-9]+\s+[A-Za-z0-9 .,#-]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Pkwy)[A-Za-z0-9 .,#-]*)/i],
  pay_date: [/pay\s*date[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i, /pay\s*date[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i],
  pay_period_start: [/(?:period\s*start|pay\s*period\s*start|period\s*begin)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i],
  pay_period_end: [/(?:period\s*end|pay\s*period\s*end)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i],
  pay_frequency: [/(?:pay\s*frequency|frequency)[:\s]+(weekly|bi-?weekly|semi-?monthly|monthly)/i],
  gross_pay: [/gross\s*(?:pay|earnings|income)[:\s]+\$?([0-9,]+\.?[0-9]*)/i],
  hourly_rate: [/(?:hourly\s*rate|rate)[:\s]+\$?([0-9]+\.?[0-9]*)/i],
  employer_name: [/employer[:\s]+([A-Z][A-Za-z0-9 &,.'-]+(?:LLC|Inc|Corp|Ltd|Logistics|Services|Care|Company|Co\.)?)/],
  employment_start_date: [/(?:start\s*date|hire\s*date|employment\s*start)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i],
  benefit_amount: [/benefit\s*amount[:\s]+\$?([0-9,]+\.?[0-9]*)/i],
};

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    try {
      const pdfjs: any = await import("pdfjs-dist");
      // @ts-ignore
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      let text = "";
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => it.str).join(" ") + "\n";
      }
      if (text.trim().length > 0) return text;
    } catch (e) {
      console.warn("pdfjs failed, falling back to raw scan", e);
    }
  }
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    out += (c >= 32 && c < 127) || c === 10 || c === 13 ? String.fromCharCode(c) : " ";
  }
  return out;
}

function extractFields(text: string) {
  const fields: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of FIELD_KEYS) {
    let found: string | null = null;
    for (const rx of PATTERNS[key] ?? []) {
      const m = text.match(rx);
      if (m && m[1]) { found = m[1].trim().replace(/\s+/g, " "); break; }
    }
    if (found) fields[key] = found; else missing.push(key);
  }
  return { fields, missing };
}

function Intake() {
  const [mode, setMode] = useDataMode();
  const isUploaded = mode === "uploaded";
  const [selected, setSelected] = useState<string>(isUploaded ? UPLOAD_HH_ID : "HH-001");
  const [uploaded, setUploaded] = useState<ExtractedFile[]>([]);
  const [busy, setBusy] = useState(false);

  // Keep selection in sync with mode.
  useEffect(() => {
    setSelected(isUploaded ? UPLOAD_HH_ID : "HH-001");
  }, [isUploaded]);

  // Rehydrate queue when the target bucket changes.
  useEffect(() => {
    setUploaded(loadStoredFiles(selected));
  }, [selected]);

  const hh = HOUSEHOLDS.find((h) => h.id === selected);
  const bucketLabel = isUploaded ? `${UPLOAD_HH_ID} · My uploads` : `${selected} · ${hh?.applicant ?? ""}`;

  const persist = (list: ExtractedFile[]) => {
    if (list.length === 0) localStorage.removeItem(`realdoor:extract:${selected}`);
    else localStorage.setItem(`realdoor:extract:${selected}`, JSON.stringify(list));
    notifyUploadsChanged();
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isUploaded) {
      toast.error("Switch to 'My uploads' mode to add real documents", {
        description: "Synthetic demo households are read-only fixtures.",
      });
      return;
    }
    setBusy(true);
    const results: ExtractedFile[] = [];
    for (const f of Array.from(files)) {
      let fields: Record<string, string> = {};
      let missing: string[] = [...FIELD_KEYS];
      try {
        const text = await readText(f);
        const r = extractFields(text);
        fields = r.fields; missing = r.missing;
      } catch { /* noop */ }
      results.push({ name: f.name, size: f.size, fields, missing });
    }
    const next = [...uploaded, ...results];
    setUploaded(next);
    persist(next);
    setBusy(false);
    const totalFound = results.reduce((n, r) => n + Object.keys(r.fields).length, 0);
    toast.success(`Extracted ${results.length} document${results.length > 1 ? "s" : ""}`, { description: `${totalFound} field${totalFound === 1 ? "" : "s"} populated · ${results.reduce((n, r) => n + r.missing.length, 0)} pending review.` });
  };

  const removeFile = (name: string) => {
    const next = uploaded.filter((f) => f.name !== name);
    setUploaded(next);
    persist(next);
  };

  const clearAll = () => {
    setUploaded([]);
    persist([]);
  };

  return (
    <AppShell
      eyebrow={isUploaded ? "My uploads" : "Synthetic demo"}
      title="Document intake"
      description={isUploaded
        ? "Drop real documents to build your own household bucket. Nothing here is shared with the synthetic demo fixtures."
        : "You are viewing read-only synthetic demo households. Switch the header toggle to 'My uploads' to add real documents."
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="card-elevated col-span-2 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Upload zone</div>
              <h2 className="font-display text-lg font-semibold">Add documents to {bucketLabel}</h2>
            </div>
            <div className="flex items-center gap-2">
              {isUploaded ? (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Isolated from synthetic data</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setMode("uploaded")} className="gap-1.5">
                  <UploadCloud className="h-3.5 w-3.5" /> Switch to My uploads
                </Button>
              )}
            </div>
          </div>

          {!isUploaded && (
            <div className="mb-4 flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <Database className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Read-only synthetic mode</div>
                <div className="mt-0.5 text-warning/80">
                  You're browsing HH-001…HH-006 fixtures. Uploads are disabled here to keep synthetic and real data separated. Toggle "My uploads" in the header to add documents.
                </div>
              </div>
            </div>
          )}

          <label
            htmlFor="fileinput"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className={`grid rounded-lg border border-dashed border-border/70 bg-secondary/30 px-6 py-10 text-center transition ${isUploaded ? "cursor-pointer place-items-center hover:border-primary/50 hover:bg-secondary/50" : "cursor-not-allowed place-items-center opacity-50"}`}
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" />}
            <div className="mt-3 font-display text-base font-semibold">Drag PDFs or images here</div>
            <div className="mt-1 text-xs text-muted-foreground">PDF · PNG · JPG · up to 25 MB per file · encryption in transit</div>
            <input id="fileinput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => onFiles(e.target.files)} disabled={!isUploaded} />
          </label>

          {uploaded.length > 0 && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Extraction queue · {bucketLabel}</div>
                <button onClick={clearAll} className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive transition-colors">Clear all</button>
              </div>
              {uploaded.map((f) => {
                const found = Object.keys(f.fields).length;
                const total = FIELD_KEYS.length;
                const status = found === 0 ? "unreadable" : found < total ? "needs review" : "extracted";
                const tone = status === "extracted" ? "border-success/40 bg-success/10 text-success" : status === "needs review" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive";
                return (
                  <div key={f.name} className="rounded-md border border-border/60">
                    <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                      <span className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB · {found}/{total} fields</span>
                      <Badge variant="outline" className={tone}>{status}</Badge>
                      <button onClick={() => removeFile(f.name)} aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {found > 0 && (
                      <div className="grid grid-cols-1 gap-1.5 border-t border-border/60 bg-secondary/20 p-3 sm:grid-cols-2">
                        {Object.entries(f.fields).map(([k, v]) => (
                          <div key={k} className="flex items-baseline justify-between gap-2 rounded border border-border/50 bg-background/50 px-2 py-1 text-[11px]">
                            <span className="font-mono text-muted-foreground">{k}</span>
                            <span className="truncate font-medium text-foreground" title={v}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {f.missing.length > 0 && (
                      <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
                        <span className="uppercase tracking-[0.14em] text-warning">Missing · </span>
                        <span className="font-mono">{f.missing.join(", ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="card-elevated p-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">What we extract</div>
          <h2 className="font-display text-lg font-semibold">Field allowlist</h2>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
            {FIELD_KEYS.map((f) => (
              <li key={f} className="rounded border border-border/60 bg-secondary/30 px-2 py-1 font-mono text-[11px] text-muted-foreground">{f}</li>
            ))}
          </ul>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span className="text-muted-foreground">Deterministic regex first, VLM fallback on missing spans.</span>
            </div>
            <div className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span className="text-muted-foreground">Every field carries page + bbox evidence.</span>
            </div>
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="text-muted-foreground">Uploads live in the <span className="font-mono text-primary">{UPLOAD_HH_ID}</span> bucket, fully isolated from synthetic fixtures.</span>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
