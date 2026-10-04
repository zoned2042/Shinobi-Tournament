// Renders every sound effect offline (no speakers needed) and checks levels.
//   node tests/sounds.js  -> tests/out/sfx.wav (each effect, then the busiest real moments) + a level report
// Scenes after the single effects replay the busiest real moments (stacked impacts, long hit rushes); >= 1.0 clips.
const fs = require('fs');
const path = require('path');
const { open, ensureOut } = require('./lib');

(async () => {
  const { browser, page, errors } = await open({ offline: true });
  const res = await page.evaluate(async () => {
    const SR = 44100;
    // each scene: list of [time s, effect, power]
    const single = ['hit', 'whoosh', 'boom', 'zap', 'charge', 'ko', 'thud', 'poof', 'heal', 'cut', 'fight', 'chirp'].map(k => ({ name: k, ev: [[0, k]], dur: 1 }));
    const scenes = single.concat([
      { name: 'Ultimate KO: release boom + impact boom + KO', ev: [[0, 'boom'], [.13, 'boom'], [.13, 'ko'], [.15, 'hit', 1.2]], dur: 1.6 },
      { name: 'Signature crit KO', ev: [[0, 'boom'], [0, 'hit', 1.2], [0, 'ko']], dur: 1.4 },
      { name: '18-hit rush (rushUlt)', ev: Array.from({ length: 18 }, (_, i) => [i * .084, 'hit', .8]), dur: 2 },
      { name: 'Kirin storm: 10 zaps + boom', ev: Array.from({ length: 10 }, (_, i) => [i * .11, 'zap']).concat([[1.15, 'boom'], [1.2, 'hit', .8], [1.27, 'hit', .8]]), dur: 2.4 },
      { name: 'Titan rumble: 14 thuds', ev: Array.from({ length: 14 }, (_, i) => [i * .08, 'thud']), dur: 1.8 }
    ]);
    async function render(sc) {
      const oc = new OfflineAudioContext(1, Math.ceil(SR * sc.dur), SR);
      const saved = { ctx: Sfx.ctx, on: Sfx.on };
      Sfx.ctx = oc; Sfx.on = true;
      const byT = {}; sc.ev.forEach(([t, k, p]) => { (byT[t] = byT[t] || []).push([k, p]); });
      Object.keys(byT).map(Number).sort((a, b) => a - b).forEach(t => {
        const go = () => byT[t].forEach(([k, p]) => Sfx.play(k, p));
        if (t === 0) go(); else oc.suspend(Math.round(t * SR) / SR).then(() => { go(); oc.resume(); });
      });
      const buf = await oc.startRendering();
      Object.assign(Sfx, saved);
      return buf.getChannelData(0);
    }
    const out = [];
    for (const sc of scenes) {
      const a = await render(sc);
      let pk = 0, ss = 0, clip = 0, nan = 0;
      for (let i = 0; i < a.length; i++) { const v = a[i]; if (!isFinite(v)) { nan++; continue; } pk = Math.max(pk, Math.abs(v)); ss += v * v; if (Math.abs(v) >= 1) clip++; }
      out.push({ name: sc.name, peak: pk, rms: Math.sqrt(ss / a.length), clip, nan, samples: Array.from(a) });
    }
    return { SR, out };
  });
  ensureOut();
  // WAV: each scene followed by 0.35 s of silence, 16-bit mono
  const gap = Math.round(res.SR * .35), total = res.out.reduce((n, s) => n + s.samples.length + gap, 0);
  const b = Buffer.alloc(44 + total * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + total * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(res.SR, 24); b.writeUInt32LE(res.SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(total * 2, 40);
  let o = 44, t = 0; const marks = [];
  for (const s of res.out) {
    marks.push(`${t.toFixed(2).padStart(6)} s  ${s.name}`);
    for (const v of s.samples) { b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), o); o += 2; }
    o += gap * 2; t += (s.samples.length + gap) / res.SR;
  }
  const file = path.join(__dirname, 'out', 'sfx.wav'); fs.writeFileSync(file, b);
  const db = x => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf').padStart(6);
  let bad = 0;
  console.log('effect'.padEnd(46) + 'peak  peak dBFS  rms dBFS  clipped');
  for (const s of res.out) {
    if (s.clip || s.nan || s.peak < 0.01) bad++;
    console.log(s.name.padEnd(46) + s.peak.toFixed(2) + '   ' + db(s.peak) + '    ' + db(s.rms) + '   ' + (s.clip + s.nan));
  }
  console.log('\n' + file + '\n' + marks.join('\n'));
  if (errors.length) { console.log(errors.join('\n')); bad++; }
  console.log(bad ? 'SOUND PROBLEMS' : 'sound ok');
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
