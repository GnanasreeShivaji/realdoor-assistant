import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HOUSEHOLDS, readiness } from "@/lib/mock-data";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import { Activity, CheckCircle2, FileWarning, Timer, TrendingUp, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics · RealDoor" },
    { name: "description", content: "Portfolio-level analytics on document readiness, extraction confidence, and reviewer throughput." },
  ] }),
  component: Analytics,
});

// Theme colors pulled to match tokens
const C = {
  primary: "hsl(210 90% 62%)",
  success: "hsl(152 60% 52%)",
  warning: "hsl(38 92% 60%)",
  danger:  "hsl(0 72% 62%)",
  muted:   "hsl(220 12% 50%)",
  grid:    "hsl(220 14% 22%)",
};

function Analytics() {
  const totals = HOUSEHOLDS.map((h) => ({ h, r: readiness(h) }));
  const ready = totals.filter((t) => t.r.status === "READY FOR REVIEW").length;
  const needsReview = totals.filter((t) => t.r.status === "NEEDS REVIEW").length;
  const incomplete = totals.filter((t) => t.r.status === "INCOMPLETE").length;
  const avgScore = Math.round(totals.reduce((s, t) => s + t.r.score, 0) / totals.length);

  // Readiness funnel
  const funnel = [
    { stage: "Intake", value: HOUSEHOLDS.length * 4 },
    { stage: "Extracted", value: HOUSEHOLDS.reduce((s, h) => s + h.documents.length, 0) },
    { stage: "Confirmed", value: HOUSEHOLDS.reduce((s, h) => s + h.documents.filter((d) => d.status === "complete").length, 0) },
    { stage: "Packet-ready", value: ready },
  ];

  // Confidence distribution
  const buckets = [
    { range: "<70%", value: 0 },
    { range: "70–79%", value: 0 },
    { range: "80–89%", value: 0 },
    { range: "90–94%", value: 0 },
    { range: "95–100%", value: 0 },
  ];
  HOUSEHOLDS.flatMap((h) => h.documents).forEach((d) => {
    const c = d.confidence * 100;
    if (c < 70) buckets[0].value++;
    else if (c < 80) buckets[1].value++;
    else if (c < 90) buckets[2].value++;
    else if (c < 95) buckets[3].value++;
    else buckets[4].value++;
  });

  // Docs by status
  const statusMap: Record<string, number> = {};
  HOUSEHOLDS.flatMap((h) => h.documents).forEach((d) => { statusMap[d.status] = (statusMap[d.status] ?? 0) + 1; });
  const statusData = [
    { name: "complete", value: statusMap.complete ?? 0, color: C.success },
    { name: "review",   value: statusMap.review ?? 0,   color: C.warning },
    { name: "expired",  value: statusMap.expired ?? 0,  color: C.danger },
  ].filter((x) => x.value > 0);

  // 7-day throughput (synthetic but deterministic)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const throughput = days.map((d, i) => ({
    day: d,
    packets: [3, 5, 4, 7, 6, 2, 4][i],
    reviews: [2, 3, 3, 4, 5, 1, 2][i],
  }));

  // Completeness by household
  const completeness = totals.map(({ h, r }) => ({ id: h.id, score: r.score, name: h.applicant.split(" ")[0] }));

  // Review reasons
  const reasonMap: Record<string, number> = {};
  HOUSEHOLDS.forEach((h) => h.reviewReasons.forEach((r) => { reasonMap[r] = (reasonMap[r] ?? 0) + 1; }));
  // seed with rule citations from ledger
  const reasons = Object.entries(reasonMap).map(([k, v]) => ({ reason: k.replace(/_/g, " ").toLowerCase(), count: v }));
  if (reasons.length === 0) reasons.push({ reason: "no flags", count: 0 });

  return (
    <AppShell
      eyebrow="Portfolio analytics"
      title="Readiness analytics"
      description="Operational metrics for document intake, extraction confidence, and packet throughput across active households."
      actions={<Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Live · FY 2026</Badge>}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ready for review" value={String(ready)} delta="+2 wk" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <Kpi label="Needs review" value={String(needsReview)} delta="−1 wk" tone="warning" icon={<FileWarning className="h-4 w-4" />} />
        <Kpi label="Avg completeness" value={`${avgScore}%`} delta="+4 pts" tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi label="Median cycle time" value="1.8d" delta="−0.3d" tone="success" icon={<Timer className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Readiness funnel" subtitle="Documents progressing from intake to packet-ready">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="stage" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "hsl(220 14% 18% / 0.4)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={C.primary} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Documents by status" subtitle="Across all uploaded artifacts">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                {statusData.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, color: C.muted }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Extraction confidence" subtitle="Distribution across all fields">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "hsl(220 14% 18% / 0.4)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill={C.success} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Weekly throughput" subtitle="Packets prepared vs reviews required">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={throughput} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                <defs>
                  <linearGradient id="gPackets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gReviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.warning} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.warning} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} iconType="circle" />
                <Area type="monotone" dataKey="packets" stroke={C.primary} strokeWidth={2} fill="url(#gPackets)" />
                <Area type="monotone" dataKey="reviews" stroke={C.warning} strokeWidth={2} fill="url(#gReviews)" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <Panel title="Completeness by household" subtitle="Snapshot across active queue">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={completeness} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="id" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} width={54} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="score" fill={C.primary} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Top review reasons" subtitle="Reason codes flagged by extractor">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reasons} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="reason" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={C.warning} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Rule lookups (7d)" subtitle="Grounded queries by corpus section">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={days.map((d, i) => ({ day: d, mtsp: [4,6,5,7,8,3,5][i], chapter5: [2,3,4,3,5,2,3][i], safety: [1,1,2,2,1,0,1][i] }))} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} iconType="circle" />
              <Line type="monotone" dataKey="mtsp" stroke={C.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="chapter5" stroke={C.success} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="safety" stroke={C.danger} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Card className="card-elevated p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Governance
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold">Boundary integrity</h3>
          <div className="mt-4 space-y-3 text-sm">
            <Row label="Zero eligibility decisions" value="100%" tone="success" />
            <Row label="Citations attached" value="100%" tone="success" />
            <Row label="Abstentions on out-of-corpus" value="12" tone="primary" />
            <Row label="Human review handoffs" value={String(needsReview + incomplete)} tone="warning" />
          </div>
          <div className="mt-4 rounded-md border border-border/60 bg-secondary/40 p-3 text-[11px] text-muted-foreground">
            <Activity className="mr-1 inline h-3 w-3 text-primary" />
            System prepares evidence only. A qualified specialist makes every determination.
          </div>
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

function Kpi({ label, value, sub, delta, tone, icon }: { label: string; value: string; sub?: string; delta?: string; tone: "success" | "warning" | "destructive" | "primary"; icon: React.ReactNode }) {
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
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-display text-3xl font-semibold tracking-tight">{value}</div>
        {delta && <div className="text-[11px] font-medium text-success">{delta}</div>}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "primary" }) {
  const toneMap = { success: "text-success", warning: "text-warning", primary: "text-primary" }[tone];
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-none last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-semibold ${toneMap}`}>{value}</span>
    </div>
  );
}
