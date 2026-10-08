// Renders Stick Nodes .nodes figures (format version < 403, as most packs are) to a contact sheet, to use as
// reference art when redrawing a character. Format from sticknodes-rs (MIT, github.com/vinceTheProgrammer/sticknodes-rs).
//   node tests/nodes.js <dir-with-.nodes> tests/out/nodes.png      (PICK=sennin,hokage W=420 H=900 for a subset, bigger)
const fs = require('fs'), path = require('path');
const { open } = require('./lib');
(async () => {
  const [dir, out] = process.argv.slice(2);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.nodes')).sort();
  const pickN = (process.env.PICK || '').split(',').filter(Boolean); const data = files.filter(f => !pickN.length || pickN.some(p => f.includes(p))).map(f => ({ name: f.replace('.nodes', ''), W: process.env.W, H: process.env.H, b64: fs.readFileSync(path.join(dir, f)).toString('base64') }));
  const { browser, page, errors } = await open({ offline: true });
  const res = await page.evaluate(data => {
    const parse = b64 => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const dv = new DataView(u.buffer); let o = 0;
      const i8 = () => dv.getInt8(o++), u8 = () => dv.getUint8(o++), i32 = () => { const v = dv.getInt32(o); o += 4; return v; }, f32 = () => { const v = dv.getFloat32(o); o += 4; return v; };
      const col = () => { const a = u8(), b = u8(), g = u8(), r = u8(); return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`; };
      const ver = i32(); if (ver >= 403) throw new Error('version ' + ver);
      const scale = f32(), fcol = col(), nodes = [];
      const node = (parent) => {
        const n = { parent }; n.type = i8(); n.di = i32(); n.st = u8(); n.str = u8(); if (ver >= 248) n.ss = u8(); if (ver >= 252) n.dnss = u8();
        n.useSegCol = u8(); if (ver >= 256) n.circOut = u8(); if (ver >= 176) { n.grad = u8(); n.revGrad = u8(); }
        n.useSegScale = u8(); n.x = f32(); n.y = f32(); n.scale = f32(); n.dlen = f32(); n.len = f32(); n.dth = i32(); n.th = i32();
        if (ver >= 320) i32(); if (ver >= 256) { u8(); dv.getInt16(o); o += 2; } if (ver >= 300) u8(); if (ver >= 256) { n.trap = f32(); dv.getInt16(o); o += 2; }
        if (ver >= 248) n.dla = f32(); n.la = f32(); if (ver >= 248) n.da = f32();
        n.col = col(); if (ver >= 176) n.gcol = col(); if (ver >= 256) n.ocol = col();
        const kids = i32(); nodes.push(n); n.i = nodes.length - 1;
        for (let k = 0; k < kids; k++) node(n.i);
      };
      node(-1);
      const polys = [];
      if (ver >= 230 && o < u.length) { const np = i32(); for (let p = 0; p < np; p++) { const anchor = i32(), c = col(), use = u8(), cnt = i32(), idx = []; for (let k = 0; k < cnt; k++) idx.push(i32()); polys.push({ anchor, c, use, idx }); } }
      return { ver, scale, fcol, nodes, polys, rest: u.length - o };
    };
    const W = +(data[0].W || 360), H = +(data[0].H || 520), out = [];
    const sheet = document.createElement('canvas'); sheet.width = W * data.length; sheet.height = H; const g = sheet.getContext('2d'); g.fillStyle = '#d8c8a4'; g.fillRect(0, 0, sheet.width, H);
    const info = [];
    data.forEach((d, k) => {
      const F = parse(d.b64); const N = F.nodes;
      N.forEach(n => { if (n.parent < 0) { n.X = 0; n.Y = 0; } else { const p = N[n.parent]; n.X = p.X + n.x; n.Y = p.Y + n.y; } });
      const xs = N.map(n => n.X), ys = N.map(n => n.Y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const s = Math.min((W - 60) / (maxX - minX || 1), (H - 80) / (maxY - minY || 1));
      const T = (x, y) => [k * W + 30 + (x - minX) * s, 50 + (maxY - y) * s];
      const byDi = new Map(N.map(n => [n.di, n]));
      const items = N.filter(n => n.parent >= 0).map(n => ({ di: n.di, draw: () => {
        const p = N[n.parent], [x0, y0] = T(p.X, p.Y), [x1, y1] = T(n.X, n.Y), th = Math.max(1, n.th * (n.useSegScale ? n.scale : 1) * s * .5), c = n.useSegCol ? n.col : F.fcol; // figure colour unless the node has its own
        g.save(); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = th;
        if (n.type === 0 || n.type === 1) { g.lineCap = n.type === 0 ? 'round' : 'butt'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
        else if (n.type === 2 || n.type === 4) { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2; g.beginPath(); g.arc(cx, cy, Math.max(.5, r), 0, 6.283); g.fill(); } // Stick Nodes circles are filled
        else if (n.type === 5) { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2; g.translate(cx, cy); g.rotate(Math.atan2(y1 - y0, x1 - x0)); g.beginPath(); g.ellipse(0, 0, Math.max(.5, r), Math.max(.5, th / 2), 0, 0, 6.283); g.fill(); }
        else if (n.type === 3) { const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * th / 2, ny = Math.cos(a) * th / 2; g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x0 - nx, y0 - ny); g.lineTo(x1, y1); g.closePath(); g.fill(); }
        else if (n.type === 6) { const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * th / 2, ny = Math.cos(a) * th / 2, r = n.trap || 1; g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx * r, y1 + ny * r); g.lineTo(x1 - nx * r, y1 - ny * r); g.lineTo(x0 - nx, y0 - ny); g.closePath(); g.fill(); }
        g.restore(); } }));
      F.polys.forEach(P => items.push({ di: (byDi.get(P.anchor) || { di: P.anchor }).di - .5, draw: () => { g.fillStyle = P.c; g.beginPath(); P.idx.forEach((di, j) => { const n = byDi.get(di); if (!n) return; const [x, y] = T(n.X, n.Y); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); } }));
      items.sort((a, b) => a.di - b.di).forEach(it => it.draw());
      g.fillStyle = '#000'; g.font = '16px sans-serif'; g.fillText(d.name, k * W + 10, 22);
      const types = {}; N.forEach(n => types[n.type] = (types[n.type] || 0) + 1);
      const cols = {}; N.forEach(n => cols[n.col] = (cols[n.col] || 0) + 1); F.polys.forEach(p => cols[p.c] = (cols[p.c] || 0) + 1);
      info.push({ name: d.name, ver: F.ver, nodes: N.length, polys: F.polys.length, rest: F.rest, types, colors: Object.entries(cols).sort((a, b) => b[1] - a[1]).slice(0, 14) });
    });
    return { url: sheet.toDataURL('image/png'), info };
  }, data);
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(JSON.stringify(res.info, null, 0).replace(/\},\{/g, '},\n{'));
  if (errors.length) console.log(errors);
  await browser.close();
})();
