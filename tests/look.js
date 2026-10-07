// Close-up of one or more characters: portrait (cut-in size), face icon, and the in-fight figure
// in several poses at 3x, so drawing details can be judged.
//   node tests/look.js itachi1            -> tests/out/look_itachi1.png
//   node tests/look.js itachi1,pain,konan  (one row per character)
//   node tests/look.js crow,ant,kazekage   (puppet looks from PUP_LOOK: figure only)
const { open, writeDataURL } = require('./lib');
(async () => {
  const ids = (process.argv[2] || 'itachi1').split(',');
  const poses = (process.argv[3] || 'idle,punch,kick,cast,run,hurt').split(',');
  const { browser, page, errors } = await open();
  const url = await page.evaluate(([ids, poses]) => {
    const rowH = 360, pw = 300, fw = 190, W = pw + 110 + poses.length * fw;
    const s = document.createElement('canvas'); s.width = W; s.height = rowH * ids.length;
    const g = s.getContext('2d'); g.fillStyle = '#c9b48a'; g.fillRect(0, 0, s.width, s.height);
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450;
    ids.forEach((id, r) => {
      const pup = !ROSTER.some(x => x.id === id) && PUP_LOOK[id], f = pup ? ROSTER.find(x => x.base === 'kankuro') : ROSTER.find(x => x.id === id), y0 = r * rowH;
      const st = new Stage(cv, f, ROSTER[0], { auto: false });
      g.fillStyle = '#26323a'; g.fillRect(0, y0, pw, rowH - 6);
      if (!pup) {
        g.save(); g.beginPath(); g.rect(0, y0, pw, rowH - 6); g.clip(); drawPortrait(g, f, 130, y0 + 150, 70, 0, {}); g.restore();
        const img = new Image(); img.src = faceURL(f); g.drawImage(img, pw + 6, y0 + 6, 96, 96);
      }
      g.fillStyle = '#000'; g.font = '14px sans-serif'; g.fillText(pup ? 'puppet: ' + id : f.short, pw + 8, y0 + 120);
      poses.forEach((p, i) => {
        const fi = pup ? Object.assign(st.mkPup(st.f[0], id, 0), { scale: 1, lift: 0 }) : st.mk(f, 0); fi.x = 0; fi.pose = Object.assign({}, POSES[p]); fi.run = p === 'run';
        g.save(); g.translate(pw + 110 + i * fw + fw / 2 - 10, y0 + rowH - 20 - GY * 2.1); g.scale(2.1, 2.1); st.t = 300; st.drawFighter(g, fi); g.restore();
        g.fillStyle = '#000'; g.fillText(p, pw + 110 + i * fw + 8, y0 + 18);
      });
      st.destroy();
    });
    return s.toDataURL('image/png');
  }, [ids, poses]);
  console.log(writeDataURL(`look_${ids.join('_')}.png`, url));
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
