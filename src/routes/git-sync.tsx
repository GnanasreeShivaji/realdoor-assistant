import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGitSyncStatus } from "@/lib/git-sync.functions";
import type { GitSyncResult } from "@/lib/git-sync.server";
import {
  GitBranch,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Lock,
  Globe,
  Server,
  Github,
} from "lucide-react";

export const Route = createFileRoute("/git-sync")({
  head: () => ({
    meta: [
      { title: "Git sync status · RealDoor" },
      {
        name: "description",
        content:
          "Verify that the deployed code matches the latest commit in your GitHub repository.",
      },
    ],
  }),
  component: GitSync,
});

function GitSync() {
  const [owner, setOwner] = useState("Gnanasree_Shivaji");
  const [repo, setRepo] = useState("realdoor-assistant");
  const [token, setToken] = useState("");
  const [shouldCheck, setShouldCheck] = useState(false);

  const checkSync = useServerFn(getGitSyncStatus);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["git-sync", owner, repo, token],
    queryFn: () => checkSync({ owner, repo, token }),
    enabled: shouldCheck,
  });

  const handleCheck = () => {
    setShouldCheck(true);
    refetch();
  };

  return (
    <AppShell
      eyebrow="System"
      title="Git sync status"
      description="Compare the code running in this environment with the latest commit in your GitHub repository."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-elevated p-6 lg:col-span-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Repository
          </div>
          <h2 className="font-display text-lg font-semibold">
            GitHub connection
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Public repos work without a token. Private repos need a personal
            access token with <code className="font-mono">repo</code> scope.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs">Owner</Label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Repository</Label>
              <Input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Lock className="h-3 w-3" /> Personal access token (optional)
              </Label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 font-mono"
                placeholder="ghp_..."
              />
            </div>
            <Button
              onClick={handleCheck}
              disabled={isLoading || !owner || !repo}
              className="w-full gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />{" "}
              Check sync
            </Button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {data && <SyncSummary data={data} />}
          {error && (
            <Card className="card-elevated p-6 border-destructive/50">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <h3 className="font-display font-semibold">Check failed</h3>
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : String(error)}
                  </p>
                </div>
              </div>
            </Card>
          )}
          {!data && !error && !isLoading && (
            <Card className="card-elevated p-10 text-center">
              <GitBranch className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-3 font-display text-xl font-semibold">
                Ready to compare
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Enter your GitHub owner and repo, then click{" "}
                <strong>Check sync</strong> to see whether the deployed code
                matches the latest commit.
              </p>
            </Card>
          )}
          {data && <LocalCard info={data.local} />}
          {data && (
            <GitHubCard info={data.github} owner={owner} repo={repo} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SyncSummary({ data }: { data: GitSyncResult }) {
  const { status, matches, checkedAt } = data;

  const config: Record<
    typeof status,
    { label: string; icon: React.ReactNode; color: string; message: string }
  > = {
    synced: {
      label: "Synced",
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: "bg-success/20 text-success border-success/50",
      message:
        "The deployed code matches the latest commit on the default GitHub branch.",
    },
    diverged: {
      label: "Diverged",
      icon: <AlertCircle className="h-5 w-5" />,
      color: "bg-warning/20 text-warning border-warning/50",
      message:
        "The deployed code is different from the latest commit on the default GitHub branch.",
    },
    error: {
      label: "Error",
      icon: <XCircle className="h-5 w-5" />,
      color: "bg-destructive/20 text-destructive border-destructive/50",
      message: "Could not complete the comparison. See details below.",
    },
    unknown: {
      label: "Unknown",
      icon: <AlertCircle className="h-5 w-5" />,
      color: "bg-muted/40 text-muted-foreground border-muted",
      message: "Not enough information to compare the two commits.",
    },
  };

  const c = config[status];

  return (
    <Card className={`card-elevated p-6 border ${c.color}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/60">
            {c.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl font-semibold">{c.label}</h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                {matches ? "MATCH" : "DIFF"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{c.message}</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-mono">{new Date(checkedAt).toLocaleTimeString()}</div>
          <div>Checked {new Date(checkedAt).toLocaleDateString()}</div>
        </div>
      </div>
    </Card>
  );
}

function LocalCard({ info }: { info: GitSyncResult["local"] }) {
  return (
    <Card className="card-elevated p-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Server className="h-3.5 w-3.5" /> This environment
      </div>
      <h2 className="font-display text-lg font-semibold">Local git state</h2>
      {info.error ? (
        <p className="mt-3 text-sm text-destructive">
          Could not read local git state: {info.error}
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Commit
            </dt>
            <dd className="font-mono text-sm">
              {info.shortCommit ?? "—"} {info.commit ? `(${info.commit.slice(0, 12)}...)` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Branch
            </dt>
            <dd className="font-mono text-sm">{info.branch ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Last commit message
            </dt>
            <dd className="text-sm">{info.message ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Author
            </dt>
            <dd className="text-sm">{info.author ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Date
            </dt>
            <dd className="text-sm">{info.date ? new Date(info.date).toLocaleString() : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Origin remote
            </dt>
            <dd className="break-all font-mono text-xs text-muted-foreground">
              {info.remote ?? "—"}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function GitHubCard({
  info,
  owner,
  repo,
}: {
  info: GitSyncResult["github"];
  owner: string;
  repo: string;
}) {
  const repoUrl = `https://github.com/${owner}/${repo}`;

  return (
    <Card className="card-elevated p-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Github className="h-3.5 w-3.5" /> GitHub
      </div>
      <h2 className="font-display text-lg font-semibold">
        Latest commit on default branch
      </h2>
      {info.error ? (
        <p className="mt-3 text-sm text-destructive">
          Could not reach GitHub: {info.error}
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Commit
            </dt>
            <dd className="font-mono text-sm">
              {info.shortCommit ?? "—"} {info.commit ? `(${info.commit.slice(0, 12)}...)` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Branch
            </dt>
            <dd className="font-mono text-sm">{info.branch ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Message
            </dt>
            <dd className="text-sm">{info.message ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Author
            </dt>
            <dd className="text-sm">{info.author ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Date
            </dt>
            <dd className="text-sm">
              {info.date ? new Date(info.date).toLocaleString() : "—"}
            </dd>
          </div>
          {info.url && (
            <div className="sm:col-span-2">
              <a
                href={info.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                View commit on GitHub <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </dl>
      )}
      <div className="mt-4 text-[11px] text-muted-foreground">
        Repository: {" "}
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-primary hover:underline"
        >
          {repoUrl}
        </a>
      </div>
    </Card>
  );
}
