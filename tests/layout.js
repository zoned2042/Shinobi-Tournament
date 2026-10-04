// Phone-width layout check: screenshots of the draft, bracket and a live fight, plus a horizontal-overflow scan.
//   node tests/layout.js [width=390] [height=844]  -> tests/out/layout_<w>_*.png
const { open } = require('./lib');
const path = require('path');
(async () => {
  const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844);
  const { browser, page, errors } = await open({ context: { viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
  const shot = async name => { const f = path.join(__dirname, 'out', `layout_${W}_${name}.png`); await page.screenshot({ path: f }); console.log(f); };
  const problems = [];
  const overflow = async where => {
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, bad = [];
      document.querySelectorAll('body *').forEach(el => {
        const b = el.getBoundingClientRect(); if (!b.width) return;
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'hidden' || o === 'scroll') { clipped = true; break; } p = p.parentElement; }
        if (!clipped && (b.right > vw + 1 || b.left < -1)) bad.push(`${el.tagName.toLowerCase()}.${el.className || ''} [${Math.round(b.left)}..${Math.round(b.right)}]`);
      });
      return { scroll: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 8) };
    });
    if (r.scroll > r.vw || r.bad.length) problems.push(`${where}: page ${r.scroll}px wide in a ${r.vw}px viewport; ${r.bad.join(', ')}`);
  };
  const tap = async sel => { await page.locator(sel).first().tap(); };

  await shot('1_draft_top'); await overflow('draft');
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(150); await shot('2_draft_grid');
  await tap('[data-action="random"]'); await page.waitForTimeout(100);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(150); await shot('3_draft_bottom'); await overflow('draft, squad picked');
  await tap('[data-action="start"]'); await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('4_bracket'); await overflow('bracket');
  await tap('[data-action="speed"][data-val="fast"]');
  await tap('[data-action="watch"]');
  // wait until a staged move with a cut-in is on screen, else just a few seconds in
  await page.waitForFunction(() => state.stage && (state.stage.cut || state.stage.ultCut), null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.getElementById('arena').scrollIntoView()); await page.waitForTimeout(250);
  await shot('5_fight'); await overflow('fight');
  await page.waitForTimeout(1500); await shot('6_fight_later');
  await tap('[data-action="skip"]').catch(() => {});
  await page.waitForFunction(() => !state.busy, null, { timeout: 20000 }).catch(() => problems.push('fight did not finish after skip'));
  await tap('[data-action="simall"]'); await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('7_champion'); await overflow('champion');
  const tapTargets = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.height < 36 || r.width < 36); }).map(b => b.textContent.trim().slice(0, 20) + ` ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`).slice(0, 10));
  if (tapTargets.length) console.log('small tap targets: ' + tapTargets.join(' | '));
  if (errors.length) problems.push(...errors);
  console.log(problems.length ? 'LAYOUT PROBLEMS:\n' + problems.join('\n') : 'layout ok');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
