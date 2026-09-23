/**
 * Publish wrapper: loads GITHUB_TOKEN from the environment (or the project's
 * Convex env store) WITHOUT printing it, then runs the publisher.
 * Usage: node scripts/publish-wrapper.mjs <repo> <public|private>
 */
import { execFileSync, spawnSync } from "node:child_process";

function loadToken() {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.length > 20) {
    return process.env.GITHUB_TOKEN;
  }
  // Read the key the user stored in the project's Keys tab (Convex env store).
  // stdio is piped so the value never appears in terminal output.
  const out = execFileSync("npx", ["convex", "env", "get", "GITHUB_TOKEN"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const value = out.trim().split("\n").pop()?.trim();
  if (!value || value.length < 20) {
    console.error("GITHUB_TOKEN not found. Add it in the project Keys tab.");
    process.exit(1);
  }
  return value;
}

const token = loadToken();
const [, , repoArg, visibilityArg] = process.argv;
if (!repoArg) {
  console.error("usage: node scripts/publish-wrapper.mjs <repo> <public|private>");
  process.exit(2);
}

// Resolve the authenticated GitHub login (non-sensitive).
const meRes = await fetch("https://api.github.com/user", {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "agrivikas-publish",
  },
});
if (!meRes.ok) {
  console.error(`Token rejected by GitHub (HTTP ${meRes.status}). Check the token value/scopes (needs "repo").`);
  process.exit(1);
}
const me = await meRes.json();
console.log(`Authenticated as ${me.login}`);

const result = spawnSync(
  process.execPath,
  ["scripts/publish-to-github.mjs", me.login, repoArg, visibilityArg ?? "public"],
  {
    stdio: "inherit",
    env: { ...process.env, GITHUB_TOKEN: token },
  },
);
process.exit(result.status ?? 1);
