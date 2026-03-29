/**
 * Generate PWA icons from an inline SVG.
 * Uses Node canvas-free approach: writes SVG files that can be converted,
 * or for simplicity we write PNGs using a tiny data-URL approach via the
 * built-in sharp-less SVG → PNG pipeline.
 *
 * Since we may not have sharp/canvas installed, we'll output SVGs and use
 * the `resvg-js` or a simpler approach. For maximum portability, we just
 * create the SVG master and let the browser subagent screenshot them.
 *
 * Actually simplest: write the SVG directly, and for PNG we'll use a quick
 * HTML-to-screenshot approach via the browser tool.
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");

// Modern, minimal barbell icon – geometric circles + bar
// Blue accent on dark background matching the app theme
function makeSvg(size) {
  const pad = size * 0.15;
  const barY = size / 2;
  const barHeight = size * 0.08;
  const plateRadius = size * 0.22;
  const plateX1 = size * 0.28;
  const plateX2 = size * 0.72;
  const barX1 = plateX1;
  const barX2 = plateX2;
  const cornerRadius = size * 0.18;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#131519"/>
  <!-- Bar -->
  <rect x="${barX1}" y="${barY - barHeight/2}" width="${barX2 - barX1}" height="${barHeight}" rx="${barHeight/2}" fill="#4A7AE8" opacity="0.7"/>
  <!-- Left plate -->
  <circle cx="${plateX1}" cy="${barY}" r="${plateRadius}" fill="none" stroke="#4A7AE8" stroke-width="${size * 0.04}"/>
  <circle cx="${plateX1}" cy="${barY}" r="${plateRadius * 0.55}" fill="#4A7AE8" opacity="0.15"/>
  <!-- Right plate -->
  <circle cx="${plateX2}" cy="${barY}" r="${plateRadius}" fill="none" stroke="#4A7AE8" stroke-width="${size * 0.04}"/>
  <circle cx="${plateX2}" cy="${barY}" r="${plateRadius * 0.55}" fill="#4A7AE8" opacity="0.15"/>
  <!-- Center grip lines -->
  <rect x="${size * 0.44}" y="${barY - size*0.06}" width="${size*0.02}" height="${size*0.12}" rx="${size*0.005}" fill="#4A7AE8" opacity="0.4"/>
  <rect x="${size * 0.49}" y="${barY - size*0.06}" width="${size*0.02}" height="${size*0.12}" rx="${size*0.005}" fill="#4A7AE8" opacity="0.4"/>
  <rect x="${size * 0.54}" y="${barY - size*0.06}" width="${size*0.02}" height="${size*0.12}" rx="${size*0.005}" fill="#4A7AE8" opacity="0.4"/>
</svg>`;
}

const sizes = [
  { name: "icon-192.svg", size: 192 },
  { name: "icon-512.svg", size: 512 },
  { name: "apple-touch-icon.svg", size: 180 },
];

for (const { name, size } of sizes) {
  const svg = makeSvg(size);
  writeFileSync(join(outDir, name), svg, "utf8");
  console.log(`✓ ${name} (${size}×${size})`);
}

console.log("\nSVG icons generated. Convert to PNG for production use.");
