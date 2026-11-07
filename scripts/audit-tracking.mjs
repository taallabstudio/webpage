import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["public", "src", "worker", "admin"];
const rootFiles = ["index.html", "ocean.html", "404.html"];
const ignored = new Set(["node_modules", "dist", ".git", "target"]);
const extensions = new Set([".html", ".js", ".jsx", ".ts", ".tsx", ".css"]);
const blocked = [
  ["Google Tag Manager", /googletagmanager\.com/i],
  ["Google Analytics", /google-analytics\.com|analytics\.google\.com|\bgtag\s*\(/i],
  ["Meta Pixel", /connect\.facebook\.net|facebook\.com\/tr|\bfbq\s*\(/i],
  ["TikTok Pixel", /analytics\.tiktok\.com|\bttq\s*\./i],
  ["Hotjar", /hotjar\.com|\bhj\s*\(/i],
  ["Microsoft Clarity", /clarity\.ms|\bclarity\s*\(/i],
  ["Segment", /segment\.com|segment\.io/i],
  ["Mixpanel", /mixpanel\.com/i],
  ["Amplitude", /amplitude\.com/i],
  ["PostHog", /posthog\.com|posthog\.init\s*\(/i],
  ["Plausible", /plausible\.io/i],
  ["Matomo", /matomo/i],
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const files = [...rootFiles, ...((await Promise.all(roots.map(walk))).flat())];
const findings = [];
for (const file of files) {
  let content;
  try { content = await readFile(file, "utf8"); } catch { continue; }
  for (const [name, pattern] of blocked) {
    if (pattern.test(content)) findings.push({ file, name });
  }
}

if (findings.length) {
  for (const finding of findings) process.stderr.write(`Blocked optional tracker candidate: ${finding.name} in ${finding.file}\n`);
  process.stderr.write("Review the integration and implement consent gating before enabling it.\n");
  process.exitCode = 1;
} else {
  process.stdout.write("Tracking audit passed: no known optional analytics or advertising tracker code found in runtime sources.\n");
}
