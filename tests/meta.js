// The layers around the fights: tournament types, squad identity, story, history and spectator mode.
//   node tests/meta.js            -> checks + screenshots in tests/out/meta_*.png
const { open } = require('./lib');
const path = require('path');

(async () => {
  const { browser, page, errors } = await open({ offline: true });
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  const shot = async name => { const f = path.join(__dirname, 'out', `meta_${name}.png`); await page.screenshot({ path: f, fullPage: false }); console.log(f); };
  await page.evaluate(() => { try { localStorage.removeItem('fst_hist'); } catch (e) {} HIST = emptyHist(); });

  // 1. every tournament type builds valid fields at every allowed size
  const modes = await page.evaluate(() => {
    const out = [];
    for (const M of MODES) for (const era of (M.id === 'canon' ? ERAS.map(e => e.v) : ['1'])) {
      state.settings.mode = M.id; state.settings.era = era; state.squad = []; fitSettings();
      const mx = maxSize(), bases = modeBases();
      for (const size of [8, 16, 32, 64].filter(n => n <= mx)) for (const seed of ['random', 'rating']) for (const field of ['random', 'strong']) {
        state.settings.size = size; state.settings.seed = seed; state.settings.field = field; fitSettings();
        // a random eligible squad
        const picks = [], seen = new Set();
        for (const f of shuffle(ROSTER.filter(x => eligible(x)))) { if (picks.length >= state.settings.squadSize) break; if (!seen.has(f.base)) { seen.add(f.base); picks.push(f.id); } }
        state.squad = picks; state.captain = picks[0];
        state.mode = M.id; state.era = era; state.N = size;
        const list = buildField();
        const ids = list.map(f => f.id), bs = list.map(f => f.base);
        const err = [];
        if (list.length !== size) err.push(`size ${list.length}`);
        if (new Set(bs).size !== size) err.push('duplicate character');
        if (M.id !== 'chaos' && !picks.every(id => ids.includes(id))) err.push('squad missing');
        if (M.ok && M.id !== 'chaos' && !list.every(f => eligible(f, M.id, era))) err.push('ineligible fighter: ' + list.filter(f => !eligible(f, M.id, era)).map(f => f.id));
        if (M.id === 'akatsuki') for (let i = 0; i < size; i += 2) if (AKA_BASES.has(list[i].base) === AKA_BASES.has(list[i + 1].base)) err.push('akatsuki pairing ' + list[i].id + '/' + list[i + 1].id);
        if (M.id === 'edo') { const edoBases = new Set(ROSTER.filter(isEdo).map(f => f.base)); const want = Math.min(size - picks.filter(id => !isEdo(byId(id))).length, [...edoBases].filter(b => !picks.some(id => byId(id).base === b)).length + picks.filter(id => isEdo(byId(id))).length); const got = list.filter(isEdo).length; if (got < want) err.push(`edo ${got} < ${want}`); }
        if (err.length) out.push(`${M.id}${M.id === 'canon' ? era : ''} ${size} ${seed} ${field}: ${err.join(', ')}`);
      }
      out.push(`#${M.id}${M.id === 'canon' ? era : ''}: ${bases} characters, max ${mx}`);
    }
    state.settings.mode = 'classic'; state.settings.size = 16; state.settings.seed = 'random'; state.settings.field = 'random'; state.squad = []; fitSettings();
    return out;
  });
  modes.filter(l => l.startsWith('#')).forEach(l => console.log(l.slice(1)));
  modes.filter(l => !l.startsWith('#')).forEach(l => fail.push('field: ' + l));

  // 2. squad identity
  const idents = await page.evaluate(() => [
    ['naruto1', 'sasuke1', 'sakura1'], ['jiraiya', 'tsunade', 'orochimaru'], ['madara1', 'itachi1', 'kakashi1'], ['pain', 'konan', 'kisame'],
    ['hashiramaE', 'minatoE', 'sasoriE'], ['lee1', 'guy1', 'neji'], ['iruka', 'shikamaru', 'ino', 'yamato', 'sai'], ['raikage', 'mifune', 'bee']
  ].map(ids => { const I = squadIdent(ids); return `${ids.join('+')} -> ${I.name} [${I.sym}] ${I.style} ${I.rating}`; }));
  idents.forEach(l => console.log('  ' + l));
  ok(/Team 7/.test(idents[0]) && /Sannin/.test(idents[1]) && /Uchiha/.test(idents[2]) && /Akatsuki/.test(idents[3]) && /Reanimated/.test(idents[4]) && /Team Guy/.test(idents[5]), 'squad names: ' + idents.join(' | '));

  // 3. draft screen with a squad, a custom name and a captain
  await page.click('[data-action="mode"][data-val="legends"]');
  ok(await page.evaluate(() => state.settings.size <= maxSize() && [...document.querySelectorAll('#grid .card')].every(c => byId(c.dataset.id).ovr >= 85)), 'legends grid shows ineligible versions');
  await page.click('[data-action="mode"][data-val="classic"]');
  await page.evaluate(() => { state.squad = ['madara1', 'itachi1', 'sasuke2']; state.captain = 'itachi1'; draftChanged(); });
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('1_draft');
  ok(await page.evaluate(() => /Uchiha/i.test(document.getElementById('sqname').value)), 'ident panel name');
  await page.fill('#sqname', 'Crow Watchers');
  ok(await page.evaluate(() => state.squadName === 'Crow Watchers'), 'custom squad name not stored');

  // 4. a full tournament: story, captain bonus, history record
  await page.click('[data-action="set"][data-key="size"][data-val="16"]');
  await page.click('[data-action="start"]');
  await page.click('[data-action="simround"]');
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('2_bracket');
  await page.click('[data-action="simall"]');
  const t1 = await page.evaluate(() => ({
    story: state.story.map(e => e.t), champ: state.story.some(e => e.k === 'champ'), saved: state.saved, n: HIST.n,
    stored: JSON.parse(localStorage.getItem('fst_hist')).n, wins: Object.values(HIST.f).reduce((s, r) => s + r.w, 0), losses: Object.values(HIST.f).reduce((s, r) => s + r.l, 0),
    titles: Object.values(HIST.f).reduce((s, r) => s + r.t, 0), entries: Object.values(HIST.f).reduce((s, r) => s + r.e, 0),
    capOk: state.rounds.flat().filter(m => m.result && m.winner.id === state.captain).every(m => m.capB),
    name: HIST.list[0].name, ultsOk: HIST.list[0].ults >= 0, h2h: Object.values(HIST.h2h).reduce((s, v) => s + v[0] + v[1], 0)
  }));
  console.log('story:', t1.story.join(' | '));
  ok(t1.champ && t1.saved && t1.n === 1 && t1.stored === 1, 'history not saved ' + JSON.stringify(t1));
  ok(t1.wins === 15 && t1.losses === 15 && t1.titles === 1 && t1.entries === 16 && t1.h2h === 15, 'record totals wrong ' + JSON.stringify(t1));
  ok(t1.capOk, 'captain bonus missing');
  ok(t1.name === 'Crow Watchers', 'custom name not in history: ' + t1.name);
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('3_champion');
  await page.click('[data-action="tab"][data-val="story"]');
  ok(await page.evaluate(() => document.querySelectorAll('.story li').length === state.story.length), 'story tab');
  await page.evaluate(() => document.getElementById('tabs').scrollIntoView()); await shot('4_story');

  // 5. play again a few times, then the defending champion and streaks should show up
  for (let i = 0; i < 6; i++) { await page.click('[data-action="again"]'); await page.click('[data-action="simall"]'); }
  const t2 = await page.evaluate(() => ({ n: HIST.n, list: HIST.list.length, wins: Object.values(HIST.f).reduce((s, r) => s + r.w, 0), st: Object.values(HIST.f).every(r => r.bs >= Math.max(0, r.st)) }));
  ok(t2.n === 7 && t2.list === 7 && t2.wins === 7 * 15 && t2.st, 'repeat tournaments ' + JSON.stringify(t2));

  // 6. history screen, all three views, both groupings
  await page.click('[data-action="history"]');
  ok(await page.evaluate(() => state.screen === 'history' && document.querySelectorAll('.hcard').length === 7), 'history cards');
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('5_history');
  await page.click('[data-action="hview"][data-val="champs"]'); await shot('6_champions');
  ok(await page.evaluate(() => document.querySelectorAll('.htab tbody tr').length >= 2), 'champions table');
  await page.click('[data-action="hgroup"][data-val="character"]');
  await page.click('[data-action="hview"][data-val="records"]');
  await page.selectOption('#hsort', 'wr'); await shot('7_records');
  ok(await page.evaluate(() => document.querySelectorAll('.htab tbody tr').length >= 16), 'records table');
  await page.click('[data-action="back"]');
  ok(await page.evaluate(() => state.screen === 'tournament' && !!document.querySelector('#stage')), 'back to tournament');

  // 7. history survives a reload; reputations show on the draft cards
  await page.reload(); await page.addScriptTag({ path: path.join(__dirname, 'harness.js') });
  ok(await page.evaluate(() => HIST.n === 7 && document.querySelectorAll('.rep').length > 0), 'history lost on reload / no reputations on cards');

  // 8. each tournament type plays through, Random Chaos rolls the squad's versions
  for (const mode of ['legends', 'kage', 'akatsuki', 'edo', 'underdogs', 'chaos', 'canon', 'villains', 'tai']) {
    await page.click(`[data-action="mode"][data-val="${mode}"]`);
    if (mode === 'canon') await page.click('[data-action="set"][data-key="era"][data-val="N"]');
    await page.click('[data-action="random"]');
    const before = await page.evaluate(() => state.squad.map(id => byId(id).base).sort().join());
    await page.click('[data-action="start"]');
    await page.click('[data-action="simall"]');
    const r = await page.evaluate(() => ({ champ: !!state.champion, mode: HIST.list[0].mode, bases: state.squad.map(id => byId(id).base).sort().join(), story: state.story.map(e => e.t) }));
    ok(r.champ && r.mode === mode, `${mode}: did not finish or not recorded`);
    ok(r.bases === before, `${mode}: squad characters changed`);
    if (mode === 'akatsuki') ok(r.story.includes('The war begins') && r.story.includes('War report'), 'akatsuki: no war story ' + r.story);
    console.log(`${mode}: ${r.story.join(' | ')}`);
    await page.click('[data-action="newdraft"]');
  }
  await page.click('[data-action="mode"][data-val="classic"]');

  // 9. spectator mode: an 8-fighter bracket runs by itself; skip each fight to keep it short
  await page.click('[data-action="set"][data-key="size"][data-val="8"]');
  await page.evaluate(() => { state.squad = ['naruto1', 'lee1', 'gaara1']; state.captain = 'lee1'; draftChanged(); });
  await page.click('[data-action="spectate"]');
  ok(await page.evaluate(() => state.spectate && state.squad.length === 0), 'spectate: squad not cleared');
  await page.click('[data-action="speed"][data-val="fast"]');
  await page.waitForFunction(() => state.busy, null, { timeout: 15000 }).catch(() => fail.push('spectate: never started a fight'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('arena').scrollIntoView()); await shot('8_spectate');
  await page.click('[data-action="pause"]');
  const p0 = await page.evaluate(() => state.stage.t); await page.waitForTimeout(600);
  const p1 = await page.evaluate(() => ({ t: state.stage.t, paused: state.stage.paused }));
  ok(p1.paused && p1.t === p0, 'pause did not freeze the stage');
  await page.click('[data-action="pause"]');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const s = await page.evaluate(() => ({ c: !!state.champion, busy: state.busy }));
    if (s.c) break;
    if (s.busy) await page.click('[data-action="skip"]').catch(() => {});
    await page.waitForTimeout(400);
  }
  const sp = await page.evaluate(() => ({ c: !!state.champion, watched: state.rounds.flat().filter(m => m.watched).length, spec: HIST.list[0].spec, pts: total() }));
  ok(sp.c && sp.watched === 7 && sp.spec && sp.pts === 0, 'spectate 8: ' + JSON.stringify(sp));
  await page.click('[data-action="newdraft"]');
  ok(await page.evaluate(() => state.screen === 'draft' && state.squad.join() === 'naruto1,lee1,gaara1' && state.captain === 'lee1'), 'back to draft did not restore the squad');

  // 10. spectator at 32: highlights skip fights off camera, Skip to the final jumps ahead
  await page.click('[data-action="set"][data-key="size"][data-val="32"]');
  await page.click('[data-action="spectate"]');
  await page.waitForFunction(() => state.busy, null, { timeout: 20000 }).catch(() => fail.push('spectate 32: never started'));
  await page.click('[data-action="tofinal"]');
  await page.waitForFunction(() => state.r === nRounds() - 1 && state.busy, null, { timeout: 30000 }).catch(() => fail.push('skip to the final did not reach the final'));
  const sk = await page.evaluate(() => ({ r: state.r, offCam: state.rounds.flat().filter(m => m.result && !m.watched).length }));
  ok(sk.offCam > 20, 'skip to the final: ' + JSON.stringify(sk));
  await page.click('[data-action="skip"]').catch(() => {});
  await page.waitForFunction(() => !!state.champion, null, { timeout: 30000 }).catch(() => fail.push('spectate 32: no champion'));
  await page.click('[data-action="newdraft"]');

  // 11. spin draft: rolls fill the slots with eligible, distinct characters and cost one spin each; XP is doubled
  await page.evaluate(() => { PROF = { xp: 0, spins: 6, day: today() }; saveProf(); state.squad = []; renderDraft(); });
  await page.click('[data-action="set"][data-key="size"][data-val="16"]');
  await page.click('[data-action="mode"][data-val="villains"]');
  await page.click('[data-action="set"][data-key="draft"][data-val="spin"]');
  ok(await page.evaluate(() => document.getElementById('toolbar').hidden && document.querySelectorAll('.sslot').length === state.settings.squadSize), 'spin panel not shown');
  for (let i = 0; i < 4; i++) {
    const idx = Math.min(i, 2);
    await page.click(`.sslot[data-i="${idx}"] [data-action="spin"]`);
    if (i === 0) { await page.waitForTimeout(250); await page.evaluate(() => window.scrollTo(0, 400)); await shot('9_spinning'); }
    await page.waitForFunction(() => state.spinning === null, null, { timeout: 10000 }).catch(() => fail.push('spin never landed'));
  }
  const sp1 = await page.evaluate(() => ({ n: state.squad.length, spins: PROF.spins, ok: state.squad.every(id => eligible(byId(id))), uniq: new Set(state.squad.map(id => byId(id).base)).size, stored: JSON.parse(localStorage.getItem('fst_prof')).spins }));
  ok(sp1.n === 3 && sp1.spins === 2 && sp1.stored === 2 && sp1.ok && sp1.uniq === 3, 'spin draft ' + JSON.stringify(sp1));
  await page.evaluate(() => window.scrollTo(0, 300)); await shot('10_spun');
  await page.click('[data-action="start"]');
  await page.click('[data-action="simall"]');
  const xp = await page.evaluate(() => ({ r: state.reward, pts: total(), xp: PROF.xp, txt: (document.querySelector('.reward') || {}).textContent || '' }));
  ok(xp.r && xp.r.spun && xp.xp === (25 + xp.pts) * 2 && /XP/.test(xp.txt), 'spin XP ' + JSON.stringify(xp));
  await page.evaluate(() => window.scrollTo(0, 0)); await shot('11_reward');
  await page.click('[data-action="newdraft"]');
  // a new day gives 10 spins once
  const s0 = await page.evaluate(() => { PROF.day = '2000-1-1'; saveProf(); return PROF.spins; });
  await page.reload(); await page.addScriptTag({ path: path.join(__dirname, 'harness.js') });
  ok(await page.evaluate(s0 => PROF.spins === s0 + 10 && !!document.querySelector('.toast'), s0), 'daily spins');
  await page.reload(); await page.addScriptTag({ path: path.join(__dirname, 'harness.js') });
  ok(await page.evaluate(() => !document.querySelector('.toast')), 'daily spins given twice');

  // 12. fight it yourself: in the tournament, pick moves with the keyboard; the result lands in the bracket
  const playOut = async () => {
    const t0 = Date.now(); let moves = 0;
    while (Date.now() - t0 < 120000) {
      const s = await page.evaluate(() => ({ duel: !!state.duel, waiting: !!(state.duel && state.duel.waiting), done: !!(state.duel && state.duel.done), busy: state.busy }));
      if ((!s.duel && !s.busy) || s.done) break;
      if (s.waiting) {
        const o = await page.evaluate(() => state.duel.D.options(state.duel.me));
        await page.keyboard.press(o.super.ok || o.ult.ok ? '5' : o.threat ? '6' : o.sig.ok ? '4' : o.focus.ok && o.ch < 10 ? '7' : o.nin.ok ? '2' : '1'); moves++;
      } else await page.click('#cmdslot [data-action="skip"]').catch(() => {});
      await page.waitForTimeout(120);
    }
    return moves;
  };
  await page.evaluate(() => { state.settings.mode = 'classic'; state.settings.draft = 'pick'; state.settings.size = 8; state.squad = ['lee2', 'gaara2', 'kakashi1']; state.captain = 'lee2'; renderDraft(); });
  await page.click('[data-action="start"]');
  await page.click('[data-action="speed"][data-val="fast"]');
  await page.evaluate(() => { while (!hasSquad(curMatch())) finalize(curMatch(), simFight(curMatch().a, curMatch().b)); refreshAll(); showUpcoming(); });
  const m0 = await page.evaluate(() => state.m);
  await page.click('[data-action="playme"]');
  const moves = await playOut();
  await page.waitForFunction(() => !state.busy && !state.duel, null, { timeout: 20000 }).catch(() => fail.push('controlled fight did not hand back'));
  const pm = await page.evaluate(m0 => { const m = state.rounds[0][m0]; return { played: !!m.played, done: !!m.result, next: state.m, end: m.result && m.result.log[m.result.log.length - 1].type, ribbon: /You fought/.test(document.getElementById('mgrid').textContent) }; }, m0);
  ok(moves >= 1 && pm.played && pm.done && pm.next === m0 + 1 && pm.end === 'end' && pm.ribbon, `fight it yourself: moves ${moves} ${JSON.stringify(pm)}`);
  // the controlled fight can be replayed like any other
  await page.click(`.mc.done[data-m="${m0}"]`);
  await page.waitForFunction(() => state.busy, null, { timeout: 5000 }).catch(() => {});
  await page.click('[data-action="skip"]').catch(() => {});
  await page.waitForFunction(() => !state.busy, null, { timeout: 20000 }).catch(() => fail.push('replay of a controlled fight did not finish'));
  await page.click('[data-action="newdraft"]');

  // 13. quick fight: pick two fighters, play, rematch; abandoning mid-fight is clean
  const xp0 = await page.evaluate(() => PROF.xp);
  await page.click('[data-action="quick"]');
  ok(await page.evaluate(() => state.screen === 'versus' && !!document.getElementById('vsme')), 'quick fight screen');
  await page.selectOption('#vsme', 'guy2'); await page.selectOption('#vsfoe', 'iruka');
  await page.click('[data-action="speed"][data-val="fast"]');
  await page.click('[data-action="vsfight"]');
  await page.waitForFunction(() => state.duel && state.duel.waiting, null, { timeout: 15000 }).catch(() => fail.push('quick fight never asked for a move'));
  // force the opponent's Super to be ready: the bar must warn and offer Guard
  await page.evaluate(() => { const D = state.duel.D; D.f[1].um = RULES.supAt; D.f[1].readyT = D.f[1].superT = -1; D.f[0].um = RULES.ultAt; D.f[0].readyT = -1; renderDuel(); });
  ok(await page.evaluate(() => /SUPER ULTIMATE is READY/.test(document.getElementById('cmdslot').textContent) && !!document.querySelector('.cbtn.grd.hot')), 'no warning when the opponent Super is ready');
  await page.evaluate(() => document.getElementById('cmdslot').scrollIntoView({ block: 'end' })); await shot('12_quickfight');
  await playOut();
  await page.waitForFunction(() => !state.busy && state.vs.last, null, { timeout: 20000 }).catch(() => fail.push('quick fight did not finish'));
  const qf = await page.evaluate(() => ({ last: state.vs.last, xp: PROF.xp, btn: !!document.querySelector('[data-action="vsfight"]') }));
  ok(qf.last && qf.btn && qf.xp === xp0 + (qf.last.won ? 15 : 0), 'quick fight result ' + JSON.stringify(qf));
  await page.click('[data-action="vsfight"]');
  await page.waitForFunction(() => state.duel && state.duel.waiting, null, { timeout: 15000 }).catch(() => fail.push('rematch never asked for a move'));
  await page.click('[data-action="back"]');
  ok(await page.evaluate(() => state.screen === 'draft' && !state.duel && !state.busy && !state.stage), 'leaving a quick fight mid-fight');

  // 14. clear history
  await page.click('[data-action="history"]');
  await page.click('[data-action="clearhist"]');
  await page.click('[data-action="clearyes"]');
  ok(await page.evaluate(() => HIST.n === 0 && JSON.parse(localStorage.getItem('fst_hist')).n === 0), 'clear history');

  if (errors.length) fail.push(...errors);
  console.log(fail.length ? 'FAILED:\n' + fail.join('\n') : 'meta ok');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
