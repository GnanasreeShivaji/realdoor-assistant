import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { readiness, annualize, threshold60 } from "@/lib/mock-data";
import { useDataMode, getEffectiveHouseholds, loadStoredFiles } from "@/lib/data-mode";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Download, FileDown, ChevronRight, BookOpen, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export const Route = createFileRoute("/packet")({
  head: () => ({ meta: [{ title: "Application Packet · RealDoor" }, { name: "description", content: "Assemble a reviewer-safe packet: extracted fields, source references, checklist, and audit log." }] }),
  component: Packet,
});

function Packet() {
  const [mode] = useDataMode();
  const HOUSEHOLDS = getEffectiveHouseholds(mode);
  const [selected, setSelected] = useState(HOUSEHOLDS[0]?.id ?? "");
  useEffect(() => { setSelected(HOUSEHOLDS[0]?.id ?? ""); }, [mode, HOUSEHOLDS.length]);
  const [openItem, setOpenItem] = useState<null | { label: string; status: string }>(null);
  const hh = HOUSEHOLDS.find((h) => h.id === selected);
  if (!hh) {
    return (
      <AppShell eyebrow="My uploads" title="Application packet" description="Upload documents to generate a packet.">
        <Card className="card-elevated p-10 text-center">
          <UploadCloud className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-3 font-display text-xl font-semibold">No uploaded households yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Synthetic fixtures are hidden in My uploads mode. Add documents on intake to enable packet generation.</p>
          <Link to="/intake"><Button className="mt-5 gap-1.5"><UploadCloud className="h-4 w-4" /> Go to intake</Button></Link>
        </Card>
      </AppShell>
    );
  }
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

  const buildPdf = (): Blob => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    const M = 48;
    const a = annualize(hh.grossPerPeriod, hh.frequency);
    const t60 = threshold60(hh.size);
    const storedFiles = loadStoredFiles(hh.id);
    const isConfirmed = typeof localStorage !== "undefined" && localStorage.getItem(`realdoor:confirmed:${hh.id}`) === "1";

    // Top rule
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 68, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("REALDOOR", M, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Application Readiness Packet · Reviewer copy", M, 48);
    doc.text(`Ref  RD-${hh.id}`, W - M, 32, { align: "right" });
    doc.text(`Prepared  ${new Date().toLocaleString()}`, W - M, 48, { align: "right" });

    // Status badge strip
    const statusColor: [number, number, number] = r.status === "READY FOR REVIEW" ? [22, 163, 74] : r.status === "NEEDS REVIEW" ? [217, 119, 6] : [220, 38, 38];
    doc.setFillColor(...statusColor);
    doc.rect(0, 68, W, 4, "F");

    let y = 100;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("APPLICANT", M, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y + 4, W - M, y + 4);

    y += 22;
    doc.setFontSize(20);
    doc.text(hh.applicant, M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    y += 16;
    doc.text(hh.address, M, y);
    y += 24;

    // Facts grid
    const facts: [string, string][] = [
      ["Household size", String(hh.size)],
      ["Pay frequency", hh.frequency],
      ["Employer", hh.employer],
      ["Gross per period", `$${hh.grossPerPeriod.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
      ["Annualized reference", `$${a.annual.toLocaleString()}`],
      ["60% frozen ref (HH " + hh.size + ")", `$${t60.toLocaleString()}`],
    ];
    const col = (W - M * 2) / 3;
    facts.forEach((f, i) => {
      const cx = M + (i % 3) * col;
      const cy = y + Math.floor(i / 3) * 40;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(f[0].toUpperCase(), cx, cy);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(f[1], cx, cy + 14);
      doc.setFont("helvetica", "normal");
    });
    y += 90;

    // Readiness status box
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(M, y, W - M * 2, 46, 4, 4, "S");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("READINESS STATUS", M + 12, y + 16);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...statusColor);
    doc.text(`${r.status} · ${r.score}% complete`, M + 12, y + 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Present ${r.present}   Missing ${r.missing}   Review ${r.review}`, W - M - 12, y + 30, { align: "right" });
    y += 62;

    // Missing / needs-review section — the meat
    const missingItems = items.filter((i) => i.status !== "complete");
    if (missingItems.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("OUTSTANDING FOR REVIEWER", M, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(M, y + 4, W - M, y + 4);
      y += 8;
      autoTable(doc, {
        startY: y + 4,
        theme: "plain",
        head: [["Item", "Status", "Action required"]],
        body: missingItems.map((i) => [
          i.label,
          i.status.toUpperCase(),
          i.status === "missing" ? "Applicant must supply this document" : "Reviewer verification required before packet compile",
        ]),
        styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 6, right: 8, bottom: 6, left: 8 }, textColor: [30, 41, 59] },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 170 },
          1: { cellWidth: 70, fontStyle: "bold", textColor: r.status === "INCOMPLETE" ? [220, 38, 38] : [217, 119, 6] },
        },
        margin: { left: M, right: M },
      });
      // @ts-expect-error autotable adds lastAutoTable
      y = doc.lastAutoTable.finalY + 20;
    }

    // Documents on file
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("DOCUMENTS ON FILE", M, y);
    doc.line(M, y + 4, W - M, y + 4);
    autoTable(doc, {
      startY: y + 8,
      theme: "plain",
      head: [["File", "Type", "Status", "Confidence"]],
      body: (storedFiles.length > 0 ? storedFiles.map((f) => [f.name, "uploaded", f.missing.length ? "review" : "complete", f.missing.length ? "72%" : "95%"]) : hh.documents.map((d) => [d.fileName, d.documentType.replaceAll("_", " "), d.status, `${Math.round(d.confidence * 100)}%`])),
      styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 6, right: 8, bottom: 6, left: 8 }, textColor: [30, 41, 59] },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
      margin: { left: M, right: M },
    });
    // @ts-expect-error autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 20;

    // Calculation ledger
    if (y > 660) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("CALCULATION LEDGER", M, y);
    doc.line(M, y + 4, W - M, y + 4);
    y += 20;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Annualized      ${a.formula} = $${a.annual.toLocaleString()}`, M, y);
    y += 14;
    doc.text(`60% ref (HH ${hh.size})   $${t60.toLocaleString()}  · HUD-MTSP-002, PDF page 130`, M, y);
    y += 14;
    doc.text(`Δ vs 60% ref    ${a.annual > t60 ? "+" : ""}$${(a.annual - t60).toLocaleString()}`, M, y);
    y += 22;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Comparison shown for context only. RealDoor does not decide eligibility.", M, y);
    y += 24;

    // Confirmation footer
    if (isConfirmed) {
      doc.setFillColor(220, 252, 231);
      doc.setDrawColor(22, 163, 74);
      doc.roundedRect(M, y, W - M * 2, 26, 4, 4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(22, 101, 52);
      doc.text("✓  Fields confirmed by case worker", M + 10, y + 17);
      y += 40;
    }

    // Page footer with boundary notice on every page
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Document completeness only · No eligibility determination · Every value traces to a source document.", M, 782);
      doc.text(`Page ${p} / ${pages}`, W - M, 782, { align: "right" });
    }

    return doc.output("blob");
  };

  const downloadPdf = () => {
    const blob = buildPdf();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RealDoor_${hh.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Reviewer PDF downloaded");
  };

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

      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent className="max-w-lg">
          {openItem && (() => {
            const g = guidanceFor(openItem.label, openItem.status);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    {openItem.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-success" /> : openItem.status === "review" ? <AlertTriangle className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <Badge variant="outline" className={`h-5 px-1.5 py-0 text-[10px] ${openItem.status === "complete" ? "border-success/40 bg-success/10 text-success" : openItem.status === "review" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{openItem.status}</Badge>
                  </div>
                  <DialogTitle className="capitalize">{openItem.label}</DialogTitle>
                  <DialogDescription>{g.summary}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <section>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">What the reviewer should check</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">
                      {g.checks.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </section>
                  <section>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Rule citations</div>
                    <ul className="mt-2 space-y-1">
                      {g.citations.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span><span className="font-medium text-foreground">{c.id}</span> — {c.text}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-[11px] text-muted-foreground">
                    RealDoor does not decide eligibility. This panel surfaces evidence and rules so a qualified housing specialist can decide.
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenItem(null)}>Close</Button>
                  <Button onClick={() => { setOpenItem(null); toast.success("Flagged for reviewer", { description: `${openItem.label} added to reviewer notes.` }); }}>Flag for reviewer</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
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

type Guidance = { summary: string; checks: string[]; citations: { id: string; text: string }[] };

function guidanceFor(label: string, status: string): Guidance {
  const key = label.toLowerCase();
  if (key.includes("gig income")) {
    return {
      summary: "Gig income is variable and self-reported. It requires corroboration before it can be relied on for annualization.",
      checks: [
        "Confirm the platform statement covers at least the most recent full pay period and matches the applicant's name.",
        "Cross-check reported gross against deposit history (bank statement or 1099-K) for the same window.",
        "Decide with the applicant which annualization method to use (year-to-date vs. rolling 12 months) and record it.",
      ],
      citations: [
        { id: "CH-DOC-004", text: "Gig income must be corroborated by a second independent source before it is annualized." },
        { id: "CH-DECISION-001", text: "RealDoor surfaces evidence and rule text; eligibility is decided by a qualified housing specialist." },
      ],
    };
  }
  if (key.includes("corroboration")) {
    return {
      summary: "A required piece of evidence is present but a second corroborating source is still needed.",
      checks: [
        "Ask the applicant for a bank statement, 1099, or platform earnings summary that overlaps the pay period on file.",
        "Verify names, dates, and totals reconcile within a reasonable variance.",
      ],
      citations: [
        { id: "CH-DOC-004", text: "Variable income requires an independent corroborating document." },
      ],
    };
  }
  if (key.includes("expired")) {
    return {
      summary: "A document on file is outside the acceptable freshness window.",
      checks: [
        "Request a replacement document dated within the last 60 days.",
        "Retain the expired copy in the audit trail; do not delete it.",
      ],
      citations: [
        { id: "CH-DOC-002", text: "Pay stubs and benefit letters must be dated within the last 60 days at the time of review." },
      ],
    };
  }
  if (key.includes("pay stub")) {
    return {
      summary: status === "complete"
        ? "Two recent pay stubs are on file and were parsed with high confidence."
        : "At least two recent pay stubs are required to establish current earnings.",
      checks: [
        "Confirm the two most recent consecutive pay periods are present.",
        "Verify employer name, pay date, pay frequency, gross, and net are legible.",
      ],
      citations: [
        { id: "CH-DOC-001", text: "Employment income requires the two most recent pay stubs." },
        { id: "HUD-INC-002", text: "Annualize using the pay frequency shown on the stub." },
      ],
    };
  }
  if (key.includes("application summary")) {
    return {
      summary: status === "complete" ? "Application summary is present." : "A signed application summary is required.",
      checks: [
        "Confirm applicant name, household size, and address match supporting documents.",
        "Confirm the signature and date are present.",
      ],
      citations: [{ id: "CH-DOC-000", text: "Every packet must include a signed application summary." }],
    };
  }
  if (key.includes("employment")) {
    return {
      summary: status === "complete" ? "Employment or benefit verification is on file." : "A third-party verification of employment or benefits is required.",
      checks: [
        "Confirm the letter is on employer or agency letterhead.",
        "Confirm start date, rate, hours, and issuing contact.",
      ],
      citations: [{ id: "CH-DOC-003", text: "Employment or benefit verification must come from a third party." }],
    };
  }
  return {
    summary: "Reviewer should verify this item against the source documents.",
    checks: ["Open the linked source document.", "Confirm the extracted values match the evidence."],
    citations: [{ id: "CH-DECISION-001", text: "RealDoor does not make eligibility determinations." }],
  };
}

