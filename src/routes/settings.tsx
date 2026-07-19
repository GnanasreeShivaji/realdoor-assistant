import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Server, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · RealDoor" }, { name: "description", content: "Configure API endpoints, retention, and safety controls." }] }),
  component: Settings,
});

function Settings() {
  const [apiBase, setApiBase] = useState("http://localhost:8000");
  const [redactPii, setRedactPii] = useState(true);
  const [strictAbstention, setStrictAbstention] = useState(true);
  const [autoConfirmThreshold, setAutoConfirmThreshold] = useState(0.9);

  const save = () => toast.success("Settings saved", { description: "Applied to this session." });

  return (
    <AppShell
      eyebrow="System"
      title="Settings"
      description="Configure how the frontend talks to the Python extraction & rules backend, and tune reviewer-safety toggles."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="card-elevated p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><Server className="h-3.5 w-3.5" /> Backend</div>
          <h2 className="font-display text-lg font-semibold">Python API endpoint</h2>
          <p className="mt-1 text-xs text-muted-foreground">Point at your FastAPI wrapper around the existing extractor + rules_engine.</p>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">API base URL</Label>
              <Input value={apiBase} onChange={(e) => setApiBase(e.target.value)} className="mt-1 font-mono" />
              <div className="mt-1 text-[11px] text-muted-foreground">Expected endpoints: <code className="font-mono">POST /extract</code>, <code className="font-mono">POST /rules/answer</code>, <code className="font-mono">POST /packet</code></div>
            </div>
            <div>
              <Label className="text-xs">Model provider (optional VLM top-up)</Label>
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option>None · deterministic regex only</option>
                <option>OpenAI · gpt-4o-mini vision</option>
                <option>Google · gemini-2.5-flash</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="card-elevated p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Safety</div>
          <h2 className="font-display text-lg font-semibold">Reviewer safeguards</h2>
          <div className="mt-4 space-y-4 text-sm">
            <Row label="Strict abstention on decision terms" hint="Refuse any query containing eligible/approve/deny/rank." checked={strictAbstention} onChange={setStrictAbstention} />
            <Row label="Redact PII in audit exports" hint="Names and addresses are hashed in the exported JSONL." checked={redactPii} onChange={setRedactPii} />
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-confirm confidence threshold</Label>
                <span className="font-mono text-xs">{Math.round(autoConfirmThreshold * 100)}%</span>
              </div>
              <input type="range" min={0.7} max={0.99} step={0.01} value={autoConfirmThreshold} onChange={(e) => setAutoConfirmThreshold(Number(e.target.value))} className="mt-2 w-full accent-[color:var(--color-primary)]" />
              <div className="mt-1 text-[11px] text-muted-foreground">Fields below this remain in the reviewer's queue.</div>
            </div>
          </div>
        </Card>

        <Card className="card-elevated p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> Session</div>
          <h2 className="font-display text-lg font-semibold">Current session</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Session ID</dt><dd className="font-mono text-xs">RD-CA97A4F00A</dd></div>
            <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Operator</dt><dd>R. Adams · caseworker</dd></div>
            <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">HMFA</dt><dd>Boston-Cambridge-Quincy, MA-NH</dd></div>
            <div><dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fiscal year</dt><dd>FY 2026</dd></div>
          </dl>
        </Card>

        <Card className="card-elevated p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Danger zone</div>
          <h2 className="font-display text-lg font-semibold">Session data</h2>
          <p className="mt-1 text-xs text-muted-foreground">Clears local uploads and cached extractions. The immutable audit log is retained.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm">Clear session cache</Button>
            <Button variant="destructive" size="sm">End session</Button>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save}>Save settings</Button>
      </div>
    </AppShell>
  );
}

function Row({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 bg-secondary/20 p-3">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
