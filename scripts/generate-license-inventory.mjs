import fs from "node:fs";
const reportPath = ".audit/third-party-licenses.json";
const lockPath = "package-lock.json";
const outputPath = "docs/THIRD-PARTY-LICENSE-INVENTORY.md";
if (!fs.existsSync(reportPath) || !fs.existsSync(lockPath)) throw new Error("Dependency audit inputs are missing.");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const audit = JSON.parse(fs.readFileSync(".audit/npm-audit-all.json", "utf8"));
const productionAudit = JSON.parse(fs.readFileSync(".audit/npm-audit-production.json", "utf8"));
const packages = [];
for (const [key, info] of Object.entries(report)) {
  if (key.startsWith("taallab-transfer@")) continue;
  const split = key.lastIndexOf("@");
  const name = key.slice(0, split);
  const version = key.slice(split + 1);
  const entry = lock.packages?.["node_modules/" + name] ?? {};
  let kind = "Production tree";
  if (entry.dev && entry.optional) kind = "Development-only and optional";
  else if (entry.dev) kind = "Development-only";
  else if (entry.optional) kind = "Optional";
  packages.push({name, version, licence: String(info.licenses || "Unknown"), kind, repository: info.repository || "Not declared"});
}
packages.sort((a,b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const counts = new Map();
for (const item of packages) counts.set(item.licence, (counts.get(item.licence) || 0) + 1);
const out = [
  "# TAAL LAB — third-party npm licence inventory", "",
  "Generated from the GitHub Actions Node.js 24 installation for `taallabstudio/webpage`.", "",
  "## Scope and method", "",
  "- Exact dependency versions are pinned in `package-lock.json` (lockfile version 3).",
  "- Inventory generated from the installed dependency tree using `license-checker`; it includes direct and transitive packages, including development/build tools.",
  "- " + packages.length + " third-party package/version entries were identified. The private root project (`taallab-transfer@1.0.0`, marked `UNLICENSED`) is excluded.",
  "- `Production tree` means the package is not marked development-only or optional in the lockfile. This classification does not prove that a package is shipped in a particular binary.",
  "- Licence expressions are reproduced from package metadata. Dual-licence expressions require review against the actual package licence files and selected terms.",
  "", "## npm vulnerability audit", "",
  "- Full dependency tree: " + (audit.metadata?.vulnerabilities?.total ?? "unknown") + " known vulnerabilities (" + JSON.stringify(audit.metadata?.vulnerabilities || {}) + ").",
  "- Production dependency tree: " + (productionAudit.metadata?.vulnerabilities?.total ?? "unknown") + " known vulnerabilities (" + JSON.stringify(productionAudit.metadata?.vulnerabilities || {}) + ").",
  "- Results reflect the npm advisory database at the time this CI run was performed; rerun the audit for every dependency update and before each release.",
  "", "## Licence summary", "", "| Declared licence | Package entries |", "|---|---:|"
];
for (const [licence,count] of [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) out.push("| `" + licence + "` | " + count + " |");
out.push("", "## Packages", "", "| Package | Resolved version | Declared licence | Dependency class | Repository |", "|---|---:|---|---|---|");
for (const p of packages) out.push("| `" + p.name + "` | `" + p.version + "` | `" + p.licence + "` | " + p.kind + " | " + p.repository.replaceAll("|","\\|") + " |");
out.push("", "## Items requiring review before binary distribution", "",
  "- The inventory contains an `@img/sharp-libvips-linux-x64` entry declared `LGPL-3.0-or-later`. Confirm whether the corresponding library is included in a distributed artifact; if it is, meet applicable LGPL notice, source/relinking and redistribution requirements.",
  "- `caniuse-lite` declares `CC-BY-4.0`; preserve required attribution if its data is redistributed.",
  "- `@speed-highlight/core` declares `CC0-1.0`; retain package metadata with the audit evidence.",
  "- This report records declared package metadata. It does not replace review of actual licence texts, copyright notices, attribution files, native binaries, fonts, product artwork, or non-npm assets.",
  "", "## Release controls", "",
  "- Keep `package-lock.json` committed and use `npm ci` in CI/release workflows.",
  "- Re-run this inventory whenever the lockfile changes and review newly added, changed, or removed licence entries.",
  "- Include applicable third-party licence texts and notices in Windows/Android application distributions where required. This table alone is not a complete notice bundle.",
  "- Keep separate evidence for Google Fonts, Unsplash/API usage, product cover artwork, local brand/photography assets, and user-uploaded content in `docs/P1-LICENSE-AND-COPYRIGHT-REVIEW.md`.",
  "");
fs.writeFileSync(outputPath, out.join("\n"));
console.log("Wrote " + outputPath + " with " + packages.length + " package entries.");
