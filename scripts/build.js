// Build script: copies vanilla files to dist/ for public deployment.
// Keeps the AI tab but updates its intro for BYOK (bring your own key) clarity.

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
  "privacy.html",
  "terms.html",
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

// Process meridian.html
let html = fs.readFileSync(path.join(ROOT, "meridian.html"), "utf8");

// Replace the AI tab intro with BYOK-friendly messaging
const oldIntro = `<div style="margin-bottom:14px;padding:14px 18px;background:linear-gradient(135deg,var(--am),rgba(123,158,135,.06));border:1px solid var(--ab);border-radius:var(--rd);font-size:13px;color:var(--ts);line-height:1.65"><b style="color:var(--ac)">AI Research Assistant.</b> Ask questions about your library, request statistical advice, generate R/Python code for your data, or explore methods. The assistant has access to your saved papers, environmental data, and analysis results.</div>`;

const newIntro = `<div style="margin-bottom:14px;padding:14px 18px;background:linear-gradient(135deg,var(--am),rgba(123,158,135,.06));border:1px solid var(--ab);border-radius:var(--rd);font-size:13px;color:var(--ts);line-height:1.65"><b style="color:var(--ac)">AI Research Assistant.</b> Ask questions about your library, request statistical advice, generate R/Python code for your data, or explore methods. The assistant has access to your saved papers, environmental data, and analysis results.<div style="margin-top:10px;padding:10px 14px;background:var(--bs);border:1px solid var(--sb);border-radius:6px;font-size:12px;line-height:1.6"><span style="color:var(--sg);font-weight:600">Bring Your Own Key.</span> This feature requires your own <a href="https://console.anthropic.com/" target="_blank" rel="noopener" style="color:var(--ac)">Anthropic API key</a>. Your key is stored <b style="color:var(--ac)">in memory only</b> — it is never saved to disk, never sent to our servers, and is automatically cleared when you close this tab. All API calls go directly from your browser to Anthropic.</div></div>`;

html = html.replace(oldIntro, newIntro);

// Also update the API key settings hint
html = html.replace(
  `Model: Claude Sonnet 4.6 — key required for AI features`,
  `Model: Claude Sonnet 4.6 — your key stays in memory only and is cleared when you close this tab`
);

// Update footer links to standalone pages
html = html.replace(
  `<a href="#" onclick="event.preventDefault();showPrivacyPolicy()" style="color:var(--tm);text-decoration:underline">Privacy</a>`,
  `<a href="/privacy" style="color:var(--tm);text-decoration:underline">Privacy</a>`
);
html = html.replace(
  `<a href="#" onclick="event.preventDefault();showTerms()" style="color:var(--tm);text-decoration:underline">Terms</a>`,
  `<a href="/terms" style="color:var(--tm);text-decoration:underline">Terms</a>`
);

// Add service worker cleanup
html = html.replace(
  '<script src="meridian-core.js">',
  '<script>if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(w=>w.unregister()))}</script>\n<script src="meridian-core.js">'
);

// Write as both index.html and meridian.html
fs.writeFileSync(path.join(DIST, "index.html"), html);
fs.writeFileSync(path.join(DIST, "meridian.html"), html);
console.log("  built index.html + meridian.html (AI tab with BYOK notice)");

// Patch meridian-core.js: replace _keyVault with a memory-only version
// so API keys are never persisted to localStorage/IndexedDB
let core = fs.readFileSync(path.join(DIST, "meridian-core.js"), "utf8");
const vaultStart = core.indexOf("const _keyVault=(function(){");
const vaultEnd = core.indexOf("})();", vaultStart);
if (vaultStart >= 0 && vaultEnd >= 0) {
  const memoryVault = `const _keyVault=(function(){
  const _mem={};
  return{
    async store(name,plaintext){_mem[name]=plaintext},
    async retrieve(name){return _mem[name]||null},
    remove(name){delete _mem[name]}
  };
})();`;
  core = core.slice(0, vaultStart) + memoryVault + core.slice(vaultEnd + 5);
  fs.writeFileSync(path.join(DIST, "meridian-core.js"), core);
  console.log("  patched meridian-core.js (memory-only key vault)");
}

console.log("\nBuild complete → dist/");
