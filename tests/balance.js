// Balance report from the real simFight(): Ultimate rate, KO rate, upsets, champion spread.
//   node tests/balance.js [brackets=300] [fights=5000]
// Targets (see CLAUDE.md): ~half of fights contain an Ultimate, 25+ distinct champions over 300
// 64-brackets, no fighter over ~20% of titles. Exits 1 if a target is clearly missed.
const { open } = require('./lib');
(async () => {
  const nb = +(process.argv[2] || 300), nf = +(process.argv[3] || 5000);
  const { browser, page } = await open({ offline: true });
  const r = await page.evaluate(([nb, nf]) => {
    let ult = 0, ultLand = 0, ko = 0, turns = 0, upsets = 0, uneven = 0, surv = 0;
    for (let i = 0; i < nf; i++) {
      const A = pick(ROSTER); let B = pick(ROSTER); while (B.base === A.base) B = pick(ROSTER);
      const s = simFight(A, B);
      if (s.log.some(e => e.mv === 'ult')) ult++;
      if (s.log.some(e => e.mv === 'ult' && !e.dodge)) ultLand++;
      if (s.ko) ko++; turns += s.turns;
      if (Math.abs(A.ovr - B.ovr) >= 6) { uneven++; if (s.winner.ovr + 6 <= s.loser.ovr) upsets++; }
    }
    const champs = {}, byBase = {}, edo = { n: 0 };
    for (let b = 0; b < nb; b++) {
      let list = shuffle(BASES.map(base => pick(ROSTER.filter(f => f.base === base))));
      while (list.length > 1) { const nx = []; for (let i = 0; i < list.length; i += 2) nx.push(simFight(list[i], list[i + 1]).winner); list = nx; }
      const c = list[0]; champs[c.id] = (champs[c.id] || 0) + 1; byBase[c.base] = (byBase[c.base] || 0) + 1; if (c.tags.includes('Edo')) edo.n++;
    }
    const top = Object.entries(champs).sort((a, b) => b[1] - a[1]);
    return { nf, nb, ult: ult / nf, ultLand: ultLand / nf, ko: ko / nf, turns: turns / nf, upset: upsets / Math.max(1, uneven), distinct: top.length, top: top.slice(0, 10), topBase: Object.entries(byBase).sort((a, b) => b[1] - a[1]).slice(0, 5), edo: edo.n / nb };
  }, [nb, nf]);
  const pct = x => (x * 100).toFixed(1) + '%';
  console.log(`${r.nf} random fights: Ultimate in ${pct(r.ult)} (lands ${pct(r.ultLand)}), KO ${pct(r.ko)}, ${r.turns.toFixed(1)} turns avg, upset rate ${pct(r.upset)} of uneven matchups`);
  console.log(`${r.nb} 64-brackets: ${r.distinct} distinct champions, Edo champions ${pct(r.edo)}`);
  console.log('top champions: ' + r.top.map(([id, n]) => `${id} ${pct(n / r.nb)}`).join(', '));
  console.log('top characters: ' + r.topBase.map(([b, n]) => `${b} ${pct(n / r.nb)}`).join(', '));
  const miss = [];
  if (r.ult < .35 || r.ult > .65) miss.push('Ultimate rate outside 35-65%');
  if (nb >= 300 && r.distinct < 25) miss.push('fewer than 25 distinct champions');
  if (r.top[0][1] / r.nb > .22) miss.push(`${r.top[0][0]} wins over 22% of titles`);
  console.log(miss.length ? 'TARGETS MISSED: ' + miss.join('; ') : 'targets ok');
  await browser.close();
  process.exit(miss.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
