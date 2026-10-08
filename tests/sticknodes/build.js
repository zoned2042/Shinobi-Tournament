// Builds the Stick Nodes figure data (SNFIG) that index.html draws fighters from, and writes it into index.html.
//   node tests/sticknodes/build.js <packs dir>        (the unzipped packs from sticknodes.com, one folder per pack)
// tests/sticknodes/figures.json maps a roster id to a figure: { file, mirror?, graft? (a separate limb file used as the
// front arm), att? [{file, at:'sho', a (deg), x, y, s}] (a prop riding on the shoulders, e.g. Samehada) }.
// The figure is scaled so thigh + shin = 74 (the game skeleton's leg) and mirrored to face +x.
const fs = require('fs'), path = require('path');
const { load } = require('./sn.js'); const { detect, subtree } = require('./detect.js');
let PACKS = '';
const hex = c => c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('') + (c[3] < 255 ? c[3].toString(16).padStart(2, '0') : '');
/* graft another .nodes file onto node `at` of N (its root merges into `at`); `front` draws it over everything,
   otherwise under everything. `from` (default `at`): the node where the part's root really sits, when the part hangs
   from `at` but was drawn around another origin (Pain's head is drawn from the waist). Returns the graft's first node. */
function graftFile(N, file, at, front, polys, from) {
  const GF = load(path.join(PACKS, file)), G = GF.nodes, base = N.length;
  const dis = N.map(m => m.di), lo = Math.min(...dis), hi = Math.max(...dis), gmax = Math.max(...G.map(g => g.di));
  const off = front ? hi + 1 : lo - gmax - 1, mapDi = d => d === G[0].di ? N[at].di : d + off;
  const fr = from === undefined ? at : from, dx = N[fr].X - N[at].X, dy = N[fr].Y - N[at].Y;
  G.slice(1).forEach(g => { const c = Object.assign({}, g, { kids: [], parent: g.parent === 0 ? at : base + g.parent - 1, di: g.di + off }); if (g.parent === 0) { c.x += dx; c.y -= dy; } c.i = N.length; N.push(c); N[c.parent].kids.push(c.i); });
  if (polys) GF.polys.forEach(P => polys.push({ anchor: mapDi(P.anchor), c: P.c, use: P.use, idx: P.idx.map(mapDi) })); // the part's fills (hair etc.)
  N.forEach(m => { if (m.parent >= 0) { m.X = N[m.parent].X + m.x; m.Y = N[m.parent].Y - m.y; } });
  return base;
}
/* top of a body part's torso: from the root, keep following the child that points most nearly straight up */
function torsoTop(N) {
  let i = 0;
  for (;;) { const up = N[i].kids.map(k => N[k]).filter(c => Math.hypot(c.x, c.y) > 2 && c.y > 0 && Math.abs(Math.atan2(c.y, c.x) - Math.PI / 2) < 1).sort((a, b) => b.y - a.y)[0]; if (!up) return i; i = up.i; }
}
function build(file, o) {
  const F = load(path.join(PACKS, file)), N = F.nodes;
  // parts: assemble a figure shipped in pieces { head, front arm, back arm, front leg, back leg } (Hokage Pack 2,
  // Temari's head, Pain Pack 2, Madara Pack 3)
  // partsAt { arm, head, headFrom, headBack } (node indices) overrides where they join; with it the grafted arms are
  // the skeleton's arms (the body's own coat flaps can look like arms to the detector: Madara Pack 3)
  const PA = o.partsAt || {}, pb = {};
  if (o.parts) { const P = o.parts, top = torsoTop(N), arm = PA.arm !== undefined ? PA.arm : top, hd = PA.head !== undefined ? PA.head : top;
    if (P.backArm) pb.backArm = graftFile(N, P.backArm, arm, false, F.polys);
    if (P.frontLeg) pb.frontLeg = graftFile(N, P.frontLeg, 0, false, F.polys); // legs go under the body (Pain's cloak covers the thighs)
    if (P.backLeg) pb.backLeg = graftFile(N, P.backLeg, 0, false, F.polys);
    if (P.head) graftFile(N, P.head, hd, !PA.headBack, F.polys, PA.headFrom);
    if (P.frontArm) pb.frontArm = graftFile(N, P.frontArm, arm, true, F.polys); }
  let D = o.prop ? null : detect(F);
  if (D && o.partsAt && pb.frontArm && pb.backArm) {
    const limb = i => { const n = N[i], a = Math.atan2(n.y, n.x); const k = n.kids.map(j => N[j]).sort((p, q) => Math.hypot(q.x, q.y) * (1 + Math.cos(Math.atan2(q.y, q.x) - a)) - Math.hypot(p.x, p.y) * (1 + Math.cos(Math.atan2(p.y, p.x) - a)))[0]; return { i, kid: k.i }; };
    D.arms = [limb(pb.frontArm), limb(pb.backArm)]; D.sho = N[pb.frontArm].parent;
    if (pb.frontLeg && pb.backLeg) D.legs = [limb(pb.frontLeg), limb(pb.backLeg)];
  }
  // graft: a separate limb file (e.g. Kisame's arm) hung from the shoulders and used as the front arm
  if (D && o.graft) {
    const G = load(path.join(PACKS, o.graft)).nodes, base = N.length, maxDi = Math.max(...N.map(m => m.di));
    G.slice(1).forEach(g => { const c = Object.assign({}, g, { kids: [], parent: g.parent === 0 ? D.sho : base + g.parent - 1, di: maxDi + 1 + g.di }); c.i = N.length; N.push(c); N[c.parent].kids.push(c.i); });
    N.forEach(m => { if (m.parent >= 0) { m.X = N[m.parent].X + m.x; m.Y = N[m.parent].Y - m.y; } });
    N.forEach(m => { m.L = Math.hypot(m.x, m.y); });
    const keep = D.arms.slice().sort((a, b) => N[b.i].L - N[a.i].L)[0];
    D.arms = [{ i: base, kid: base + 1 }, keep]; D.ok = true;
  }
  // one-armed figure (a lost arm): an invisible stand-in arm at the shoulder keeps the skeleton complete
  if (D && o.oneArm && D.arms.length === 1 && D.legs.length === 2) {
    const mk = (parent, len) => { const c = { parent, kids: [], type: 0, di: -9999, x: 0, y: -len, th: 0, col: [0, 0, 0, 0], X: 0, Y: 0, L: len }; c.i = N.length; N.push(c); N[parent].kids.push(c.i); return c.i; };
    const u = mk(D.sho, 1), f = mk(u, 1); N.forEach(m => { if (m.parent >= 0) { m.X = N[m.parent].X + m.x; m.Y = N[m.parent].Y - m.y; } });
    D.arms = D.arms.concat([{ i: u, kid: f }]); D.ok = true;
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
