// Contact sheet of every look: face icon (as used on cards/HUD) above the in-fight fighter.
//   node tests/portraits.js  -> tests/out/portraits.png
const { open, writeDataURL } = require('./lib');
(async () => {
  const { browser, page, errors } = await open();
  const url = await page.evaluate(() => {
    const cols = 13, cw = 120, ch = 250, rows = Math.ceil(ROSTER.length / cols);
    const s = document.createElement('canvas'); s.width = cols * cw; s.height = rows * ch;
    const g = s.getContext('2d'); g.fillStyle = '#26323a'; g.fillRect(0, 0, s.width, s.height);
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450;
    const st = new Stage(cv, ROSTER[0], ROSTER[1], { auto: false });
    ROSTER.forEach((f, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const img = new Image(); img.src = faceURL(f);
      g.drawImage(img, x + 12, y + 6, 96, 96);
      const fi = st.mk(f, 0); fi.x = 0;
      g.save(); g.translate(x + cw / 2, y + 230 - GY * 0.75); g.scale(.75, .75); st.t = 0; st.drawFighter(g, fi); g.restore();
      g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(f.short, x + cw / 2, y + 244);
      g.strokeStyle = '#000'; g.strokeRect(x + .5, y + .5, cw - 1, ch - 1);
    });
    return s.toDataURL('image/png');
  });
  console.log(writeDataURL('portraits.png', url));
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
