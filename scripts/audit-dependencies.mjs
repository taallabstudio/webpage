import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("node_modules");
const output = process.argv[2] || "dependency-licenses.md";
const entries = new Map();

async function visit(directory) {
  let names;
  try { names = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
  for (const item of names) {
    if (!item.isDirectory() || item.name === ".bin") continue;
    const current = path.join(directory, item.name);
    if (item.name.startsWith("@")) {
      await visit(current);
      continue;
    }
    const manifestPath = path.join(current, "package.json");
    try {
      const pkg = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      if (pkg.name && pkg.version) {
        const raw = pkg.license || pkg.licenses || "UNKNOWN";
        const license = Array.isArray(raw)
          ? raw.map(value => typeof value === "string" ? value : value?.type || "UNKNOWN").join(" OR ")
          : typeof raw === "string" ? raw : raw?.type || "UNKNOWN";
        const files = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "NOTICE", "NOTICE.md"];
        let notice = "";
        for (const file of files) {
          try { await fs.access(path.join(current, file)); notice = file; break; } catch {}
        }
        entries.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version, license, notice });
      }
    } catch {}
    await visit(path.join(current, "node_modules"));
  }
}

await visit(root);
const rows = [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version));
const unknown = rows.filter(row => row.license === "UNKNOWN" || !row.notice);
const lines = [
  "# Installed dependency licence inventory",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Packages scanned: ${rows.length}`,
  `Packages with unknown licence metadata or no common notice file: ${unknown.length}`,
  "",
  "| Package | Version | Declared licence | Licence/notice file |",
  "|---|---:|---|---|",
  ...rows.map(row => `| ${row.name} | ${row.version} | ${row.license.replace(/\|/g,"\\|")} | ${row.notice || "Not found"} |`),
  "",
  "This report is a triage inventory from installed package metadata and common notice filenames. It is not legal approval; inspect the actual licence text for unknown, dual-licensed, copyleft, custom or restricted packages.",
  "",
  "## Packages requiring manual review",
  "",
  ...(unknown.length ? unknown.map(row => `- ${row.name}@${row.version}: licence=${row.license}; notice=${row.notice || "not found"}`) : ["- None detected by this basic metadata scan."]),
  "",
];
await fs.writeFile(output, lines.join("\n"), "utf8");
console.log(`Wrote ${rows.length} package records to ${output}; ${unknown.length} require manual review.`);
