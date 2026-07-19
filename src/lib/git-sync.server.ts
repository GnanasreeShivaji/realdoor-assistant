import { execSync } from "child_process";

export type LocalGitInfo = {
  commit: string | null;
  shortCommit: string | null;
  branch: string | null;
  message: string | null;
  author: string | null;
  date: string | null;
  remote: string | null;
  originUrl: string | null;
  error: string | null;
};

export type GitHubCommitInfo = {
  commit: string | null;
  shortCommit: string | null;
  message: string | null;
  author: string | null;
  date: string | null;
  url: string | null;
  branch: string | null;
  error: string | null;
};

export type SyncStatus = "synced" | "diverged" | "unknown" | "error";

export type GitSyncResult = {
  local: LocalGitInfo;
  github: GitHubCommitInfo;
  matches: boolean;
  status: SyncStatus;
  checkedAt: string;
};

export async function getLocalGitInfo(): Promise<LocalGitInfo> {
  try {
    const cwd = process.cwd();
    const run = (cmd: string) => execSync(cmd, { encoding: "utf-8", cwd }).trim();
    const commit = run("git rev-parse HEAD");
    const shortCommit = run("git rev-parse --short HEAD");
    const branch = run("git rev-parse --abbrev-ref HEAD");
    const message = run("git log -1 --pretty=%s");
    const author = run("git log -1 --pretty=%an");
    const date = run("git log -1 --pretty=%ci");
    const remote = run("git remote get-url origin");
    return {
      commit,
      shortCommit,
      branch,
      message,
      author,
      date,
      remote,
      originUrl: remote,
      error: null,
    };
  } catch (err) {
    return {
      commit: null,
      shortCommit: null,
      branch: null,
      message: null,
      author: null,
      date: null,
      remote: null,
      originUrl: null,
      error: (err as Error).message,
    };
  }
}

export async function getGitHubCommit(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubCommitInfo> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const call = async (branch: string) => {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
      { headers },
    );
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        body: await res.text(),
      };
    }
    return {
      ok: true,
      data: (await res.json()) as any,
    };
  };

  let branchUsed = "main";
  let result = await call("main");

  if (!result.ok) {
    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
    );
    if (repoRes.ok) {
      const repoData = (await repoRes.json()) as any;
      const defaultBranch = repoData.default_branch as string;
      if (defaultBranch && defaultBranch !== "main") {
        branchUsed = defaultBranch;
        result = await call(defaultBranch);
      }
    }
  }

  if (!result.ok) {
    return {
      commit: null,
      shortCommit: null,
      message: null,
      author: null,
      date: null,
      url: null,
      branch: null,
      error: `GitHub API ${result.status}: ${result.body}`,
    };
  }

  const data = result.data;
  const sha = data.sha as string;
  return {
    commit: sha,
    shortCommit: sha.slice(0, 7),
    message: data.commit?.message as string,
    author: data.commit?.author?.name as string,
    date: data.commit?.author?.date as string,
    url: data.html_url as string,
    branch: branchUsed,
    error: null,
  };
}
