import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Audit History · RealDoor" }, { name: "description", content: "Immutable event log of intake, extraction, rule lookups, and packet decisions." }] }),
  component: History,
});

type Ev = { ts: string; kind: string; actor: string; detail: string; tone: "success" | "warning" | "destructive" | "primary" | "muted" };

const EVENTS: Ev[] = [
  { ts: "2026-07-19 09:42:11", kind: "PACKET_GENERATED", actor: "R. Adams", detail: "HH-005 · READY FOR REVIEW · 12 fields confirmed", tone: "success" },
  { ts: "2026-07-19 09:31:04", kind: "REVIEW_FLAG", actor: "system", detail: "HH-002 employment letter dated 2026-04-11 exceeds 60-day window", tone: "warning" },
  { ts: "2026-07-19 09:14:23", kind: "RULE_LOOKUP", actor: "R. Adams", detail: "\"FY 2026 60% limits\" → HUD-MTSP-002 (98% confidence)", tone: "primary" },
  { ts: "2026-07-19 08:57:52", kind: "CALCULATION", actor: "R. Adams", detail: "HH-004 gig income annualized · $1,120 × 52 = $58,240", tone: "primary" },
  { ts: "2026-07-19 08:56:11", kind: "FIELD_CONFIRMED", actor: "R. Adams", detail: "HH-004 · pay_frequency = weekly (overrode extractor: biweekly)", tone: "primary" },
  { ts: "2026-07-19 08:52:44", kind: "EXTRACTION", actor: "system", detail: "HH-004 · 4 documents · 22 fields · avg confidence 82%", tone: "muted" },
  { ts: "2026-07-19 08:45:03", kind: "UPLOAD", actor: "R. Adams", detail: "HH-004 · 4 files staged from synthetic bundle", tone: "muted" },
  { ts: "2026-07-19 08:40:19", kind: "SESSION_START", actor: "R. Adams", detail: "Session RD-CA97A4F00A · Boston MA HMFA · FY 2026", tone: "muted" },
  { ts: "2026-07-19 08:35:07", kind: "REFUSAL", actor: "system", detail: "Query \"is HH-001 eligible?\" refused per CH-DECISION-001", tone: "destructive" },
];

const KINDS = ["ALL", ...Array.from(new Set(EVENTS.map((e) => e.kind)))];

function History() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("ALL");
  const filtered = EVENTS.filter((e) => (kind === "ALL" || e.kind === kind) && (q === "" || [e.detail, e.actor, e.kind].some((s) => s.toLowerCase().includes(q.toLowerCase()))));

  return (
    <AppShell
      eyebrow="Governance"
      title="Audit history"
      description="Every intake, extraction, rule lookup, and packet decision is recorded with actor, timestamp, and citation. This log is what a housing specialist sees."
    >
      <Card className="card-elevated overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, actors, households…" className="h-9 pl-9" />
          </div>
          <div className="flex flex-wrap gap-1">
            {KINDS.map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition ${kind === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground"}`}>{k}</button>
            ))}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary/60 backdrop-blur">
              <tr className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Timestamp</th>
                <th className="px-3 py-2.5 text-left font-medium">Event</th>
                <th className="px-3 py-2.5 text-left font-medium">Actor</th>
                <th className="px-5 py-2.5 text-left font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((e, i) => {
                const toneClass = { success: "border-success/40 bg-success/10 text-success", warning: "border-warning/40 bg-warning/10 text-warning", destructive: "border-destructive/40 bg-destructive/10 text-destructive", primary: "border-primary/40 bg-primary/10 text-primary", muted: "border-border/60 bg-secondary/40 text-muted-foreground" }[e.tone];
                return (
                  <tr key={i} className="hover:bg-secondary/30">
                    <td className="px-5 py-2.5 font-mono text-[11px] text-muted-foreground">{e.ts}</td>
                    <td className="px-3 py-2.5"><Badge variant="outline" className={`h-5 px-1.5 py-0 font-mono text-[10px] ${toneClass}`}>{e.kind}</Badge></td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">{e.actor}</td>
                    <td className="px-5 py-2.5 text-foreground/90">{e.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground">
          {filtered.length} of {EVENTS.length} events · immutable · exportable as JSONL
        </div>
      </Card>
    </AppShell>
  );
}
