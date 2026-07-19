import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getLocalGitInfo, getGitHubCommit } from "./git-sync.server";

const inputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  token: z.string().optional(),
});

export const getGitSyncStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const local = await getLocalGitInfo();
    const github = await getGitHubCommit(data.owner, data.repo, data.token);

    let status: "synced" | "diverged" | "unknown" | "error" = "unknown";
    if (local.error || github.error) {
      status = "error";
    } else if (local.commit && github.commit) {
      status = local.commit === github.commit ? "synced" : "diverged";
    }

    return {
      local,
      github,
      matches: status === "synced",
      status,
      checkedAt: new Date().toISOString(),
    };
  });
