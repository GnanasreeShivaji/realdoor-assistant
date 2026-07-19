import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HOUSEHOLDS, annualize, threshold60 } from "@/lib/mock-data";
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, FileText } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Applicant Profile · RealDoor" }, { name: "description", content: "Confirm extracted fields with source evidence before packet generation." }] }),
  component: Profile,
});

type StoredFile = { name: string; size: number; fields: Record<string, string>; missing: string[] };

function loadExtracted(hhId: string): StoredFile[] {
  try {
    const raw = localStorage.getItem(`realdoor:extract:${hhId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function Profile() {
  const [selected, setSelected] = useState("HH-001");
  const [stored, setStored] = useState<StoredFile[]>([]);
  useEffect(() => { setStored(loadExtracted(selected)); }, [selected]);

  const hh = HOUSEHOLDS.find((h) => h.id === selected)!;

  // Merge: uploaded fields take priority; fall back to mock household when absent.
  const merged = useMemo(() => {
    const m: Record<string, { value: string; source: string; confidence: number }> = {};
    for (const f of stored) {
      for (const [k, v] of Object.entries(f.fields)) {
        if (!m[k]) m[k] = { value: v, source: `${f.name} · uploaded`, confidence: 0.95 };
      }
    }
    return m;
  }, [stored]);

  const hasUpload = stored.length > 0;
  const pick = (k: string, fallback: { value: string; source: string; confidence: number }) => merged[k] ?? fallback;


  const grossStr = pick("gross_pay", { value: `$${hh.grossPerPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, source: "pay_stub.pdf · p.1", confidence: 0.96 });
  const grossNum = Number(String(grossStr.value).replace(/[^0-9.]/g, "")) || hh.grossPerPeriod;
  const freq = pick("pay_frequency", { value: hh.frequency, source: "pay_stub.pdf · p.1", confidence: 0.92 });
  const a = annualize(grossNum, freq.value as any);
  const sizeStr = pick("household_size", { value: String(hh.size), source: "application_summary.pdf · p.1", confidence: 0.97 });
  const size = Number(sizeStr.value) || hh.size;
  const t = threshold60(size);

  const fields = [
    { name: "person_name", ...pick("person_name", { value: hh.applicant, source: "application_summary.pdf · p.1", confidence: 0.98 }) },
    { name: "household_size", ...sizeStr },
    { name: "address", ...pick("address", { value: hh.address, source: "application_summary.pdf · p.1", confidence: 0.94 }) },
    { name: "employer_name", ...pick("employer_name", { value: hh.employer, source: "employment_letter.pdf · p.1", confidence: 0.93 }) },
    { name: "pay_frequency", ...freq },
    { name: "gross_pay", ...grossStr },
    ...(merged["pay_date"] ? [{ name: "pay_date", ...merged["pay_date"] }] : []),
    ...(merged["hourly_rate"] ? [{ name: "hourly_rate", ...merged["hourly_rate"] }] : []),
    ...(merged["employment_start_date"] ? [{ name: "employment_start_date", ...merged["employment_start_date"] }] : []),
    ...(merged["benefit_amount"] ? [{ name: "benefit_amount", ...merged["benefit_amount"] }] : []),
    ...(merged["pay_period_start"] ? [{ name: "pay_period_start", ...merged["pay_period_start"] }] : []),
    ...(merged["pay_period_end"] ? [{ name: "pay_period_end", ...merged["pay_period_end"] }] : []),
  ].map((f) => ({ ...f, fromUpload: !!merged[f.name] }));

  return (
    <AppShell
      eyebrow="Step 2"
      title="Applicant profile"
      description="Review each extracted field alongside its source. Confirmed values are recorded to the packet audit log."
      actions={<>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          {HOUSEHOLDS.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.applicant}</option>)}
        </select>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="card-elevated col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Extracted fields</div>
              <h2 className="font-display text-lg font-semibold">{hh.id} · {hh.applicant}</h2>
            </div>
            <Badge variant="outline" className={hasUpload ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-secondary/40 text-muted-foreground"}>
              {hasUpload ? `${stored.length} uploaded doc${stored.length > 1 ? "s" : ""}` : "synthetic fixture"}
            </Badge>
          </div>
          <div className="divide-y divide-border/60">
            {fields.map((f) => (
              <div key={f.name} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 text-sm">
                <div className="col-span-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{f.name}</div>
                <div className="col-span-4 truncate font-medium">{f.value}</div>
                <div className="col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="truncate">{f.source}</span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  {f.fromUpload && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary h-5 px-1.5 py-0 text-[10px]">from upload</Badge>
                  )}
                  <Badge variant="outline" className={`border h-5 px-1.5 py-0 text-[10px] ${f.confidence >= 0.9 ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
                    {Math.round(f.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 bg-secondary/30 px-5 py-3">
            <div className="text-xs text-muted-foreground">{fields.filter((f) => f.confidence >= 0.9).length} of {fields.length} auto-confirmed</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit field</Button>
              <Button size="sm"><Check className="mr-1.5 h-3.5 w-3.5" /> Confirm all</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="card-elevated p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Calculation ledger</div>
            <h2 className="font-display text-lg font-semibold">Annualized reference</h2>
            <div className="mt-3 font-mono text-xs text-muted-foreground">{a.formula}</div>
            <div className="mt-1 font-display text-3xl font-semibold">${a.annual.toLocaleString()}</div>
            <div className="mt-4 rounded-md border border-border/60 bg-secondary/40 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">60% frozen threshold · HH size {hh.size}</div>
              <div className="mt-1 font-mono text-lg">${t.toLocaleString()}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Source: HUD-MTSP-002, PDF page 130</div>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">Comparison shown for context only — never an eligibility decision.</div>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}
