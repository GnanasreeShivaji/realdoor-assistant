import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { readiness, annualize, threshold60, completenessBreakdown, type Household } from "@/lib/mock-data";
import { useDataMode, getEffectiveHouseholds } from "@/lib/data-mode";
import { ArrowUpRight, CheckCircle2, FileWarning, Clock3, TrendingUp, ChevronRight, UploadCloud } from "lucide-react";
import { useState } from "react";
import { KpiDrawer, type DrawerBucket } from "@/components/kpi-drawer";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/")({ component: Dashboard });


function Dashboard() {
  const [mode] = useDataMode();
  const HOUSEHOLDS = getEffectiveHouseholds(mode);
  const isUploaded = mode === "uploaded";

  if (HOUSEHOLDS.length === 0) {
    return (
      <AppShell
        eyebrow="My uploads"
        title="Application readiness overview"
        description="This workspace shows only households built from your uploaded documents."
      >
        <Card className="card-elevated p-10 text-center">
          <UploadCloud className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-3 font-display text-xl font-semibold">No uploaded households yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            You're in <span className="font-mono text-primary">My uploads</span> mode. Synthetic HH-001…HH-006 fixtures are hidden. Upload documents to populate this dashboard.
          </p>
          <Link to="/intake"><Button className="mt-5 gap-1.5"><UploadCloud className="h-4 w-4" /> Go to intake</Button></Link>
        </Card>
      </AppShell>
    );
  }

  const totals = HOUSEHOLDS.map((h) => ({ h, r: readiness(h) }));
  const ready = totals.filter((t) => t.r.status === "READY FOR REVIEW").length;
  const needsReview = totals.filter((t) => t.r.status === "NEEDS REVIEW").length;
  const incomplete = totals.filter((t) => t.r.status === "INCOMPLETE").length;
  const avgScore = Math.round(totals.reduce((s, t) => s + t.r.score, 0) / totals.length);
  const [drawer, setDrawer] = useState<DrawerBucket | null>(null);
  void isUploaded;


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
        <KpiTile onClick={() => setDrawer("ready")} label="Ready for review" value={String(ready)} sub={`${HOUSEHOLDS.length} active households`} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiTile onClick={() => setDrawer("needs_review")} label="Needs review" value={String(needsReview)} sub="Reviewer attention" tone="warning" icon={<FileWarning className="h-4 w-4" />} />
        <KpiTile onClick={() => setDrawer("incomplete")} label="Incomplete" value={String(incomplete)} sub="Awaiting documents" tone="destructive" icon={<Clock3 className="h-4 w-4" />} />
        <KpiTile onClick={() => setDrawer("avg")} label="Avg completeness" value={`${avgScore}%`} sub="Across active portfolio" tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <KpiDrawer open={drawer !== null} bucket={drawer} households={HOUSEHOLDS} onClose={() => setDrawer(null)} />

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

      <Card className="card-elevated mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Per household</div>
            <h2 className="font-display text-lg font-semibold">Document completeness</h2>
          </div>
          <div className="hidden gap-3 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Captured</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive/70" /> Missing</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {totals.map(({ h, r }) => (
            <HouseholdPie key={h.id} h={h} score={r.score} status={r.status} />
          ))}
        </div>
      </Card>
    </AppShell>
  );
}

function KpiTile({ label, value, sub, tone, icon, onClick }: { label: string; value: string; sub: string; tone: "success" | "warning" | "destructive" | "primary"; icon: React.ReactNode; onClick?: () => void }) {
  const toneMap = {
    success: "text-success bg-success/10 ring-success/30",
    warning: "text-warning bg-warning/10 ring-warning/30",
    destructive: "text-destructive bg-destructive/10 ring-destructive/30",
    primary: "text-primary bg-primary/10 ring-primary/30",
  }[tone];
  return (
    <button type="button" onClick={onClick} className="text-left focus:outline-none">
      <Card className="card-elevated group cursor-pointer p-5 transition hover:border-primary/40 hover:shadow-lg">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
          <div className={`grid h-7 w-7 place-items-center rounded-md ring-1 ${toneMap}`}>{icon}</div>
        </div>
        <div className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{sub}</span>
          <span className="text-[10px] uppercase tracking-wider text-primary opacity-0 transition group-hover:opacity-100">View →</span>
        </div>
      </Card>
    </button>
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

function HouseholdPie({ h, score, status }: { h: Household; score: number; status: string }) {
  const tone = status === "READY FOR REVIEW" ? "hsl(var(--success))" : status === "NEEDS REVIEW" ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const { present, missing } = completenessBreakdown(h);
  const data = [
    { name: "Captured", value: present.length },
    { name: "Missing", value: missing.length },
  ];
  return (
    <Link to="/profile" className="group flex items-center gap-3 rounded-md border border-border/60 bg-secondary/20 p-3 transition hover:border-primary/40 hover:bg-secondary/40">
      <div className="relative h-20 w-20 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={24} outerRadius={38} paddingAngle={2} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
              <Cell fill={tone} />
              <Cell fill="hsl(var(--destructive) / 0.25)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-xs font-semibold">{score}%</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">{h.applicant}</div>
          <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">{h.id}</Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {present.map((p) => (
            <span key={p} className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success ring-1 ring-success/25">✓ {p}</span>
          ))}
          {missing.map((m) => (
            <span key={m} className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive ring-1 ring-destructive/25">✗ {m}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
