import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { HOUSEHOLDS, readiness } from "@/lib/mock-data";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Download, FileDown, ChevronRight, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/packet")({
  head: () => ({ meta: [{ title: "Application Packet · RealDoor" }, { name: "description", content: "Assemble a reviewer-safe packet: extracted fields, source references, checklist, and audit log." }] }),
  component: Packet,
});

function Packet() {
  const [selected, setSelected] = useState("HH-001");
  const [openItem, setOpenItem] = useState<null | { label: string; status: string }>(null);
  const hh = HOUSEHOLDS.find((h) => h.id === selected)!;
  const r = readiness(hh);

  const items = [
    { label: "Application summary", status: hh.documents.some((d) => d.documentType === "application_summary") ? "complete" : "missing" },
    { label: "Pay stub (recent)", status: hh.documents.filter((d) => d.documentType === "pay_stub").length >= 2 ? "complete" : "missing" },
    { label: "Employment or benefit verification", status: hh.documents.some((d) => ["employment_letter", "benefit_letter", "gig_statement"].includes(d.documentType)) ? "complete" : "missing" },
    ...hh.reviewReasons.map((reason) => ({ label: reason.replaceAll("_", " ").toLowerCase(), status: "review" as const })),
  ];

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildJson = () => JSON.stringify({
    session_id: `RD-${hh.id}`,
    generated_at: new Date().toISOString(),
    decision_boundary: "Document completeness only; no eligibility determination.",
    household: hh,
    readiness: r,
    checklist: items,
  }, null, 2);

  const buildJsonl = () => [
    { ts: new Date().toISOString(), event: "SESSION_OPENED", household: hh.id },
    ...hh.documents.map((d) => ({ ts: new Date().toISOString(), event: "DOCUMENT_INGESTED", file: d.fileName, type: d.documentType, confidence: d.confidence })),
    { ts: new Date().toISOString(), event: "READINESS_COMPUTED", score: r.score, status: r.status },
    { ts: new Date().toISOString(), event: "PACKET_GENERATED", household: hh.id },
  ].map((e) => JSON.stringify(e)).join("\n");

  const buildPdfText = () => {
    const lines = [
      "RealDoor — Application Readiness Packet",
      `Reference: RD-${hh.id}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      "REVIEWER NOTICE: Document completeness only. No eligibility determination.",
      "",
      `Applicant: ${hh.applicant}`,
      `Address: ${hh.address}`,
      `Household size: ${hh.size}`,
      `Employer: ${hh.employer}`,
      "",
      `Readiness: ${r.score}% — ${r.status}`,
      `Present: ${r.present}   Missing: ${r.missing}   Review: ${r.review}`,
      "",
      "Checklist:",
      ...items.map((i) => `  [${i.status.toUpperCase()}] ${i.label}`),
      "",
      "Documents:",
      ...hh.documents.map((d) => `  - ${d.fileName} (${d.documentType}) — ${d.status} @ ${(d.confidence * 100).toFixed(0)}%`),
    ].join("\n");
    // Minimal single-page PDF wrapping the text so the file opens as a real PDF.
    const escaped = lines.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const stream = `BT /F1 10 Tf 40 760 Td 12 TL (${escaped.split("\n").join(") Tj T* (")}) Tj ET`;
    const objs = [
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj",
      `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj`,
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (const o of objs) { offsets.push(pdf.length); pdf += o + "\n"; }
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
    pdf += `trailer<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
  };

  const downloadPdf = () => { triggerDownload(`RealDoor_${hh.id}.pdf`, buildPdfText(), "application/pdf"); toast.success("Reviewer PDF downloaded"); };
  const downloadJson = () => { triggerDownload(`RealDoor_${hh.id}.json`, buildJson(), "application/json"); toast.success("Machine JSON downloaded"); };
  const downloadJsonl = () => { triggerDownload(`RealDoor_${hh.id}_audit.jsonl`, buildJsonl(), "application/x-ndjson"); toast.success("Audit trail downloaded"); };
  const generate = () => { downloadPdf(); downloadJson(); downloadJsonl(); };

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
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpenItem(item)}
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary/40 focus:outline-none focus:bg-secondary/50"
                >
                  {item.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-success" /> : item.status === "review" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="flex-1 text-sm capitalize">{item.label}</span>
                  <Badge variant="outline" className={`h-5 px-1.5 py-0 text-[10px] ${item.status === "complete" ? "border-success/40 bg-success/10 text-success" : item.status === "review" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{item.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="card-elevated p-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Downloads</div>
          <h2 className="font-display text-lg font-semibold">Packet artifacts</h2>
          <div className="mt-4 space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" /> Reviewer PDF</Button>
            <Button variant="outline" className="w-full justify-start" onClick={downloadJson}><Download className="mr-2 h-4 w-4" /> Machine JSON</Button>
            <Button variant="outline" className="w-full justify-start" onClick={downloadJsonl}><Download className="mr-2 h-4 w-4" /> Audit trail (JSONL)</Button>
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
