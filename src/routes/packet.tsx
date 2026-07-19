import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HOUSEHOLDS, readiness } from "@/lib/mock-data";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Download, FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/packet")({
  head: () => ({ meta: [{ title: "Application Packet · RealDoor" }, { name: "description", content: "Assemble a reviewer-safe packet: extracted fields, source references, checklist, and audit log." }] }),
  component: Packet,
});

function Packet() {
  const [selected, setSelected] = useState("HH-001");
  const hh = HOUSEHOLDS.find((h) => h.id === selected)!;
  const r = readiness(hh);

  const items = [
    { label: "Application summary", status: hh.documents.some((d) => d.documentType === "application_summary") ? "complete" : "missing" },
    { label: "Pay stub (recent)", status: hh.documents.filter((d) => d.documentType === "pay_stub").length >= 2 ? "complete" : "missing" },
    { label: "Employment or benefit verification", status: hh.documents.some((d) => ["employment_letter", "benefit_letter", "gig_statement"].includes(d.documentType)) ? "complete" : "missing" },
    ...hh.reviewReasons.map((reason) => ({ label: reason.replaceAll("_", " ").toLowerCase(), status: "review" as const })),
  ];

  const generate = () => toast.success(`Packet generated for ${hh.id}`, { description: "PDF + JSON prepared for reviewer download." });

  return (
    <AppShell
      eyebrow="Step 4"
      title="Application packet"
      description="Resolve outstanding items, then compile a structured, evidence-preserving packet for the reviewing housing specialist."
      actions={<>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          {HOUSEHOLDS.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.applicant}</option>)}
        </select>
        <Button size="sm" onClick={generate}><FileDown className="mr-1.5 h-4 w-4" /> Generate packet</Button>
      </>}
    >
      <Card className="card-elevated relative overflow-hidden p-6">
        <div className="absolute inset-0 grid-lines opacity-40" aria-hidden />
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Document readiness</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-display text-6xl font-semibold tracking-tight text-gradient">{r.score}%</span>
              <StatusChip status={r.status} />
            </div>
            <Progress value={r.score} className="mt-4 h-2" />
            <p className="mt-3 text-xs text-muted-foreground">Document completeness only. This score does not indicate eligibility.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <Stat label="Present" value={r.present} tone="success" />
            <Stat label="Missing" value={r.missing} tone="destructive" />
            <Stat label="Review" value={r.review} tone="warning" />
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="card-elevated col-span-2 p-0 overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Reviewer checklist</div>
            <h2 className="font-display text-lg font-semibold">Required evidence</h2>
          </div>
          <ul className="divide-y divide-border/60">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3.5">
                {item.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-success" /> : item.status === "review" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <span className="flex-1 text-sm capitalize">{item.label}</span>
                <Badge variant="outline" className={`h-5 px-1.5 py-0 text-[10px] ${item.status === "complete" ? "border-success/40 bg-success/10 text-success" : item.status === "review" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{item.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="card-elevated p-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Downloads</div>
          <h2 className="font-display text-lg font-semibold">Packet artifacts</h2>
          <div className="mt-4 space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={generate}><Download className="mr-2 h-4 w-4" /> Reviewer PDF</Button>
            <Button variant="outline" className="w-full justify-start" onClick={generate}><Download className="mr-2 h-4 w-4" /> Machine JSON</Button>
            <Button variant="outline" className="w-full justify-start" onClick={generate}><Download className="mr-2 h-4 w-4" /> Audit trail (JSONL)</Button>
          </div>
          <div className="mt-5 rounded-md border border-border/60 bg-secondary/40 p-3 text-[11px] text-muted-foreground">
            Every packet embeds field-level bounding boxes, extraction confidence, rule citations, and a boundary statement that no eligibility determination has been made.
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "destructive" | "warning" }) {
  const c = { success: "text-success", destructive: "text-destructive", warning: "text-warning" }[tone];
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-4xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = status === "READY FOR REVIEW" ? "border-success/40 bg-success/10 text-success" : status === "NEEDS REVIEW" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive";
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${tone}`}>{status}</span>;
}
