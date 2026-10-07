// Builds the Stick Nodes figure data (SNFIG) that index.html draws fighters from, and writes it into index.html.
//   node tests/sticknodes/build.js <packs dir>        (the unzipped packs from sticknodes.com, one folder per pack)
// tests/sticknodes/figures.json maps a roster id to a figure: { file, mirror?, graft? (a separate limb file used as the
// front arm), att? [{file, at:'sho', a (deg), x, y, s}] (a prop riding on the shoulders, e.g. Samehada) }.
// The figure is scaled so thigh + shin = 74 (the game skeleton's leg) and mirrored to face +x.
const fs = require('fs'), path = require('path');
const { load } = require('./sn.js'); const { detect, subtree } = require('./detect.js');
let PACKS = '';
const hex = c => c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('') + (c[3] < 255 ? c[3].toString(16).padStart(2, '0') : '');
function build(file, o) {
  const F = load(path.join(PACKS, file)), N = F.nodes;
  let D = o.prop ? null : detect(F);
  // graft: a separate limb file (e.g. Kisame's arm) hung from the shoulders and used as the front arm
  if (D && o.graft) {
    const G = load(path.join(PACKS, o.graft)).nodes, base = N.length, maxDi = Math.max(...N.map(m => m.di));
    G.slice(1).forEach(g => { const c = Object.assign({}, g, { kids: [], parent: g.parent === 0 ? D.sho : base + g.parent - 1, di: maxDi + 1 + g.di }); c.i = N.length; N.push(c); N[c.parent].kids.push(c.i); });
    N.forEach(m => { if (m.parent >= 0) { m.X = N[m.parent].X + m.x; m.Y = N[m.parent].Y - m.y; } });
    N.forEach(m => { m.L = Math.hypot(m.x, m.y); });
    const keep = D.arms.slice().sort((a, b) => N[b.i].L - N[a.i].L)[0];
    D.arms = [{ i: base, kid: base + 1 }, keep]; D.ok = true;
  }
  if (D && !D.ok) throw new Error('skeleton not found in ' + file);
  const n = N.length;
  // which way does it face? toes of the front leg (unless given)
  let mirror = o.mirror;
  if (mirror === undefined && D) { const foot = subtree(N, D.legs[0].kid).slice(1); const fx = foot.reduce((t, i) => t + N[i].X, 0) / Math.max(1, foot.length) - N[D.legs[0].kid].X; mirror = fx < 0; }
  const ang = N.map(n => n.parent < 0 ? 0 : Math.atan2(n.y, n.x) * 180 / Math.PI); // absolute, y-up
  const L = N.map(n => Math.hypot(n.x, n.y));
  let k = 1;
  if (D) { const fl = D.legs[0]; k = 74 / (L[fl.i] + L[fl.kid]); }
  else k = o.scale || 1;
  const pal = [], pidx = c => { const h = hex(c); let j = pal.indexOf(h); if (j < 0) { j = pal.length; pal.push(h); } return j; };
  const loc = N.map((m, i) => { if (m.parent < 0) return 0; let a = ang[i] - (m.parent === 0 ? 0 : ang[m.parent]); if (mirror) a = -a; a = ((a + 540) % 360) - 180; return a; });
  const ord = N.map((m, i) => i).filter(i => N[i].parent >= 0).sort((a, b) => N[a].di - N[b].di);
  const di2ord = new Map(ord.map((i, j) => [N[i].di, j]));
  const byDi = new Map(N.map((m, i) => [m.di, i]));
  const fills = F.polys.map(P => [pidx(P.c), di2ord.has(P.anchor) ? di2ord.get(P.anchor) : 0, P.idx.map(d => byDi.get(d)).filter(i => i !== undefined).join(',')]);
  const out = {
    n, P: N.map(m => m.parent).join(','), T: N.map(m => m.type + 1).join(''),
    L: L.map(v => Math.round(v * k * 10)).join(','), W: N.map(m => Math.round(m.th * .5 * k * 10)).join(','),
    A: loc.map(a => Math.round(a * 2)).join(','), C: N.map(m => pidx(m.col)).join(','), O: ord.join(','), pal,
    R: N.map((m, i) => m.type === 5 && m.trap && Math.abs(m.trap - 1) > .01 ? i + ':' + m.trap.toFixed(2) : '').filter(Boolean).join(','),
    F: fills.length ? fills : undefined, ra: mirror ? 180 : 0
  };
  if (D) {
    // torso rest angle hip -> shoulder (after mirroring), y-up degrees
    const sx = N[D.sho].X * (mirror ? -1 : 1), sy = -N[D.sho].Y; out.ta = Math.round(Math.atan2(sy, sx) * 180 / Math.PI * 10) / 10;
    const ci = D.chain.indexOf(D.sho), neck = D.chain[ci + 1];
    const [fa, ba] = D.arms, [fl, bl] = D.legs;
    out.b = [D.tbase, D.sho, neck, D.head, fa.i, fa.kid, ba.i, ba.kid, fl.i, fl.kid, bl.i, bl.kid];
  }
  // props riding on a node (Samehada, the gunbai): built at the same scale, drawn behind or in front
  if (o.att) out.att = o.att.map(a => { const P = build(a.file, { prop: true, scale: k, mirror: a.mirror }); return { fig: P, at: a.at === 'sho' ? D.sho : a.at, a: a.a || 0, x: a.x || 0, y: a.y || 0, s: a.s || 1, back: a.back !== false }; });
  if (o.prop) { /* props keep their own origin */ }
  return out;
}
PACKS = process.argv[2];
if (!PACKS) { console.log('usage: node tests/sticknodes/build.js <packs dir>'); process.exit(1); }
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'figures.json'), 'utf8')), res = {};
for (const [id, o] of Object.entries(map)) { res[id] = build(o.file, o); }
const html = path.join(__dirname, '..', '..', 'index.html'), src = fs.readFileSync(html, 'utf8');
const A = '<script id="snfig">', B = '</script>', i = src.indexOf(A), j = src.indexOf(B, i);
if (i < 0) throw new Error('no <script id="snfig"> in index.html');
const json = JSON.stringify(res);
fs.writeFileSync(html, src.slice(0, i + A.length) + '/* Stick Nodes figures, generated by tests/sticknodes/build.js: do not edit by hand */ window.SNFIG=' + json + ';' + src.slice(j));
console.log(Object.keys(res).length, 'figures,', (json.length / 1024).toFixed(0), 'KB written into index.html');
