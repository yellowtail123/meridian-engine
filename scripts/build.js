// Build script: copies vanilla files to dist/ and removes the AI Assistant tab
// for the public deployment. Everything else stays identical.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Files to copy
const FILES = [
  "meridian.css",
  "meridian-core.js",
  "meridian-data.js",
  "meridian-features.js",
  "meridian-workshop.js",
  "meridian-stats.js",
  "meridian-ui.js",
  "meridian-brainmap.js",
  "meridian-ecostats.js",
  "meridian-fielddata.js",
  "meridian-gapfill.js",
  "meridian-padi.js",
  "meridian-repro.js",
  "meridian-session.js",
  "meridian-studydesign.js",
  "manifest.json",
  "sw.js",
  "_headers",
];

// Clean and create dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// Copy static files
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, f));
    console.log("  copied", f);
  }
}

// Copy workers/ directory if it exists
const workersDir = path.join(ROOT, "workers");
if (fs.existsSync(workersDir)) {
  fs.mkdirSync(path.join(DIST, "workers"), { recursive: true });
  for (const f of fs.readdirSync(workersDir)) {
    fs.copyFileSync(path.join(workersDir, f), path.join(DIST, "workers", f));
    console.log("  copied workers/" + f);
  }
}

// Process meridian.html — strip AI tab button and panel, then save as index.html
let html = fs.readFileSync(path.join(ROOT, "meridian.html"), "utf8");

// Remove AI tab button
html = html.replace(/<button class="tab"[^>]*data-tab="ai"[^>]*>.*?<\/button>/s, "");

// Remove AI tab panel (from <div class="tp" id="tab-ai"> to its closing </div> before </main>)
html = html.replace(/<div class="tp" id="tab-ai">[\s\S]*?(?=<\/main>)/, "");

// Remove api.anthropic.com from CSP connect-src
html = html.replace(/\s*api\.anthropic\.com/g, "");

// Add service worker cleanup
html = html.replace(
  '<script src="meridian-core.js">',
  '<script>if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(w=>w.unregister()))}</script>\n<script src="meridian-core.js">'
);

// Write as both index.html (for Cloudflare Pages default) and meridian.html
fs.writeFileSync(path.join(DIST, "index.html"), html);
fs.writeFileSync(path.join(DIST, "meridian.html"), html);
console.log("  built index.html + meridian.html (AI tab removed)");

console.log("\nBuild complete → dist/");
