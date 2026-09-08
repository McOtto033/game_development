const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000 });
}
const files = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean))].sort();
const destination = path.join(root, ".autodev", "checkpoints", new Date().toISOString().replace(/[:.]/g, "-"));
const records = [];
for (const relative of files) {
  const source = path.resolve(root, relative);
  if (!source.startsWith(root + path.sep) || relative.startsWith(".autodev/") || relative.startsWith(".git/")) {
    throw new Error(`Invalid checkpoint input: ${relative}`);
  }
  if (!fs.existsSync(source)) {
    records.push({ path: relative, deleted: true });
    continue;
  }
  if (!fs.lstatSync(source).isFile()) throw new Error(`Checkpoint expects a regular file: ${relative}`);
  const bytes = fs.readFileSync(source);
  const target = path.join(destination, "files", relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: "wx" });
  records.push({ path: relative, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
}
const manifest = {
  createdAt: new Date().toISOString(),
  head: git("rev-parse", "HEAD").trim(),
  status: git("status", "--porcelain=v1", "-z"),
  note: "Local copy of tracked and unignored untracked files. Excludes Git history, ignored files, and browser storage. No automatic restore.",
  files: records,
};
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
for (const record of records.filter((record) => !record.deleted)) {
  const copied = fs.readFileSync(path.join(destination, "files", record.path));
  if (crypto.createHash("sha256").update(copied).digest("hex") !== record.sha256) {
    throw new Error(`Checkpoint checksum mismatch: ${record.path}`);
  }
}
console.log(`Checkpoint verified: ${destination} (${records.length} paths)`);
