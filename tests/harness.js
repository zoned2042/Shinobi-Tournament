/* In-page test helpers. Injected after index.html has loaded, so it can see the game's globals
   (ROSTER, Stage, simFight, ultOf, SIGMAP, ...). Everything here drives a Stage by hand:
   update(16 ms) + a macrotask yield per step, so playback is deterministic and fast. */
window.T = {
  yieldMacro() { return new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); },

  /* a log entry shaped exactly like the ones simFight() produces */
  entry(A, D, att, mv, variant) {
    const v = variant || 'hit';
    if (mv === 'focus') return { text: '', type: 'focus', hp: [70, 70], ch: [50, 50], um: [0, 0], att, tgt: null, mv: null, name: '', dmg: 0,
      dodge: false, crit: false, guard: false, stun: false, surv: false, ko: false, skip: false, resist: false, who: att, st: A.sigType, heal: 25, win: null };
    const name = mv === 'ult' ? ultOf(A).n : mv === 'sig' ? A.sig : mv === 'nin' ? (A.mv && A.mv[0]) || 'a Fireball Jutsu'
      : mv === 'gen' ? ((A.gj && A.gj[0]) || 'an illusion') : (A.tm && A.tm[0]) || 'a rapid combo';
    const dmg = v === 'dodge' ? 0 : v === 'ko' ? 58 : v === 'crit' ? 44 : mv === 'gen' ? 3 : 27;
    const hp = [70, 70]; hp[1 - att] = v === 'ko' ? 0 : Math.max(0, 70 - dmg);
    return {
      text: '', type: mv === 'ult' ? 'ult' : mv, hp, ch: [50, 50], um: [0, 0], att, tgt: v === 'dodge' ? null : 1 - att, mv, name, dmg,
      dodge: v === 'dodge', crit: v === 'crit', guard: v === 'guard', stun: mv === 'gen' && v !== 'dodge', surv: v === 'surv', ko: v === 'ko',
      skip: false, resist: false, who: null, st: A.sigType, heal: 0, win: null
    };
  },

  /* play one entry on an offscreen stage.
     o.every: capture a frame every N ms of real time (0 = no capture); o.from: first capture time;
     o.at: extra capture times; o.maxT: hang limit; o.settle: ms to keep updating after the entry ends */
  async play(aId, bId, mv, variant, o) {
    o = o || {};
    const A = ROSTER.find(f => f.id === aId), B = ROSTER.find(f => f.id === bId);
    if (!A || !B) throw new Error('unknown id ' + aId + ' / ' + bId);
    const att = o.att || 0;
    const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450;
    const st = new Stage(cv, att ? B : A, att ? A : B, { auto: false, theme: o.theme || 0, mul: o.mul || 1, calm: !!o.calm });
    const e = T.entry(att ? st.f[1].d : st.f[0].d, att ? st.f[0].d : st.f[1].d, att, mv, variant);
    const tw = o.tw || 320, th = Math.round(tw * 450 / 800), frames = [];
    const grab = t => { st.draw(); const c = document.createElement('canvas'); c.width = tw; c.height = th; c.getContext('2d').drawImage(cv, 0, 0, tw, th); frames.push({ t, c }); };
    let done = false, err = null, skipAt = o.skipAt || 0;
    const p = st.playEntry(e).then(() => { done = true; }, x => { err = String((x && x.stack) || x); done = true; });
    let t = 0; const dt = 16, maxT = o.maxT || 30000, at = (o.at || []).slice().sort((a, b) => a - b);
    let next = o.every ? (o.from || 0) : Infinity;
    while (!done && t < maxT) {
      st.update(dt); t += dt;
      if (skipAt && t >= skipAt) { st.skip(); skipAt = 0; }
      if (t >= next) { grab(t); next += o.every; }
      while (at.length && t >= at[0]) { grab(at.shift()); }
      await T.yieldMacro();
    }
    const endT = t;
    if (o.every) grab(t);
    for (let s = 0; s < (o.settle || 0); s += dt) { st.update(dt); if (s % 32 === 0) await T.yieldMacro(); }
    if (o.every && o.settle) grab(t + (o.settle || 0));
    const fA = st.f[att], fD = st.f[1 - att];
    const pick = f => ({ x: Math.round(f.x), home: f.home, alpha: +f.alpha.toFixed(2), lift: Math.round(f.lift), scale: +f.scale.toFixed(2), rot: +f.pose.rot.toFixed(2), dead: f.dead, face: f.face, dizzy: f.dizzy });
    const res = {
      id: aId, vs: bId, mv, variant, done, err, t: endT,
      efx: st.efx.length, projs: st.projs.length, props: st.props.length, mood: !!st.mood, cut: !!st.cut || !!st.ultCut,
      cam: { z: +st.cam.zoom.toFixed(2), x: Math.round(st.cam.x), y: Math.round(st.cam.y) }, ts: st.ts, A: pick(fA), D: pick(fD)
    };
    if (frames.length) res.sheet = T.sheet(frames, o.cols || 5, o.title || `${aId} ${mv} ${variant}`);
    st.destroy();
    return res;
  },

  /* problems a finished entry should never leave behind */
  check(r) {
    const bad = [];
    if (r.err) bad.push('error: ' + r.err.split('\n')[0]);
    if (!r.done) bad.push('hang (still running after ' + r.t + ' ms)');
    if (r.cut) bad.push('cut-in still on screen');
    if (r.projs) bad.push(r.projs + ' projectiles left');
    if (r.props) bad.push(r.props + ' props left');
    if (r.mood) bad.push('mood overlay left');
    if (r.efx) bad.push(r.efx + ' fx layers left after settle');
    if (r.ts !== 1) bad.push('time scale ' + r.ts);
    if (r.cam.z !== 1) bad.push('camera zoom ' + r.cam.z);
    const homeOk = f => Math.abs(f.x - f.home) <= 1 && f.alpha === 1 && f.lift === 0 && f.scale === 1 && f.rot === 0;
    if (!homeOk(r.A)) bad.push('attacker not reset ' + JSON.stringify(r.A));
    if (r.A.face !== (r.A.home < 400 ? 1 : -1)) bad.push('attacker faces the wrong way');
    if (r.variant === 'ko') { if (!r.D.dead) bad.push('defender not KO'); }
    else { if (r.D.dead) bad.push('defender dead without KO'); if (!homeOk(r.D)) bad.push('defender not reset ' + JSON.stringify(r.D)); }
    return bad;
  },

  sheet(frames, cols, title) {
    if (!frames.length) return '';
    const tw = frames[0].c.width, th = frames[0].c.height, rows = Math.ceil(frames.length / cols), hd = 22;
    const s = document.createElement('canvas'); s.width = cols * tw; s.height = rows * th + hd;
    const g = s.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, s.width, s.height);
    g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.textBaseline = 'middle'; g.fillText(title, 6, hd / 2);
    frames.forEach((f, i) => {
      const x = (i % cols) * tw, y = hd + Math.floor(i / cols) * th;
      g.drawImage(f.c, x, y);
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x, y, 52, 15); g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText((f.t / 1000).toFixed(2) + 's', x + 3, y + 8);
      g.strokeStyle = '#000'; g.strokeRect(x + .5, y + .5, tw - 1, th - 1);
    });
    return s.toDataURL('image/png');
  },

  /* the opponent used for staged moves: a plain-looking mid-tier fighter, different from the attacker */
  foe(id) { return id === 'kakashi1' ? 'neji' : 'kakashi1'; }
};
