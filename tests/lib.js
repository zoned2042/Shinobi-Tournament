// Shared Playwright helpers for the test scripts. Loads index.html from disk and injects harness.js.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const NOISE = /fonts\.(googleapis|gstatic)\.com|Failed to load resource/;

function ensureOut() { fs.mkdirSync(OUT, { recursive: true }); return OUT; }

async function open(opts = {}) {
  const launch = {};
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }, opts.context || {}));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push('console: ' + m.text()); });
  if (opts.offline) await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  else if (process.env.HTTPS_PROXY) await page.route(/fonts\.(googleapis|gstatic)\.com/, fetchViaCurl);
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  // give the web fonts a chance (the canvas uses them for titles); fall back silently
  await page.evaluate(() => Promise.race([
    Promise.all([document.fonts.load('40px "Dela Gothic One"'), document.fonts.load('20px "Zen Kaku Gothic New"')]).then(() => document.fonts.ready),
    new Promise(r => setTimeout(r, 5000))
  ])).catch(() => {});
  await page.addScriptTag({ path: path.join(__dirname, 'harness.js') });
  return { browser, context, page, errors };
}

// Sandboxes that re-terminate TLS at a proxy: Chromium does not trust the proxy CA, curl does.
// Fetch Google Fonts with curl (verification stays on) and hand the bytes to the page.
async function fetchViaCurl(route) {
  const req = route.request(), url = req.url();
  const dir = path.join(OUT, '.fontcache'); fs.mkdirSync(dir, { recursive: true });
  const key = path.join(dir, crypto.createHash('sha1').update(url).digest('hex'));
  try {
    if (!fs.existsSync(key)) {
      execFileSync('curl', ['-sSf', '--max-time', '20', '-A', req.headers()['user-agent'] || 'Mozilla/5.0', '-o', key, url]);
    }
    const ct = /googleapis/.test(url) ? 'text/css; charset=utf-8' : 'font/woff2';
    await route.fulfill({ status: 200, body: fs.readFileSync(key), headers: { 'content-type': ct, 'access-control-allow-origin': '*' } });
  } catch (e) { await route.abort(); }
}

function writeDataURL(file, url) {
  ensureOut();
  const p = path.isAbsolute(file) ? file : path.join(OUT, file);
  fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
  return p;
}

// split a list for parallel shards: node x.js ... 1 3  -> second third
function shard(list, k, n) {
  if (n === undefined || isNaN(n)) return list;
  return list.filter((_, i) => i % n === k);
}

module.exports = { open, writeDataURL, ensureOut, shard, ROOT, OUT };
