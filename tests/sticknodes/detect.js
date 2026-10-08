// Finds the skeleton of a Stick Nodes figure: hips (root), head, torso chain, two arms, two legs.
const { load } = require('./sn.js');
function subtree(N, i, out = []) { out.push(i); for (const k of N[i].kids) subtree(N, k, out); return out; }
function detect(F) {
  const N = F.nodes;
  N.forEach(n => { n.L = Math.hypot(n.x, n.y); n.A = n.parent < 0 ? 0 : Math.atan2(n.y, n.x) * 180 / Math.PI; });
  const isUp = a => { const d = ((a % 360) + 360) % 360; return d > 35 && d < 145; }, isDown = a => { const d = ((a % 360) + 360) % 360; return d > 200 && d < 340; };
  const cy = n => (N[n.parent].Y + n.Y) / 2;
  // head: a big circle/ellipse near the top
  const minY = Math.min(...N.map(n => n.Y)), maxY = Math.max(...N.map(n => n.Y));
  const circ = N.filter(n => n.parent >= 0 && [2, 4, 5].includes(n.type) && n.L > 4 && cy(n) < minY + (maxY - minY) * .3);
  const head = circ.sort((a, b) => (b.L + b.th) - (a.L + a.th))[0]; // drawn size: diameter plus stroke
  const chain = []; for (let i = head.i; i >= 0; i = N[i].parent) chain.unshift(i);
  const inChain = new Set(chain);
  // arms: children of chain nodes (not the head's own subtree), long, with a long child
  // the limb's next bone: the longest child that carries on in roughly the same direction (helper bones that fold
  // back over the limb, as in Temari's legs, lose to the real shin even when a unit longer)
  const cont = (n, c) => { const d = Math.atan2(c.y, c.x) - Math.atan2(n.y, n.x); return c.L * (1 + Math.cos(d)) / 2; };
  const score = (i, leg) => { const n = N[i]; const kid = n.kids.map(k => N[k]).sort((a, b) => leg ? cont(n, b) - cont(n, a) : b.L - a.L)[0]; return { i, len: n.L, kid: kid ? kid.i : -1, kl: kid ? kid.L : 0 }; };
  const armC = [];
  const tryArm = (k, c, ci) => { const s = score(k); if (s.kid >= 0 && s.len > 12 && s.kl > 8 && s.kl / s.len > .45 && s.kl / s.len < 2) armC.push(Object.assign(s, { at: c, ci })); };
  // arms hang from a chain node, directly or through a short connector node
  chain.forEach((c, ci) => { if (c === head.i || ci === 0) return; for (const k of N[c].kids) if (!inChain.has(k)) { tryArm(k, c, ci); if (N[k].L < 18) for (const g of N[k].kids) tryArm(g, c, ci); } });
  armC.sort((a, b) => (b.len + b.kl) - (a.len + a.kl));
  const arms = armC.slice(0, 2);
  // legs: below the hips, pointing down, long, with a long child
  const legC = [];
  const scan = (i, d) => { for (const k of N[i].kids) { if (inChain.has(k) && N[k].L > 2) continue; const s = score(k, true); if (isDown(N[k].A) && s.len > 15 && s.kid >= 0 && s.len > s.kl * .35) legC.push(s); else if (d < 1 && N[k].L < 20) scan(k, d + 1); } }; // a short hip connector is not the thigh: look past it
  scan(0, 0);
  legC.sort((a, b) => (b.len + b.kl) - (a.len + a.kl));
  const legs = legC.slice(0, 2);
  // shoulder = chain node the arms hang from; torso base = first chain node with length
  const sho = arms.length ? arms[0].at : chain[chain.length - 2];
  const tbase = chain.find(i => i > 0 && N[i].L > 2);
  const avgDi = i => { const s = subtree(N, i); return s.reduce((t, j) => t + N[j].di, 0) / s.length; };
  const order = xs => xs.slice().sort((a, b) => avgDi(b.i) - avgDi(a.i)); // front (drawn later) first
  return { head: head.i, chain, sho, tbase, arms: order(arms), legs: order(legs), ok: arms.length === 2 && legs.length === 2 };
}
module.exports = { detect, subtree };
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  for (const dir of process.argv.slice(2)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.nodes')).sort()) {
    const F = load(path.join(dir, f)); try { const D = detect(F); const N = F.nodes;
      console.log(`${f.padEnd(34)} ok=${D.ok} head#${D.head} chain[${D.chain.join(',')}] sho#${D.sho} arms ${D.arms.map(a => '#' + a.i + '>' + a.kid + '(' + N[a.i].L.toFixed(0) + '/' + a.kl.toFixed(0) + ')').join(' ')} legs ${D.legs.map(a => '#' + a.i + '>' + a.kid + '(' + N[a.i].L.toFixed(0) + '/' + a.kl.toFixed(0) + ')').join(' ')}`);
    } catch (e) { console.log(f, 'ERR', e.message); } }
}
