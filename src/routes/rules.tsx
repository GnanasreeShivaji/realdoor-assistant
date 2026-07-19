import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RULES, answerRule, annualize, threshold60 } from "@/lib/mock-data";
import { useState } from "react";
import { BookOpen, ExternalLink, Search, Sparkles, Calculator, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Rules Reference · RealDoor" }, { name: "description", content: "Grounded retrieval over the frozen affordable-housing rule corpus. Every answer ships with a citation." }] }),
  component: Rules,
});

const SUGGESTIONS = [
  "What are the FY 2026 60% income limits?",
  "When did the FY 2026 MTSP limits become effective?",
  "How should biweekly pay be annualized?",
  "Is the LIHTC database a live vacancy feed?",
];

function Rules() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ReturnType<typeof answerRule> | null>(null);

  const [amount, setAmount] = useState(2166);
  const [freq, setFreq] = useState<"biweekly" | "weekly" | "semimonthly" | "monthly">("biweekly");
  const [size, setSize] = useState(1);
  const a = annualize(amount, freq);
  const t = threshold60(size);

  const search = (q?: string) => {
    const question = q ?? query;
    if (!question.trim()) return;
    setResult(answerRule(question));
  };

  return (
    <AppShell
      eyebrow="Step 3"
      title="Rules reference"
      description="Search the supplied HUD, federal, and hackathon-frozen rule corpus. RealDoor abstains on any eligibility, approval, denial, or ranking question."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="card-elevated col-span-2 p-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Grounded lookup</div>
          <h2 className="font-display text-lg font-semibold">Ask the corpus</h2>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Example: How is biweekly gross pay annualized?" className="pl-9 h-10" />
            </div>
            <Button onClick={() => search()} className="h-10">Search rules</Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => { setQuery(s); search(s); }} className="rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
                {s}
              </button>
            ))}
          </div>

          {result && (
            <div className="mt-5 overflow-hidden rounded-lg border border-border/70">
              <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Evidence-backed answer</span>
                <span>Confidence <span className="font-mono text-foreground">{Math.round(result.confidence * 100)}%</span></span>
              </div>
              <div className="p-4">
                {result.abstained && !result.rule ? (
                  <div className="flex gap-2 text-sm text-warning">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{result.answer}</p>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{result.answer}</p>
                )}
                {result.rule && (
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rule</div>
                      <a href={result.rule.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-primary hover:underline">
                        {result.rule.rule_id} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Locator</div>
                      <div className="mt-1">{result.rule.source_locator}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Effective</div>
                      <div className="mt-1 font-mono">{result.rule.effective_date ?? "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card className="card-elevated p-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Transparent ledger</div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Annualization</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Gross per period</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Frequency</label>
              <select value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option>weekly</option><option>biweekly</option><option>semimonthly</option><option>monthly</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Household size</label>
              <Input type="number" min={1} max={8} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-1 font-mono" />
            </div>
          </div>
          <div className="mt-5 rounded-md border border-border/60 bg-secondary/40 p-3">
            <div className="font-mono text-[11px] text-muted-foreground">{a.formula}</div>
            <div className="mt-1 font-display text-2xl font-semibold">${a.annual.toLocaleString()}</div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">60% ref (HH {size})</span>
              <span className="font-mono">${t.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">HUD-MTSP-002 · PDF p.130</div>
          </div>
        </Card>
      </div>

      <Card className="card-elevated mt-6 p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Rule corpus · {RULES.length} entries</div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Browse frozen sources</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {RULES.map((r) => (
            <div key={r.rule_id} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
              <div className="mb-1 flex items-center justify-between">
                <a href={r.source_url} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">{r.rule_id}</a>
                <Badge variant="outline" className="h-5 border-border/60 px-1.5 py-0 text-[10px] text-muted-foreground">{r.authority.replace("_", " ")}</Badge>
              </div>
              <p className="text-sm text-foreground/90">{r.text}</p>
              <div className="mt-2 text-[11px] text-muted-foreground">{r.source_locator}{r.effective_date ? ` · eff. ${r.effective_date}` : ""}</div>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
