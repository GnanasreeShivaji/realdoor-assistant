import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HOUSEHOLDS } from "@/lib/mock-data";
import { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/intake")({
  head: () => ({ meta: [{ title: "Document Intake · RealDoor" }, { name: "description", content: "Upload household documents; deterministic extraction with human-in-the-loop review." }] }),
  component: Intake,
});

function Intake() {
  const [selected, setSelected] = useState<string>("HH-001");
  const [uploaded, setUploaded] = useState<{ name: string; size: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const hh = HOUSEHOLDS.find((h) => h.id === selected)!;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    await new Promise((r) => setTimeout(r, 900));
    setUploaded((u) => [...u, ...added]);
    setBusy(false);
    toast.success(`Extracted ${added.length} document${added.length > 1 ? "s" : ""}`, { description: "Fields staged for review on the profile page." });
  };

  const stageSynthetic = () => {
    const list = hh.documents.map((d) => ({ name: d.fileName, size: d.pages * 42_000 }));
    setUploaded(list);
    toast.success(`Staged ${hh.id}`, { description: `${list.length} synthetic documents ready for extraction.` });
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
            <div className="mt-5">
              <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Extraction queue</div>
              <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                {uploaded.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                    <span className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <Badge variant="outline" className="border-success/40 bg-success/10 text-success">Extracted</Badge>
                  </li>
                ))}
              </ul>
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
