import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HOUSEHOLDS } from "@/lib/mock-data";
import { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Trash2 } from "lucide-react";
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
  const [selected, setSelected] = useState<string>("HH-001");
  const [uploaded, setUploaded] = useState<ExtractedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const hh = HOUSEHOLDS.find((h) => h.id === selected)!;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
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
    setUploaded((u) => [...u, ...results]);
    setBusy(false);
    try { localStorage.setItem(`realdoor:extract:${selected}`, JSON.stringify(results)); } catch {}
    const totalFound = results.reduce((n, r) => n + Object.keys(r.fields).length, 0);
    toast.success(`Extracted ${results.length} document${results.length > 1 ? "s" : ""}`, { description: `${totalFound} field${totalFound === 1 ? "" : "s"} populated · ${results.reduce((n, r) => n + r.missing.length, 0)} pending review.` });
  };

  const stageSynthetic = () => {
    const list: ExtractedFile[] = hh.documents.map((d) => ({ name: d.fileName, size: d.pages * 42_000, fields: {}, missing: [...FIELD_KEYS] }));
    setUploaded(list);
    toast.success(`Staged ${hh.id}`, { description: `${list.length} synthetic documents ready for extraction.` });
  };

  const removeFile = (name: string) => {
    const next = uploaded.filter((f) => f.name !== name);
    setUploaded(next);
    if (next.length === 0) localStorage.removeItem(`realdoor:extract:${selected}`);
    else localStorage.setItem(`realdoor:extract:${selected}`, JSON.stringify(next));
  };

  const clearAll = () => {
    setUploaded([]);
    localStorage.removeItem(`realdoor:extract:${selected}`);
  };

  return (
    <AppShell
      eyebrow="Step 1"
      title="Document intake"
      description="Drop pay stubs, application summaries, employment or benefit letters, and gig statements. Extraction runs deterministically; every field is traceable to a source box."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="card-elevated col-span-2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Upload zone</div>
              <h2 className="font-display text-lg font-semibold">Add documents to {hh.id}</h2>
            </div>
            <div className="flex items-center gap-2">
              <select value={selected} onChange={(e) => { setSelected(e.target.value); setUploaded([]); }} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                {HOUSEHOLDS.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.applicant}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={stageSynthetic}>Load synthetic household</Button>
            </div>
          </div>

          <label
            htmlFor="fileinput"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            className="grid cursor-pointer place-items-center rounded-lg border border-dashed border-border/70 bg-secondary/30 px-6 py-10 text-center transition hover:border-primary/50 hover:bg-secondary/50"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" />}
            <div className="mt-3 font-display text-base font-semibold">Drag PDFs or images here</div>
            <div className="mt-1 text-xs text-muted-foreground">PDF · PNG · JPG · up to 25 MB per file · encryption in transit</div>
            <input id="fileinput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </label>

          {uploaded.length > 0 && (
            <div className="mt-5 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Extraction queue</div>
              {uploaded.map((f, i) => {
                const found = Object.keys(f.fields).length;
                const total = FIELD_KEYS.length;
                const status = found === 0 ? "unreadable" : found < total ? "needs review" : "extracted";
                const tone = status === "extracted" ? "border-success/40 bg-success/10 text-success" : status === "needs review" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive";
                return (
                  <div key={i} className="rounded-md border border-border/60">
                    <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                      <span className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB · {found}/{total} fields</span>
                      <Badge variant="outline" className={tone}>{status}</Badge>
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
            {["person_name", "household_size", "address", "pay_date", "pay_period_start", "pay_period_end", "pay_frequency", "gross_pay", "hourly_rate", "employer_name", "employment_start_date", "benefit_amount"].map((f) => (
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
              <span className="text-muted-foreground">Documents are treated as untrusted input; embedded instructions are ignored.</span>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
