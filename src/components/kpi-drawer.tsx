import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { Household } from "@/lib/mock-data";
import { readiness } from "@/lib/mock-data";
import { ChevronRight, CheckCircle2, AlertTriangle, XCircle, Clock3 } from "lucide-react";

export type DrawerBucket = "ready" | "needs_review" | "incomplete" | "avg";

const REASON_COPY: Record<string, string> = {
  EMPLOYMENT_LETTER_EXPIRED: "Employment letter is past the 60-day freshness window",
  PAY_STUB_MISSING_FIELDS: "Pay stub is missing one or more required fields",
  GIG_INCOME_VARIABLE: "Gig income is variable and needs corroboration",
  REQUIRES_CORROBORATION: "A second independent source is required",
  BENEFIT_LETTER_UNSIGNED: "Benefit letter is not signed",
};

const REQUIRED_TYPES: { key: string; label: string }[] = [
  { key: "application_summary", label: "Application summary" },
  { key: "pay_stub", label: "Pay stubs" },
  { key: "employment_letter", label: "Employment / benefit verification" },
];

function reasonsFor(h: Household): string[] {
  const r = readiness(h);
  const out: string[] = [];
  const supplied = new Set(h.documents.map((d) => d.documentType));
  if (!supplied.has("application_summary")) out.push("Missing signed application summary");
  const stubs = h.documents.filter((d) => d.documentType === "pay_stub").length;
  if (stubs < 2) out.push(`Only ${stubs} pay stub${stubs === 1 ? "" : "s"} on file — 2 required`);
  if (!supplied.has("employment_letter") && !supplied.has("benefit_letter") && !supplied.has("gig_statement")) {
    out.push("No employment or benefit verification uploaded");
  }
  for (const rr of h.reviewReasons) out.push(REASON_COPY[rr] ?? rr.replaceAll("_", " ").toLowerCase());
  if (out.length === 0 && r.status === "READY FOR REVIEW") out.push("All required documents present and current");
  return out;
}

export function KpiDrawer({ open, bucket, households, onClose }: { open: boolean; bucket: DrawerBucket | null; households: Household[]; onClose: () => void }) {
  const totals = households.map((h) => ({ h, r: readiness(h) }));
  const filtered = (() => {
    if (bucket === "ready") return totals.filter((t) => t.r.status === "READY FOR REVIEW");
    if (bucket === "needs_review") return totals.filter((t) => t.r.status === "NEEDS REVIEW");
    if (bucket === "incomplete") return totals.filter((t) => t.r.status === "INCOMPLETE");
    return totals;
  })();

  const title = bucket === "ready" ? "Ready for review"
    : bucket === "needs_review" ? "Needs review"
    : bucket === "incomplete" ? "Incomplete"
    : "Average completeness";

  const description = bucket === "ready" ? "Every required document present, current, and internally consistent."
    : bucket === "needs_review" ? "Documents on file but reviewer attention required before packet compile."
    : bucket === "incomplete" ? "One or more required documents are still awaited from the applicant."
    : "Portfolio-wide document capture across every required evidence type.";

  const icon = bucket === "ready" ? <CheckCircle2 className="h-4 w-4 text-success" />
    : bucket === "needs_review" ? <AlertTriangle className="h-4 w-4 text-warning" />
    : bucket === "incomplete" ? <Clock3 className="h-4 w-4 text-destructive" />
    : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {icon}
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px] uppercase tracking-wide">{filtered.length} household{filtered.length === 1 ? "" : "s"}</Badge>
          </div>
          <SheetTitle className="font-display text-2xl">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {bucket === "avg" ? <CompletenessView households={households} /> : (
          <div className="mt-5 space-y-2.5">
            {filtered.length === 0 && (
              <div className="rounded-md border border-border/60 bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                No households currently in this bucket.
              </div>
            )}
            {filtered.map(({ h, r }) => {
              const reasons = reasonsFor(h);
              return (
                <Link key={h.id} to="/profile" onClick={onClose} className="block rounded-md border border-border/60 bg-secondary/20 p-4 transition hover:border-primary/40 hover:bg-secondary/40">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 font-mono text-xs font-medium text-primary ring-1 ring-primary/25">{h.id.split("-")[1]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium">{h.applicant}</div>
                        <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">HH-{h.id.split("-")[1]}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{h.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{r.score}%</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">complete</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <ul className="mt-3 space-y-1 pl-12 text-xs">
                    {reasons.map((rr, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                        <span className={`mt-1 h-1 w-1 shrink-0 rounded-full ${bucket === "ready" ? "bg-success" : bucket === "needs_review" ? "bg-warning" : "bg-destructive"}`} />
                        <span>{rr}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CompletenessView({ households }: { households: Household[] }) {
  // Per-required-type coverage
  const perType = REQUIRED_TYPES.map((rt) => {
    let captured = 0;
    for (const h of households) {
      const supplied = h.documents.some((d) =>
        rt.key === "employment_letter"
          ? ["employment_letter", "benefit_letter", "gig_statement"].includes(d.documentType)
          : d.documentType === rt.key
      );
      if (supplied) captured++;
    }
    return { name: rt.label, captured, missing: households.length - captured };
  });

  const totals = households.map((h) => readiness(h));
  const avg = Math.round(totals.reduce((s, r) => s + r.score, 0) / Math.max(1, totals.length));
  const donut = [
    { name: "Captured", value: avg },
    { name: "Outstanding", value: 100 - avg },
  ];
  const COLORS = ["hsl(var(--primary))", "hsl(var(--muted))"];

  return (
    <div className="mt-5 space-y-6">
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Portfolio completeness</div>
        <div className="mt-2 grid grid-cols-2 items-center gap-3">
          <div>
            <div className="font-display text-5xl font-semibold text-gradient">{avg}%</div>
            <div className="mt-1 text-xs text-muted-foreground">Weighted average across {households.length} household{households.length === 1 ? "" : "s"}</div>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} innerRadius={38} outerRadius={56} paddingAngle={2} dataKey="value" stroke="none">
                  {donut.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Per required document type</div>
        <div className="mt-1 font-display text-lg font-semibold">Captured vs missing</div>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perType} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 0 }}>
              <XAxis type="number" hide domain={[0, households.length]} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="captured" stackId="a" fill="hsl(var(--primary))" radius={[3, 0, 0, 3]} />
              <Bar dataKey="missing" stackId="a" fill="hsl(var(--destructive))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-1 text-xs">
          {perType.map((p) => (
            <li key={p.name} className="flex items-center justify-between">
              <span className="text-muted-foreground">{p.name}</span>
              <span className="font-mono">{p.captured} / {households.length}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Completeness measures document capture only. It does not indicate eligibility, approval, denial, or priority.
      </p>
    </div>
  );
}
