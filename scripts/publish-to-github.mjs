/**
 * One-off publish helper: pushes the project files to GitHub via the REST API.
 * Usage: GITHUB_TOKEN in env (read via Convex CLI by wrapper), then:
 *   node scripts/publish-to-github.mjs <owner> <repo> <public|private>
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const [ownerArg, repoArg, visibilityArg] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;
if (!ownerArg || !repoArg || !token) {
  console.error("usage: node scripts/publish-to-github.mjs <owner> <repo> <public|private>");
  process.exit(2);
}
const visibility = visibilityArg === "private" ? "private" : "public";
const API = "https://api.github.com";
const HEADERS = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
  "User-Agent": "agrivikas-publish-script",
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} ${res.statusText} on ${path}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// --- collect files, honoring .gitignore patterns (basic) ---
const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".cache", "coverage", ".nuxt", ".next",
  ".vercel", ".netlify", "out", ".turbo", ".vite", ".svelte-kit", "_generated",
]);
const IGNORE_FILES = new Set([
  ".env", ".env.local", ".env.test", ".env.production", ".env.development",
  ".DS_Store", "Thumbs.db",
]);
const IGNORE_SUFFIXES = [".log", ".tsbuildinfo", ".pem", ".key"];
const IGNORE_CONTAINS = [".pnp.", "npm-debug", "yarn-error", "yarn-debug"];

function isIgnored(relPath) {
  const parts = relPath.split(sep);
  if (parts.some((p) => IGNORE_DIRS.has(p))) return true;
  const base = parts[parts.length - 1];
  if (IGNORE_FILES.has(base)) return true;
  if (IGNORE_SUFFIXES.some((s) => base.endsWith(s))) return true;
  if (IGNORE_CONTAINS.some((c) => base.includes(c))) return true;
  return false;
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" && dir === ROOT) continue;
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (entry.isDirectory()) {
      if (isIgnored(rel)) continue;
      files.push(...walk(full));
    } else if (entry.isFile()) {
      if (isIgnored(rel)) continue;
      files.push(rel);
    }
  }
  return files;
}

const files = walk(ROOT).sort();
console.log(`Collected ${files.length} files (node_modules/.env/_generated excluded)`);

// Extra safety: refuse to publish any file whose content contains token-shaped strings
for (const rel of files) {
  // Skip the publish tooling itself (its regex patterns match the scanner) and binaries/images
  if (rel.startsWith("scripts/") || rel.startsWith("public/") || rel.endsWith(".png") || rel.endsWith(".svg") || rel.endsWith(".ico")) continue;
  const content = readFileSync(join(ROOT, rel));
  const text = content.toString("utf8");
  if (rel.endsWith(".md") || rel.endsWith(".txt")) continue; // docs may mention key names only
  if (/(sk-or-v1-|GITHUB_TOKEN\s*=\s*ghp_|ghp_[A-Za-z0-9]{30,})/.test(text)) {
    console.error(`REFUSING: ${rel} contains a token-shaped string`);
    process.exit(1);
  }
}

// --- 1. verify token & get user ---
const me = await api("/user");
console.log(`Authenticated as ${me.login}`);

// --- 2. create repo (or reuse) ---
let repo;
try {
  repo = await api("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repoArg,
      description: "AgriVikas — AI-powered farming assistant: crop advisory, disease detection, live mandi prices, govt schemes, weather-aware irrigation alerts",
      homepage: "",
      private: visibility === "private",
      has_issues: true,
      has_projects: false,
      has_wiki: false,
      auto_init: false,
    }),
  });
  console.log(`Created repo ${repo.full_name}`);
} catch (e) {
  if (e.status === 422) {
    repo = await api(`/repos/${ownerArg}/${repoArg}`);
    console.log(`Repo ${repo.full_name} already exists — pushing to it`);
  } else {
    throw e;
  }
}

// --- 3. bootstrap the branch (GitHub git-data API refuses empty repos) ---
let baseCommitSha = null;
try {
  const ref = await api(`/repos/${repo.full_name}/git/ref/heads/main`);
  baseCommitSha = ref.object.sha;
  console.log(`main exists at ${baseCommitSha.slice(0, 10)} — pushing on top`);
} catch (e) {
  if (e.status !== 404 && e.status !== 409) throw e; // 409 = repo exists but is empty
  const boot = await api(`/repos/${repo.full_name}/contents/README.md`, {
    method: "PUT",
    body: JSON.stringify({
      message: "chore: initialize repository",
      content: Buffer.from("# AgriVikas\n\nAI-powered farming assistant (Vite + React + Convex).\n").toString("base64"),
    }),
  });
  baseCommitSha = boot.commit.sha;
  console.log(`Bootstrapped main via README (${baseCommitSha.slice(0, 10)})`);
}

// --- 4. create blobs ---
const blobs = [];
for (const rel of files) {
  const content = readFileSync(join(ROOT, rel));
  const isText = /^[\x09\x0a\x0d\x20-\x7e]*(?:[^\x00-\x7f][\x09\x0a\x0d\x20-\x7e]*)*$/.test(content.toString("utf8"));
  const body = isText
    ? JSON.stringify({ content: content.toString("utf8"), encoding: "utf-8" })
    : JSON.stringify({ content: content.toString("base64"), encoding: "base64" });
  const blob = await api(`/repos/${repo.full_name}/git/blobs`, { method: "POST", body });
  blobs.push({ path: rel.split(sep).join("/"), mode: "100644", type: "blob", sha: blob.sha });
}
console.log(`Created ${blobs.length} blobs`);

// --- 5. build tree on top of the base commit ---
const tree = await api(`/repos/${repo.full_name}/git/trees`, {
  method: "POST",
  body: JSON.stringify({ tree: blobs, base_tree: baseCommitSha }),
});
console.log(`Tree created: ${tree.sha}`);

// --- 6. commit ---
const commit = await api(`/repos/${repo.full_name}/git/commits`, {
  method: "POST",
  body: JSON.stringify({
    message: "Publish AgriVikas web app (Vite + React + Convex)",
    tree: tree.sha,
    parents: [baseCommitSha],
  }),
});
console.log(`Commit created: ${commit.sha}`);

// --- 7. push branch ---
const branch = await api(`/repos/${repo.full_name}/git/refs/heads/main`, {
  method: "PATCH",
  body: JSON.stringify({ sha: commit.sha, force: true }),
});
console.log(`Pushed main -> ${branch.ref}`);

console.log(`\nDONE: https://github.com/${repo.full_name}`);
