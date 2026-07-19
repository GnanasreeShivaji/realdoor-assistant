import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, Command, Database, UploadCloud } from "lucide-react";
import { useDataMode } from "@/lib/data-mode";

function ModeToggle() {
  const [mode, setMode] = useDataMode();
  return (
    <div className="inline-flex items-center rounded-md border border-border/70 bg-secondary/40 p-0.5 text-[11px] font-medium">
      <button
        onClick={() => setMode("synthetic")}
        className={`flex items-center gap-1.5 rounded px-2 py-1 transition ${mode === "synthetic" ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"}`}
        aria-pressed={mode === "synthetic"}
        title="Show synthetic demo households (HH-001…HH-006)"
      >
        <Database className="h-3 w-3" /> Synthetic demo
      </button>
      <button
        onClick={() => setMode("uploaded")}
        className={`flex items-center gap-1.5 rounded px-2 py-1 transition ${mode === "uploaded" ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground"}`}
        aria-pressed={mode === "uploaded"}
        title="Show only households built from your uploaded documents"
      >
        <UploadCloud className="h-3 w-3" /> My uploads
      </button>
    </div>
  );
}

export function AppShell({
  eyebrow, title, description, actions, children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/70 px-3 backdrop-blur">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="hidden md:flex items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Search households, documents, rules…</span>
          <span className="ml-6 flex items-center gap-1 rounded border border-border/70 bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">
            <Command className="h-3 w-3" />K
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <ModeToggle />
          <span className="hidden lg:inline">Boston · MA HMFA · FY 2026</span>
          <button className="rounded-md p-1.5 hover:bg-secondary/60"><Bell className="h-4 w-4" /></button>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary ring-1 ring-primary/30">RA</div>
        </div>
      </header>

      <div className="border-b border-border/60 bg-gradient-to-b from-secondary/30 to-transparent">
        <div className="mx-auto max-w-[1400px] px-6 py-6 md:py-8">
          {eyebrow && (
            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
              {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 md:py-8">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-[1400px] px-6 py-6 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
          <div>Document completeness only. This system does not determine eligibility.</div>
          <div className="font-mono">RealDoor · v0.1 · Hack-Nation × RealPage</div>
        </div>
      </footer>
    </div>
  );
}
