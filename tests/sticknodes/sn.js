// Stick Nodes .nodes parser for Node (format versions < 403). Same layout as tests/nodes.js.
const fs = require('fs');
function parse(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); let o = 0;
  const i8 = () => dv.getInt8(o++), u8 = () => dv.getUint8(o++), i16 = () => { const v = dv.getInt16(o); o += 2; return v; }, i32 = () => { const v = dv.getInt32(o); o += 4; return v; }, f32 = () => { const v = dv.getFloat32(o); o += 4; return v; };
  const col = () => { const a = u8(), b = u8(), g = u8(), r = u8(); return [r, g, b, a]; };
  const ver = i32(); if (ver >= 403) throw new Error('version ' + ver);
  const scale = f32(), fcol = col(), nodes = [];
  const node = parent => {
    const n = { parent }; n.type = i8(); n.di = i32(); n.st = u8(); n.str = u8(); if (ver >= 248) n.ss = u8(); if (ver >= 252) n.dnss = u8();
    n.useSegCol = u8(); if (ver >= 256) n.circOut = u8(); if (ver >= 176) { n.grad = u8(); n.revGrad = u8(); }
    n.useSegScale = u8(); n.x = f32(); n.y = f32(); n.scale = f32(); n.dlen = f32(); n.len = f32(); n.dth = i32(); n.th = i32();
    if (ver >= 320) n.curve = i32(); if (ver >= 256) { n.halfArc = u8(); n.rtri = i16(); } if (ver >= 300) n.triUp = u8(); if (ver >= 256) { n.trap = f32(); n.poly = i16(); }
    if (ver >= 248) n.dla = f32(); n.la = f32(); if (ver >= 248) n.da = f32();
    n.col = col(); if (ver >= 176) n.gcol = col(); if (ver >= 256) n.ocol = col();
    const kids = i32(); nodes.push(n); n.i = nodes.length - 1; n.kids = [];
    for (let k = 0; k < kids; k++) { const c = node(n.i); n.kids.push(c); }
    return n.i;
  };
  node(-1);
  const polys = [];
  if (ver >= 230 && o < buf.length) { const np = i32(); for (let p = 0; p < np; p++) { const anchor = i32(), c = col(), use = u8(), cnt = i32(), idx = []; for (let k = 0; k < cnt; k++) idx.push(i32()); polys.push({ anchor, c, use, idx }); } }
  // world positions (Stick Nodes is y-up: flip to y-down)
  nodes.forEach(n => { if (n.parent < 0) { n.X = 0; n.Y = 0; } else { const p = nodes[n.parent]; n.X = p.X + n.x; n.Y = p.Y - n.y; } });
  return { ver, scale, nodes, polys, rest: buf.length - o };
}
module.exports = { parse, load: f => parse(fs.readFileSync(f)) };
