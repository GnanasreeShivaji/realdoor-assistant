import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { annualize, threshold60, readiness, completenessBreakdown } from "@/lib/mock-data";
import { useDataMode, getEffectiveHouseholds, loadStoredFiles } from "@/lib/data-mode";
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, FileText, UploadCloud, CheckCircle2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";


export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Applicant Profile · RealDoor" }, { name: "description", content: "Confirm extracted fields with source evidence before packet generation." }] }),
  component: Profile,
});

function Profile() {
  const [mode] = useDataMode();
  const households = getEffectiveHouseholds(mode);
  const isUploaded = mode === "uploaded";

  const [selected, setSelected] = useState(households[0]?.id ?? "");
  useEffect(() => {
    // Reset selection when mode / households list changes.
    setSelected(households[0]?.id ?? "");
  }, [mode, households.length]);

  const hh = households.find((h) => h.id === selected);

  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!hh) return;
    setConfirmed(localStorage.getItem(`realdoor:confirmed:${hh.id}`) === "1");
  }, [hh?.id]);
  const doConfirm = () => {
    if (!hh) return;
    localStorage.setItem(`realdoor:confirmed:${hh.id}`, "1");
    setConfirmed(true);
    toast.success("All fields confirmed", { description: `${hh.id} · ${hh.applicant} is locked for packet compile.` });
  };


  const stored = useMemo(() => (hh ? loadStoredFiles(hh.id) : []), [hh?.id, mode]);
  const merged = useMemo(() => {
    const m: Record<string, { value: string; source: string; confidence: number }> = {};
    for (const f of stored) {
      for (const [k, v] of Object.entries(f.fields)) {
        if (!m[k]) m[k] = { value: v, source: `${f.name} · uploaded`, confidence: 0.95 };
      }
    }
    return m;
  }, [stored]);

  if (!hh) {
    return (
      <AppShell
        eyebrow="My uploads"
        title="Applicant profile"
        description="This workspace shows only households built from your uploaded documents."
      >
        <EmptyUploads />
      </AppShell>
    );
  }

  const pick = (k: string, fallback: { value: string; source: string; confidence: number }) => merged[k] ?? fallback;

  // In uploaded mode we hide synthetic fallbacks entirely — empty fields stay empty.
  const emptyFallback = (label: string) => ({ value: "—", source: label, confidence: 0 });

  const grossFallback = isUploaded
    ? emptyFallback("awaiting upload")
    : { value: `$${hh.grossPerPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, source: "pay_stub.pdf · p.1", confidence: 0.96 };
  const grossStr = pick("gross_pay", grossFallback);
  const grossNum = Number(String(grossStr.value).replace(/[^0-9.]/g, "")) || hh.grossPerPeriod;

  const freqFallback = isUploaded ? emptyFallback("awaiting upload") : { value: hh.frequency, source: "pay_stub.pdf · p.1", confidence: 0.92 };
  const freq = pick("pay_frequency", freqFallback);
  const FREQ_NORMALIZE: Record<string, "weekly" | "biweekly" | "semimonthly" | "monthly"> = {
    weekly: "weekly", biweekly: "biweekly", biweeekly: "biweekly", bimonthly: "biweekly",
    semimonthly: "semimonthly", semi: "semimonthly", monthly: "monthly",
  };
  const freqKey = String(freq.value ?? "").toLowerCase().replace(/[-\s_]/g, "");
  const normalizedFreq = FREQ_NORMALIZE[freqKey] ?? hh.frequency;
  const a = annualize(grossNum, normalizedFreq);

  const sizeFallback = isUploaded ? emptyFallback("awaiting upload") : { value: String(hh.size), source: "application_summary.pdf · p.1", confidence: 0.97 };
  const sizeStr = pick("household_size", sizeFallback);
  const size = Number(sizeStr.value) || hh.size;
  const t = threshold60(size);

  const nameFallback = isUploaded ? emptyFallback("awaiting upload") : { value: hh.applicant, source: "application_summary.pdf · p.1", confidence: 0.98 };
  const addrFallback = isUploaded ? emptyFallback("awaiting upload") : { value: hh.address, source: "application_summary.pdf · p.1", confidence: 0.94 };
  const emplFallback = isUploaded ? emptyFallback("not found in uploads") : { value: hh.employer, source: "employment_letter.pdf · p.1", confidence: 0.93 };

  const fields = [
    { name: "person_name", ...pick("person_name", nameFallback) },
    { name: "household_size", ...sizeStr },
    { name: "address", ...pick("address", addrFallback) },
    { name: "employer_name", ...pick("employer_name", emplFallback) },
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
      eyebrow={isUploaded ? "My uploads · Step 2" : "Synthetic demo · Step 2"}
      title="Applicant profile"
      description="Review each extracted field alongside its source. Confirmed values are recorded to the packet audit log."
      actions={<>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          {households.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.applicant}</option>)}
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
            <Badge variant="outline" className={isUploaded ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-secondary/40 text-muted-foreground"}>
              {isUploaded ? `${stored.length} uploaded doc${stored.length === 1 ? "" : "s"}` : "synthetic fixture"}
            </Badge>
          </div>
          <div className="divide-y divide-border/60">
            {fields.map((f) => (
              <div key={f.name} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 text-sm">
                <div className="col-span-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{f.name}</div>
                <div className={`col-span-4 truncate font-medium ${f.value === "—" ? "text-muted-foreground" : ""}`}>{f.value}</div>
                <div className="col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="truncate">{f.source}</span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  {f.fromUpload && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary h-5 px-1.5 py-0 text-[10px]">from upload</Badge>
                  )}
                  <Badge variant="outline" className={`border h-5 px-1.5 py-0 text-[10px] ${f.confidence >= 0.9 ? "border-success/40 bg-success/10 text-success" : f.confidence > 0 ? "border-warning/40 bg-warning/10 text-warning" : "border-border/60 bg-secondary/40 text-muted-foreground"}`}>
                    {f.confidence > 0 ? `${Math.round(f.confidence * 100)}%` : "—"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 bg-secondary/30 px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {confirmed ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> <span className="text-success">Confirmed &amp; locked for packet compile</span></>
              ) : (
                <span>{fields.filter((f) => f.confidence >= 0.9).length} of {fields.length} auto-confirmed</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={confirmed}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit field</Button>
              <Button size="sm" onClick={doConfirm} disabled={confirmed}>
                <Check className="mr-1.5 h-3.5 w-3.5" /> {confirmed ? "Confirmed" : "Confirm all"}
              </Button>
            </div>
          </div>
        </Card>


        <div className="space-y-4">
          <CompletenessCard hh={hh} />
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

function CompletenessCard({ hh }: { hh: ReturnType<typeof getEffectiveHouseholds>[number] }) {
  const r = readiness(hh);
  const { present, missing, total } = completenessBreakdown(hh);
  const tone = "var(--success)";
  const data = [
    { name: "Captured", value: present.length },
    { name: "Missing", value: missing.length },
  ];
  return (
    <Card className="card-elevated p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Applicant readiness</div>
      <h2 className="font-display text-lg font-semibold">Document completeness</h2>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                cursor={false}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: "var(--popover-foreground)" }}
                formatter={(v: number, n: string) => [`${v} of ${total}`, n]}
              />
              <Pie data={data} innerRadius={28} outerRadius={44} paddingAngle={2} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                <Cell fill={tone} name="Captured" />
                <Cell fill="var(--destructive)" fillOpacity={0.35} name="Missing" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-sm font-semibold">{r.score}%</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted-foreground">{present.length} / {total} required document types</div>
          <div className="mt-1 text-sm font-medium">{r.status}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-xs">
        {present.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-success/15 text-success ring-1 ring-success/25">✓</span>
            <span className="text-foreground/90">{p}</span>
          </li>
        ))}
        {missing.map((m) => (
          <li key={m} className="flex items-center gap-2">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-destructive/15 text-destructive ring-1 ring-destructive/25">✗</span>
            <span className="text-destructive">{m} — missing</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyUploads() {
  return (
    <Card className="card-elevated p-10 text-center">
      <UploadCloud className="mx-auto h-10 w-10 text-primary" />
      <h3 className="mt-3 font-display text-xl font-semibold">No uploaded households yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        You're in <span className="font-mono text-primary">My uploads</span> mode — synthetic fixtures are hidden here. Add real documents on the intake page to build your bucket.
      </p>
      <Link to="/intake"><Button className="mt-5 gap-1.5"><UploadCloud className="h-4 w-4" /> Go to intake</Button></Link>
    </Card>
  );
}
