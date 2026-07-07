/**
 * Convierte scripts/manual/manual.html → Manual-Caja-Nequi-Biogreen.pdf
 * usando el Chrome del sistema (sin descargar Chromium).
 *   node scripts/manual/generate-pdf.mjs
 */
import puppeteer from "puppeteer-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error("No se encontró Chrome ni Edge.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, "manual.html");
const outPath = path.resolve(here, "..", "..", "Manual-Caja-Nequi-Biogreen.pdf");

const footer = `
  <div style="width:100%;font-size:8px;color:#9ca3af;font-family:'Segoe UI',Arial,sans-serif;
    padding:0 16mm;display:flex;justify-content:space-between;">
    <span>Manual de uso · Caja Nequi — Farmacia Biogreen</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;

const browser = await puppeteer.launch({ executablePath, headless: "new" });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: footer,
    margin: { top: "12mm", bottom: "16mm", left: "0mm", right: "0mm" },
  });
  console.log("✓ PDF generado:", outPath);
} finally {
  await browser.close();
}
