// Plays every version's staged moves in several variants and checks nothing crashes, hangs or leaks.
//   node tests/moves.js all            (sig + ult + basic moves + focus, every version; takes a few minutes)
//   node tests/moves.js ult 0 3        (shard 1 of 3: run three shards in parallel to go faster)
//   node tests/moves.js sig itachi1    (one version)
// Variants alternate sides: hit/ko are played by the left fighter, dodge/crit by the right one.
// "skip" presses Skip animation part-way through and expects the entry to finish at once.
const { open, shard } = require('./lib');

(async () => {
  const [mode = 'all', a, b] = process.argv.slice(2);
  const { browser, page, errors } = await open({ offline: true });
  let ids = await page.evaluate(() => ROSTER.map(f => f.id));
  if (a && isNaN(+a)) ids = a.split(','); else ids = shard(ids, +a, +b);
  const mvs = mode === 'all' ? ['sig', 'ult', 'tai', 'nin', 'gen', 'focus'] : mode === 'basic' ? ['tai', 'nin', 'gen', 'focus'] : [mode];
  const variants = ['hit', 'dodge', 'ko', 'crit', 'skip'];
  let runs = 0, fails = 0; const t0 = Date.now();
  for (const id of ids) for (const mv of mvs) for (const v of (mv === 'sig' || mv === 'ult' ? variants : mv === 'focus' ? ['hit', 'skip'] : ['hit', 'dodge', 'ko'])) {
    const r = await page.evaluate(([id, mv, v]) => {
      const variant = v === 'skip' ? 'hit' : v, att = (v === 'dodge' || v === 'crit') ? 1 : 0;
      return T.play(id, T.foe(id), mv, variant, { att, skipAt: v === 'skip' ? 1200 : 0, settle: 1500 }).then(r => {
        r.bad = T.check(r);
        if (v === 'skip' && r.t > 1300) r.bad.push('skip did not end the entry (' + r.t + ' ms)');
        return r;
      });
    }, [id, mv, v]);
    runs++;
    if (r.bad.length) { fails++; console.log(`FAIL ${id} ${mv} ${v}: ${r.bad.join('; ')}`); }
  }
  console.log(`${runs} runs, ${fails} failed, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (errors.length) { console.log('page errors:\n' + errors.join('\n')); fails++; }
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
