import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readiness, annualize, threshold60, RULES } from "@/lib/mock-data";
import { useDataMode, getEffectiveHouseholds } from "@/lib/data-mode";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, ReferenceLine,
} from "recharts";
import { CheckCircle2, FileWarning, ShieldCheck, UploadCloud, FileText, Percent, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics · RealDoor" },
    { name: "description", content: "Portfolio analytics derived directly from uploaded household documents and the frozen rules corpus." },
  ] }),
  component: Analytics,
});

const C = {
  primary: "hsl(210 90% 62%)",
  success: "hsl(152 60% 52%)",
  warning: "hsl(38 92% 60%)",
  danger:  "hsl(0 72% 62%)",
  muted:   "hsl(220 12% 50%)",
  grid:    "hsl(220 14% 22%)",
};

function Analytics() {
  const [mode] = useDataMode();
  const HOUSEHOLDS = getEffectiveHouseholds(mode);

  if (HOUSEHOLDS.length === 0) {
    return (
      <AppShell eyebrow="My uploads" title="Readiness analytics" description="No uploaded households yet.">
        <Card className="card-elevated p-10 text-center">
          <UploadCloud className="mx-auto h-10 w-10 text-primary" />
          <h3 className="mt-3 font-display text-xl font-semibold">Analytics appear once you upload</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Every chart on this page is computed directly from household documents. Nothing is simulated.
          </p>
          <Link to="/intake"><Button className="mt-5 gap-1.5"><UploadCloud className="h-4 w-4" /> Go to intake</Button></Link>
        </Card>
      </AppShell>
    );
  }

  // === Derived ONLY from real data ===
  const totals = HOUSEHOLDS.map((h) => ({ h, r: readiness(h) }));
  const ready = totals.filter((t) => t.r.status === "READY FOR REVIEW").length;
  const needsReview = totals.filter((t) => t.r.status === "NEEDS REVIEW").length;
  const incomplete = totals.filter((t) => t.r.status === "INCOMPLETE").length;
  const avgScore = Math.round(totals.reduce((s, t) => s + t.r.score, 0) / totals.length);

  const allDocs = HOUSEHOLDS.flatMap((h) => h.documents);
  const totalDocs = allDocs.length;
  const totalPages = allDocs.reduce((s, d) => s + d.pages, 0);
  const avgConfidence = Math.round((allDocs.reduce((s, d) => s + d.confidence, 0) / allDocs.length) * 100);

  // Readiness status distribution
  const statusDist = [
    { name: "Ready", value: ready, color: C.success },
    { name: "Needs review", value: needsReview, color: C.warning },
    { name: "Incomplete", value: incomplete, color: C.danger },
  ].filter((x) => x.value > 0);

  // Documents by status
  const docStatusMap: Record<string, number> = {};
  allDocs.forEach((d) => { docStatusMap[d.status] = (docStatusMap[d.status] ?? 0) + 1; });
  const docStatus = [
    { name: "complete", value: docStatusMap.complete ?? 0, color: C.success },
    { name: "review",   value: docStatusMap.review ?? 0,   color: C.warning },
    { name: "expired",  value: docStatusMap.expired ?? 0,  color: C.danger },
  ].filter((x) => x.value > 0);

  // Documents by type
  const typeMap: Record<string, number> = {};
  allDocs.forEach((d) => { typeMap[d.documentType] = (typeMap[d.documentType] ?? 0) + 1; });
  const docTypes = Object.entries(typeMap)
    .map(([k, v]) => ({ type: k.replace(/_/g, " "), count: v }))
    .sort((a, b) => b.count - a.count);

  // Avg confidence by document type
  const confByType: Record<string, { sum: number; n: number }> = {};
  allDocs.forEach((d) => {
    const b = (confByType[d.documentType] ??= { sum: 0, n: 0 });
    b.sum += d.confidence; b.n += 1;
  });
  const confByTypeData = Object.entries(confByType)
    .map(([k, v]) => ({ type: k.replace(/_/g, " "), pct: Math.round((v.sum / v.n) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  // Confidence histogram
  const buckets = [
    { range: "<70%", value: 0 },
    { range: "70–79%", value: 0 },
    { range: "80–89%", value: 0 },
    { range: "90–94%", value: 0 },
    { range: "95–100%", value: 0 },
  ];
  allDocs.forEach((d) => {
    const c = d.confidence * 100;
    if (c < 70) buckets[0].value++;
    else if (c < 80) buckets[1].value++;
    else if (c < 90) buckets[2].value++;
    else if (c < 95) buckets[3].value++;
    else buckets[4].value++;
  });

  // Completeness by household
  const completeness = totals.map(({ h, r }) => ({ id: h.id, score: r.score }));

  // Annualized income vs 60% AMI threshold (per household size)
  const incomeVsAmi = HOUSEHOLDS.map((h) => {
    const { annual } = annualize(h.grossPerPeriod, h.frequency);
    const limit = threshold60(h.size);
    return {
      id: h.id,
      annual: Math.round(annual),
      limit,
      headroom: Math.round(limit - annual),
      underLimit: annual <= limit,
    };
  });
  const underLimitCount = incomeVsAmi.filter((r) => r.underLimit).length;

  // Household size distribution
  const sizeMap: Record<number, number> = {};
  HOUSEHOLDS.forEach((h) => { sizeMap[h.size] = (sizeMap[h.size] ?? 0) + 1; });
  const sizeDist = Object.entries(sizeMap)
    .map(([k, v]) => ({ size: `${k}-person`, count: v }))
    .sort((a, b) => parseInt(a.size) - parseInt(b.size));

  // Pay frequency mix
  const freqMap: Record<string, number> = {};
  HOUSEHOLDS.forEach((h) => { freqMap[h.frequency] = (freqMap[h.frequency] ?? 0) + 1; });
  const freqDist = Object.entries(freqMap).map(([k, v], i) => ({
    name: k, value: v,
    color: [C.primary, C.success, C.warning, C.danger][i % 4],
  }));

  // Review reasons
  const reasonMap: Record<string, number> = {};
  HOUSEHOLDS.forEach((h) => h.reviewReasons.forEach((r) => { reasonMap[r] = (reasonMap[r] ?? 0) + 1; }));
  const reasons = Object.entries(reasonMap)
    .map(([k, v]) => ({ reason: k.replace(/_/g, " ").toLowerCase(), count: v }))
    .sort((a, b) => b.count - a.count);

  // Rules corpus by authority
  const authMap: Record<string, number> = {};
  RULES.forEach((r) => { authMap[r.authority] = (authMap[r.authority] ?? 0) + 1; });
  const authData = [
    { name: "HUD",         value: authMap.official_hud ?? 0,           color: C.primary },
    { name: "Federal",     value: authMap.official_federal ?? 0,       color: C.success },
    { name: "Simulation",  value: authMap.hackathon_simulation ?? 0,   color: C.warning },
  ].filter((x) => x.value > 0);

  return (
    <AppShell
      eyebrow="Portfolio analytics"
      title="Readiness analytics"
      description="Every chart is derived directly from uploaded documents and the frozen rules corpus. No projections, no simulations."
      actions={<Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Computed · {HOUSEHOLDS.length} households</Badge>}
    >
      {/* KPI row — all computed */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ready for review" value={String(ready)} sub={`of ${HOUSEHOLDS.length} households`} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="Needs review / incomplete" value={String(needsReview + incomplete)} sub={`${needsReview} review · ${incomplete} incomplete`} tone="warning" icon={<FileWarning className="h-4 w-4" />} />
        <Kpi label="Avg completeness" value={`${avgScore}%`} sub={`${totalDocs} documents · ${totalPages} pages`} tone="primary" icon={<Percent className="h-4 w-4" />} />
        <Kpi label="Avg extraction confidence" value={`${avgConfidence}%`} sub={`across ${totalDocs} documents`} tone="success" icon={<FileText className="h-4 w-4" />} />
      </div>

      {/* Row 1 */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Readiness status" subtitle="Household-level status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                {statusDist.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} household${v === 1 ? "" : "s"}`} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, color: C.muted }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Documents by status" subtitle={`${totalDocs} artifacts across portfolio`}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={docStatus} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                {docStatus.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, color: C.muted }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Extraction confidence" subtitle="Distribution across all documents">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "hsl(220 14% 18% / 0.4)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={C.success} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Row 2 — Income vs AMI is the marquee analytic */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Annualized income vs 60% AMI limit"
            subtitle={`${underLimitCount} of ${HOUSEHOLDS.length} households annualize at or below their household-size threshold`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={incomeVsAmi} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="id" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} iconType="circle" />
                <Bar dataKey="annual" name="Annualized income" fill={C.primary} radius={[4,4,0,0]} />
                <Bar dataKey="limit" name="60% AMI limit" fill={C.warning} radius={[4,4,0,0]} fillOpacity={0.55} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Comparison only. RealDoor does not determine eligibility — a qualified specialist decides.
            </p>
          </Panel>
        </div>

        <Panel title="Completeness by household" subtitle="Readiness score, 0–100%">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={completeness} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="id" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} width={54} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <ReferenceLine x={100} stroke={C.success} strokeDasharray="3 3" />
              <Bar dataKey="score" fill={C.primary} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Row 3 */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Documents by type" subtitle="Artifact mix across portfolio">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={docTypes} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="type" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} width={130} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={C.primary} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Avg confidence by document type" subtitle="Where the extractor is strongest">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={confByTypeData} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="type" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} width={130} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="pct" fill={C.success} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Review reason codes" subtitle="Flags raised by extractor">
          {reasons.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reasons} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="reason" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.warning} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">No review flags raised.</div>
          )}
        </Panel>
      </div>

      {/* Row 4 */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Household size mix" subtitle="Portfolio composition">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sizeDist} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="size" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={C.primary} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Pay frequency mix" subtitle="How income annualization varies">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={freqDist} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                {freqDist.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} household${v === 1 ? "" : "s"}`} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, color: C.muted }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Card className="card-elevated p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Governance
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold">Boundary integrity</h3>
          <div className="mt-4 space-y-3 text-sm">
            <Row label="Rules in corpus" value={String(RULES.length)} tone="primary" icon={<FileText className="h-3.5 w-3.5" />} />
            <Row label="HUD / federal sources" value={String((authMap.official_hud ?? 0) + (authMap.official_federal ?? 0))} tone="success" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
            <Row label="Households analyzed" value={`${HOUSEHOLDS.length}`} tone="primary" icon={<Users className="h-3.5 w-3.5" />} />
            <Row label="Under 60% AMI limit" value={`${underLimitCount} / ${HOUSEHOLDS.length}`} tone={underLimitCount === HOUSEHOLDS.length ? "success" : "warning"} icon={<DollarSign className="h-3.5 w-3.5" />} />
          </div>
          <div className="mt-4 rounded-md border border-border/60 bg-secondary/40 p-3 text-[11px] text-muted-foreground">
            RealDoor prepares evidence and cites rules. A qualified specialist makes every eligibility determination.
          </div>

          {authData.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Rules corpus authority mix</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={authData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {authData.map((a) => <Cell key={a.name} fill={a.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "hsl(220 18% 10%)",
  border: "1px solid hsl(220 14% 22%)",
  borderRadius: 6,
  fontSize: 11,
  color: "hsl(220 20% 92%)",
};

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="card-elevated p-5">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{subtitle}</div>
        <h3 className="font-display text-base font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: "success" | "warning" | "destructive" | "primary"; icon: React.ReactNode }) {
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
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Row({ label, value, tone, icon }: { label: string; value: string; tone: "success" | "warning" | "primary"; icon?: React.ReactNode }) {
  const toneMap = { success: "text-success", warning: "text-warning", primary: "text-primary" }[tone];
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-none last:pb-0">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className={`font-mono text-sm font-semibold ${toneMap}`}>{value}</span>
    </div>
  );
}
