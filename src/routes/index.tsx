import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HOUSEHOLDS, readiness, annualize, threshold60 } from "@/lib/mock-data";
import { ArrowUpRight, CheckCircle2, FileWarning, Clock3, TrendingUp, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const totals = HOUSEHOLDS.map((h) => ({ h, r: readiness(h) }));
  const ready = totals.filter((t) => t.r.status === "READY FOR REVIEW").length;
  const needsReview = totals.filter((t) => t.r.status === "NEEDS REVIEW").length;
  const incomplete = totals.filter((t) => t.r.status === "INCOMPLETE").length;
  const avgScore = Math.round(totals.reduce((s, t) => s + t.r.score, 0) / totals.length);

  return (
    <AppShell
      eyebrow="Case worker workspace"
      title="Application readiness overview"
      description="Track document completeness across active households. This dashboard summarizes evidence, never eligibility."
      actions={
        <>
          <Link to="/intake"><Button variant="outline" size="sm">Upload documents</Button></Link>
          <Link to="/rules"><Button size="sm" className="gap-1.5">Rule lookup <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Ready for review" value={String(ready)} sub={`${HOUSEHOLDS.length} active households`} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiTile label="Needs review" value={String(needsReview)} sub="Reviewer attention" tone="warning" icon={<FileWarning className="h-4 w-4" />} />
        <KpiTile label="Incomplete" value={String(incomplete)} sub="Awaiting documents" tone="destructive" icon={<Clock3 className="h-4 w-4" />} />
        <KpiTile label="Avg completeness" value={`${avgScore}%`} sub="Across active portfolio" tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="card-elevated col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Active households</div>
              <h2 className="font-display text-lg font-semibold">Case queue</h2>
            </div>
            <Link to="/profile" className="text-xs text-primary hover:underline">Open profile view →</Link>
          </div>
          <div className="divide-y divide-border/60">
            {totals.map(({ h, r }) => {
              const a = annualize(h.grossPerPeriod, h.frequency);
              const t = threshold60(h.size);
              return (
                <Link key={h.id} to="/profile" className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-secondary/40">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 font-mono text-xs font-medium text-primary ring-1 ring-primary/25">
                    {h.id.split("-")[1]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium">{h.applicant}</div>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      HH size {h.size} · {h.employer} · Annualized ${a.annual.toLocaleString()} / 60% ref ${t.toLocaleString()}
                    </div>
                  </div>
                  <div className="hidden w-40 sm:block">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Completeness</span><span className="font-mono">{r.score}%</span>
                    </div>
                    <Progress value={r.score} className="mt-1 h-1.5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="card-elevated p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Reviewer feed</div>
          <h2 className="font-display text-lg font-semibold">Today</h2>
          <ul className="mt-4 space-y-3.5 text-sm">
            <Feed dot="success">HH-005 packet marked complete · 09:42</Feed>
            <Feed dot="warning">HH-002 employment letter flagged expired · 09:31</Feed>
            <Feed dot="primary">Rule lookup: FY 2026 60% limits · 09:14</Feed>
            <Feed dot="destructive">HH-004 gig income requires corroboration · 08:57</Feed>
            <Feed dot="muted">Session started RD-CA97A4F00A · 08:40</Feed>
          </ul>
          <div className="mt-5 rounded-md border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">Boundary reminder</div>
            RealDoor prepares evidence. A qualified housing specialist makes every determination.
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function KpiTile({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone: "success" | "warning" | "destructive" | "primary"; icon: React.ReactNode }) {
  const toneMap = {
    success: "text-success bg-success/10 ring-success/30",
    warning: "text-warning bg-warning/10 ring-warning/30",
    destructive: "text-destructive bg-destructive/10 ring-destructive/30",
    primary: "text-primary bg-primary/10 ring-primary/30",
  }[tone];
  return (
    <Card className="card-elevated p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className={`grid h-7 w-7 place-items-center rounded-md ring-1 ${toneMap}`}>{icon}</div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function Feed({ dot, children }: { dot: "success" | "warning" | "destructive" | "primary" | "muted"; children: React.ReactNode }) {
  const c = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", primary: "bg-primary", muted: "bg-muted-foreground" }[dot];
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c}`} />
      <span className="text-foreground/90">{children}</span>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "READY FOR REVIEW" ? "border-success/40 bg-success/10 text-success" : status === "NEEDS REVIEW" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive";
  return <Badge variant="outline" className={`h-5 border ${tone} px-1.5 py-0 text-[10px] font-medium tracking-wide`}>{status}</Badge>;
}
