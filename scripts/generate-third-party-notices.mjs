import fs from "node:fs";
import path from "node:path";
const report = JSON.parse(fs.readFileSync(".audit/third-party-licenses.json", "utf8"));
const notices = [];
const missing = [];
const packages = Object.entries(report).filter(([key]) => !key.startsWith("taallab-transfer@")).sort(([a],[b]) => a.localeCompare(b));
for (const [key, info] of packages) {
  const root = path.resolve(info.path || "");
  const dir = fs.existsSync(root) && fs.statSync(root).isDirectory() ? root : path.dirname(root);
  const candidates = new Set();
  if (info.licenseFile && fs.existsSync(info.licenseFile) && /^(LICENSE|LICENCE|COPYING|NOTICE)([._ -].*)?$/i.test(path.basename(info.licenseFile))) candidates.add(path.resolve(info.licenseFile));
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isFile() && /^(LICENSE|LICENCE|COPYING|NOTICE)([._ -].*)?$/i.test(name)) candidates.add(full);
    }
  }
  const files = [...candidates].sort();
  if (!files.length) { missing.push({package:key, licence:info.licenses || "Unknown", repository:info.repository || null}); continue; }
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8").trim();
    notices.push({package:key, licence:info.licenses || "Unknown", file:path.basename(file), text});
  }
}
const out = [
  "# TAAL LAB — third-party package notices", "",
  "Generated from the exact installed npm dependency tree by GitHub Actions. Preserve this file with any distribution that includes the corresponding packages, subject to the licence terms.", "",
  "This generated bundle includes standalone LICENSE, LICENCE, COPYING and NOTICE files found in package roots. It does not independently determine which packages are shipped in each product or whether every package licence requirement is satisfied.", "",
  "## Packages with standalone licence/notice files", ""
];
for (const item of notices) {
  out.push("### " + item.package, "", "Declared licence: `" + item.licence + "`", "", "Source file: `" + item.file + "`", "", "~~~~text", item.text, "~~~~", "");
}
out.push("## Packages requiring manual licence-text follow-up", "",
  "No standalone licence/notice file matching the generator rules was found in the package root. Check package metadata, README notices and upstream licence files before distribution.", "");
for (const item of missing) out.push("- `" + item.package + "` — `" + item.licence + "`" + (item.repository ? " — " + item.repository : ""));
fs.writeFileSync(".audit/THIRD-PARTY-NOTICES.md", out.join("\n"));
fs.writeFileSync(".audit/third-party-notices-summary.json", JSON.stringify({packages:packages.length, packagesWithNotices:new Set(notices.map(x=>x.package)).size, noticeFiles:notices.length, missing}, null, 2));
console.log("Generated notice bundle: " + new Set(notices.map(x=>x.package)).size + "/" + packages.length + " packages have standalone notice files; " + missing.length + " need manual review.");
