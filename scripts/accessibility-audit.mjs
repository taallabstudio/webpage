import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const port = 4173;
const server = spawn("npx", ["vite", "preview", "--host", "0.0.0.0", "--port", String(port), "--strictPort"], {
  stdio: "inherit",
  env: { ...process.env, BROWSER: "none" },
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error("Vite preview server exited before becoming ready.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/privacy.html`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(500);
  }
  if (!ready) throw new Error("Vite preview server did not become ready.");

  browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP ocean.taallab.in 127.0.0.1"],
  });
  const pages = [
    ["Main website", `http://127.0.0.1:${port}/`],
    ["Sign in", `http://127.0.0.1:${port}/login`],
    ["Shop", `http://127.0.0.1:${port}/shop.html`],
    ["Checkout", `http://127.0.0.1:${port}/checkout.html`],
    ["Download", `http://127.0.0.1:${port}/download.html`],
    ["Privacy policy", `http://127.0.0.1:${port}/privacy.html`],
    ["Terms", `http://127.0.0.1:${port}/terms.html`],
    ["Refunds", `http://127.0.0.1:${port}/refunds.html`],
    ["Subprocessors", `http://127.0.0.1:${port}/subprocessors.html`],
    ["OCEAN", `http://ocean.taallab.in:${port}/ocean.html`],
  ];
  let total = 0;
  const report = [];
  for (const [label, url] of pages) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1000);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    total += results.violations.length;
    report.push({
      page: label,
      url,
      violations: results.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary || "" })),
      })),
    });
    console.log(`\n[AXE] ${label}: ${results.violations.length} violation(s)`);
    for (const violation of results.violations) {
      console.log(`- ${violation.id} (${violation.impact}): ${violation.help}`);
      for (const node of violation.nodes.slice(0, 8)) {
        console.log(`  target: ${node.target.join(", ")}`);
        console.log(`  summary: ${node.failureSummary?.replace(/\s+/g, " ").slice(0, 320) || ""}`);
      }
      if (violation.nodes.length > 8) console.log(`  ... and ${violation.nodes.length - 8} more affected node(s)`);
    }
    await page.close();
  }
  await writeFile("/tmp/taallab-accessibility-report.json", JSON.stringify(report, null, 2), "utf8");
  console.log(`\nAccessibility audit complete. Total page-level violations: ${total}`);
  if (total > 0) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
