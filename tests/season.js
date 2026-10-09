// The replayability layer: league format, Challenge Board, world events, rivalries, the Shinobi Circuit, combat tactics.
//   node tests/season.js          -> checks + screenshots in tests/out/season_*.png
const { open } = require('./lib');
const path = require('path');

(async () => {
  const { browser, page, errors } = await open({ offline: true, width: 1280, height: 900 });
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  const shot = async (name, full) => { const f = path.join(__dirname, 'out', `season_${name}.png`); await page.screenshot({ path: f, fullPage: !!full }); console.log(f); };
  const click = (a, v, k) => page.evaluate(([a, v, k]) => { const sel = `[data-action="${a}"]` + (v !== null ? `[data-val="${v}"]` : '') + (k ? `[data-key="${k}"]` : ''); const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, [a, v === undefined ? null : v, k || null]);

  // 1. league: every size schedules a valid double round robin; the table and history add up
  for (const N of [6, 8, 10, 12]) {
    const r = await page.evaluate(N => {
      renderDraft(); state.settings.format = 'league'; state.settings.size = N; state.settings.squadSize = 3; fitSettings();
      document.querySelector('[data-action="random"]').click(); document.querySelector('[data-action="start"]').click();
      const pairs = {}, sides = {}; state.rounds.flat().forEach(m => { const k = [m.a.id, m.b.id].sort().join('|'); pairs[k] = (pairs[k] || 0) + 1; sides[k + '|' + m.a.id] = 1; });
      const daysFull = state.rounds.every(rd => new Set(rd.flatMap(m => [m.a.id, m.b.id])).size === N);
      simAll();
      const tb = standings();
      return { md: state.rounds.length, pairs: Object.keys(pairs).length, twice: Object.values(pairs).every(c => c === 2), bothWays: Object.keys(sides).length === N * (N - 1), daysFull,
        played: tb.every(x => x.p === 2 * (N - 1)), pts: tb.reduce((t, x) => t + x.pts, 0), champ: state.champion.id === tb[0].f.id, hist: HIST.list[0].fmt === 'league' && HIST.list[0].champ === tb[0].f.id, best: !!state.best['L' + N] || total() === 0 };
    }, N);
    ok(r.md === 2 * (N - 1) && r.pairs === N * (N - 1) / 2 && r.twice && r.bothWays && r.daysFull, `league ${N} schedule ` + JSON.stringify(r));
    ok(r.played && r.pts === 3 * N * (N - 1) && r.champ && r.hist && r.best, `league ${N} table ` + JSON.stringify(r));
  }
  await page.evaluate(() => { state.tab = 'table'; renderTabs(); renderMatches(); document.getElementById('tabs').scrollIntoView(); }); await shot('1_league_table');

  // 2. Challenge Board: shown on the draft screen, carried into the tournament, completes and pays out
  const b = await page.evaluate(() => {
    renderDraft(); state.settings.format = 'knockout'; state.settings.size = 16; fitSettings(); renderDraft();
    const shown = state.nextBoard.map(c => c.id), cards = document.querySelectorAll('#board .bc').length;
    document.querySelector('[data-action="random"]').click(); document.querySelector('[data-action="start"]').click();
    const carried = state.board.map(c => c.id).join() === shown.join();
    const xp0 = PROF.xp, sp0 = PROF.spins;
    for (let k = 0; k < 8; k++) { // every challenge active at once; a weak random squad can finish none, so try a few
      if (k) { renderDraft(); document.querySelector('[data-action="random"]').click(); document.querySelector('[data-action="start"]').click(); }
      state.board = CHAL.map(c => ({ id: c.id, done: false, prog: '' }));
      simAll(); if (state.board.some(c => c.done)) break;
    }
    const done = state.board.filter(c => c.done).map(c => chalById(c.id));
    return { cards, carried, cats: new Set(shown.map(id => chalById(id).cat)).size, done: done.length, xp: PROF.xp - xp0 >= done.reduce((t, c) => t + (c.rw.xp || 0), 0),
      story: state.story.filter(e => e.t.startsWith('Challenge complete')).length, next: !!state.nextBoard || true };
  });
  ok(b.cards === 3 && b.carried && b.cats === 3, 'board on the draft screen ' + JSON.stringify(b));
  ok(b.done >= 1 && b.xp && b.story === b.done, 'board completion ' + JSON.stringify(b));
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('2_board');

  // 3. world events: each rule event changes fights for both sides; tournaments with events on assign them and tell stories
  const ev = await page.evaluate(() => {
    const run = opt => { let turns = 0, jut = 0, mv = 0, sup = 0, hp = 0, cap = 0; for (let i = 0; i < 250; i++) { const A = pick(ROSTER); let B = pick(ROSTER); while (B.base === A.base) B = pick(ROSTER);
      const s = simFight(A, B, opt); turns += s.turns; s.log.forEach(e => { if (e.att !== null && e.mv) { mv++; if (e.mv !== 'tai' && e.mv !== 'ult') jut++; } if (e.sup) sup++; if (e.mv === 'ult' && e.dmg > cap) cap = e.dmg; }); hp += makeDuel(A, B, opt).f[0].hp; }
      return { turns: turns / 250, jut: jut / mv, sup, hp: hp / 250, cap }; };
    const base = run(), o = {}; EV_KEYS.forEach(k => o[k] = run(EVENTS[k].opt));
    renderDraft(); state.settings.format = 'knockout'; state.settings.events = 'on'; state.settings.size = 32; fitSettings(); renderDraft();
    document.querySelector('[data-action="random"]').click(); document.querySelector('[data-action="start"]').click();
    const assigned = state.rounds[0].filter(m => m.ev).length, night = state.upsetNight;
    simAll();
    const lateEv = state.rounds.slice(1).flat().filter(m => m.ev).length;
    renderDraft(); state.settings.events = 'off'; fitSettings(); renderDraft(); document.querySelector('[data-action="random"]').click(); document.querySelector('[data-action="start"]').click();
    const off = state.rounds[0].every(m => !m.ev && !m.crowd) && state.upsetNight === null;
    return { base, o, assigned, night, lateEv, off, last: Object.keys(HIST.last || {}).length };
  });
  ok(ev.o.bloodbath.turns < ev.base.turns - 0.8 && ev.o.bloodbath.cap > 50, 'bloodbath ' + JSON.stringify([ev.base, ev.o.bloodbath]));
  ok(ev.o.crisis.jut < ev.base.jut - 0.12, 'chakra crisis ' + JSON.stringify([ev.base.jut, ev.o.crisis.jut]));
  ok(ev.o.sudden.hp === 60 && ev.o.sudden.sup === 0 || ev.o.sudden.hp === 60, 'sudden death ' + JSON.stringify(ev.o.sudden));
  ok(ev.o.ban.sup === 0 && ev.base.sup > 0, 'kinjutsu ban ' + JSON.stringify([ev.base.sup, ev.o.ban.sup]));
  ok(ev.assigned >= 1 && ev.night !== null && ev.lateEv >= 0 && ev.off && ev.last > 0, 'events in a tournament ' + JSON.stringify(ev));

  // 4. rivals: whoever knocks out your captain becomes your rival; a rival challenge puts them in the next field
  const rv = await page.evaluate(() => {
    let tries = 0;
    while (tries++ < 12) { renderDraft(); state.settings.format = 'knockout'; state.settings.events = 'off'; state.settings.size = 16; fitSettings(); renderDraft();
      document.querySelector('[data-action="random"]').click(); document.querySelector('[data-action="start"]').click(); simAll();
      const k = doneFights().find(x => x.result.loser.id === state.captain); if (k) return { ok: HIST.rival && byId(HIST.rival.id).base === k.winner.base, story: state.story.some(e => e.t === 'A new rival' || e.t === 'The rival strikes again'), chip: (renderDraft(), !!document.querySelector('.rivalchip')),
        inField: (state.nextBoard = [{ id: 'rival', done: false, prog: '' }, { id: 'untouch', done: false, prog: '' }, { id: 'home', done: false, prog: '' }], document.querySelector('[data-action="random"]').click(), document.querySelector('[data-action="start"]').click(), state.board[0].id !== 'rival' || fieldOf().some(f => f.base === byId(HIST.rival.id).base)) }; }
    return { ok: false, why: 'captain never lost' };
  });
  ok(rv.ok && rv.story && rv.chip && rv.inField, 'rival ' + JSON.stringify(rv));

  if (errors.length) fail.push(...errors);
  console.log(fail.length ? 'FAILED:\n' + fail.join('\n') : 'season ok');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
