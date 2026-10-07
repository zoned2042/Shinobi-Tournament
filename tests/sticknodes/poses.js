// Each Stick Nodes figure drawn by Stage.drawFighter in several POSES, to check the bones were found right.
//   node tests/sticknodes/poses.js [ids]   -> tests/out/sn_poses.png
const fs = require('fs'), path = require('path');
const { open } = require('../lib');
(async () => {
  const [idsArg] = process.argv.slice(2), out = path.join(__dirname, '..', 'out', 'sn_poses.png');
  const { browser, page, errors } = await open({ offline: true });
  const url = await page.evaluate(([idsArg]) => {
    const ids = idsArg ? idsArg.split(',') : ROSTER.filter(f => snFig(f.id)).map(f => f.id);
    const poses = ['idle', 'punch', 'kick', 'run', 'cast', 'hurt', 'ko'], cw = 150, rh = 230, W = 120 + poses.length * cw;
    const s = document.createElement('canvas'); s.width = W; s.height = rh * ids.length; const g = s.getContext('2d'); g.fillStyle = '#c9b48a'; g.fillRect(0, 0, s.width, s.height);
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450;
    ids.forEach((id, r) => {
      const f = ROSTER.find(x => x.id === id); const st = new Stage(cv, f, ROSTER[0], { auto: false });
      g.fillStyle = '#000'; g.font = '13px sans-serif'; g.fillText(id + (st.f[0].sn ? '' : ' (no figure)'), 6, r * rh + 18);
      poses.forEach((p, i) => { const fi = st.mk(f, 0); fi.x = 0; fi.pose = Object.assign({}, POSES[p]); fi.run = p === 'run';
        g.save(); g.translate(120 + i * cw + cw / 2 - 10, r * rh + rh - 14 - GY * 1.15); g.scale(1.15, 1.15); st.t = 300; st.drawFighter(g, fi); g.restore();
        if (!r) { g.fillStyle = '#000'; g.fillText(p, 120 + i * cw + 8, 14); } });
      st.destroy();
    });
    return s.toDataURL('image/png');
  }, [idsArg || '']);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out);
  if (errors.length) console.log(errors.slice(0, 5));
  await browser.close();
})();
