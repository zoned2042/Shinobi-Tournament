// Capture contact sheets of a staged move so you can LOOK at it.
//   node tests/frames.js kaguya ult            -> tests/out/frames_kaguya_ult_hit.png
//   node tests/frames.js itachi1 sig dodge
//   node tests/frames.js all ult ko            -> one sheet per version
//   node tests/frames.js styles ult crit       -> one sheet per Ultimate style (first user of each)
// Variants: hit | dodge | ko | crit | guard | surv.  Options: --every 250  --cols 5  --theme 0..3  --att 1
//   --vs hashiramaE : opponent (default kakashi1)
//   --at 3000,4400 : only those moments, full size (800 px wide; --tw to change) -> frames_<id>_<mv>_<variant>_at.png
const { open, writeDataURL, shard } = require('./lib');

(async () => {
  const args = process.argv.slice(2), flags = {};
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { flags[args[i].slice(2)] = args[i + 1]; args.splice(i, 2); i--; }
  const [who = 'kaguya', mv = 'ult', variant = 'hit', k, n] = args;
  const { browser, page, errors } = await open();
  let ids;
  if (who === 'all') ids = await page.evaluate(() => ROSTER.map(f => f.id));
  else if (who === 'styles') ids = await page.evaluate(m => {
    const seen = new Map();
    ROSTER.forEach(f => {
      const key = m === 'ult' ? ultOf(f).s : ((SIGMAP[f.id] || SIGMAP[f.base] || ['generic-' + f.sigType])[0]);
      if (!seen.has(key)) seen.set(key, f.id);
    });
    return [...seen.values()];
  }, mv);
  else ids = who.split(',');
  ids = shard(ids, +k, +n);
  const atList = flags.at ? flags.at.split(',').map(Number) : null;
  const every = atList && !flags.every ? 0 : +(flags.every || (mv === 'ult' ? 250 : 120));
  const from = mv === 'ult' ? 2500 : mv === 'sig' ? 950 : 0;
  for (const id of ids) {
    const r = await page.evaluate(([id, mv, variant, every, from, f]) => T.play(id, f.vs || T.foe(id), mv, variant, {
      every, from, at: f.atList || (mv === 'ult' ? [1900] : mv === 'sig' ? [600] : []), cols: +(f.cols || (f.atList ? Math.min(2, f.atList.length) : 5)),
      tw: +(f.tw || (f.atList ? 800 : 320)), theme: +(f.theme || 0), att: +(f.att || 0), settle: f.atList ? 0 : 600,
      title: `${id} ${mv} ${variant}: ${mv === 'ult' ? ultOf(ROSTER.find(x => x.id === id)).n : ''}`
    }).then(r => { r.bad = T.check(r); return r; }), [id, mv, variant, every, from, Object.assign({ atList }, flags)]);
    const file = writeDataURL(`frames_${id}_${mv}_${variant}${atList ? '_at' : ''}.png`, r.sheet);
    console.log(`${id.padEnd(12)} ${(r.t / 1000).toFixed(1)}s ${r.bad.length ? 'PROBLEMS: ' + r.bad.join('; ') : 'ok'}  ${file}`);
  }
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
