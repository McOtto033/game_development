const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
if (Number(process.versions.node.split(".")[0]) < 22) {
  throw new Error("Node.js 22 or newer is required.");
}

function jsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsFiles(filename);
    return entry.name.endsWith(".js") ? [filename] : [];
  }).sort();
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Node verification failed (${result.status ?? result.signal}): ${args.join(" ")}`);
  }
}

const files = ["prototype", "scripts", "tests"].flatMap((name) => jsFiles(path.join(root, name)));
console.log(`Checking syntax: ${files.length} JavaScript files`);
for (const filename of files) run(["--check", filename]);
const tests = jsFiles(path.join(root, "tests")).filter((name) => name.endsWith(".test.js"));
if (tests.length === 0) throw new Error("No tests found; refusing an empty verification run.");
run(["--test", ...tests]);
console.log("PASS: syntax, production-engine checks, and research scenarios.");

