// Contact sheets of every cut-in title (Ultimate, Kinjutsu and signature), frozen once the text is fully revealed.
//   node tests/titles.js           -> tests/out/titles_ult_1.png ..., titles_super_1.png ..., titles_sig_1.png ...
// Also prints any title whose laid-out lines overflow the title box.
const { open, writeDataURL } = require('./lib');
(async () => {
  const { browser, page, errors } = await open();
  for (const kind of ['ult', 'super', 'sig']) {
    const res = await page.evaluate(kind => {
      const per = 20, cols = 4, tw = 400, th = 225, out = [], over = [];
      const ids = ROSTER.map(f => f.id);
      for (let s = 0; s * per < ids.length; s++) {
        const frames = [];
        ids.slice(s * per, s * per + per).forEach(id => {
          const A = ROSTER.find(f => f.id === id), cv = document.createElement('canvas'); cv.width = 800; cv.height = 450;
          const st = new Stage(cv, A, ROSTER[0], { auto: false });
          const F = st.f[0];
          if (kind === 'ult' || kind === 'super') { const u = kind === 'super' ? supOf(A) : ultOf(A), sup = kind === 'super'; st.ultCut = { f: F, name: u.n, col: u.c || F.fx.c, col2: u.c2 || F.fx.c2 || '#ffffff', sup, t: sup ? 2340 : 1950, dur: sup ? 3000 : 2500 }; }
          else st.cut = { f: F, name: A.sig, col: F.fx.c, t: 500, dur: 950 };
          st.draw();
          if (kind !== 'sig' && st.ultCut.lay) { const L = st.ultCut.lay; if (L.over) over.push(id + ': ' + L.lines.join(' / ') + ' @' + L.fs + 'px'); }
          const c = document.createElement('canvas'); c.width = tw; c.height = th; c.getContext('2d').drawImage(cv, 0, 0, tw, th);
          frames.push({ t: 0, c }); st.destroy();
        });
        const sh = T.sheet(frames, cols, `${kind} cut-ins ${s * per + 1}-${Math.min(ids.length, s * per + per)}: ` + ids.slice(s * per, s * per + per).join(', '));
        out.push(sh);
      }
      return { out, over };
    }, kind);
    res.out.forEach((u, i) => console.log(writeDataURL(`titles_${kind}_${i + 1}.png`, u)));
    if (res.over.length) console.log('OVERFLOW:\n' + res.over.join('\n'));
  }
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
