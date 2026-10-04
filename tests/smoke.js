// UI smoke test: every bracket size finishes, one version per character in every round,
// Skip animation works mid-fight, replays work, no page errors.
const { open } = require('./lib');

(async () => {
  const { browser, page, errors } = await open({ offline: true });
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  const click = async sel => { await page.click(sel); };

  for (const size of [8, 16, 32, 64]) {
    await page.evaluate(() => { state.squad = []; renderDraft(); });
    await click(`[data-action="set"][data-key="size"][data-val="${size}"]`);
    await click('[data-action="random"]');
    await click('[data-action="start"]');
    const field = await page.evaluate(() => state.rounds[0].flatMap(m => [m.a, m.b]).map(f => ({ id: f.id, base: f.base })));
    ok(field.length === size, `size ${size}: field has ${field.length}`);
    ok(new Set(field.map(f => f.base)).size === size, `size ${size}: a character appears twice in round 1`);
    const squadIn = await page.evaluate(() => state.squad.every(id => state.rounds[0].some(m => m.a.id === id || m.b.id === id)));
    ok(squadIn, `size ${size}: squad not all in the bracket`);
    await click('[data-action="simall"]');
    const res = await page.evaluate(() => ({
      champ: state.champion && state.champion.id, rounds: state.rounds.length,
      dup: state.rounds.some(rd => new Set(rd.flatMap(m => [m.a.base, m.b.base])).size !== rd.length * 2),
      allDone: state.rounds.every(rd => rd.every(m => m.result)), pts: Object.values(state.pts).every(p => p >= 0),
      finalShown: !!document.querySelector('#stage') && /wins the tournament/.test(document.body.textContent)
    }));
    ok(res.champ, `size ${size}: no champion`);
    ok(res.rounds === Math.log2(size), `size ${size}: ${res.rounds} rounds`);
    ok(!res.dup, `size ${size}: duplicate character in a round`);
    ok(res.allDone && res.pts && res.finalShown, `size ${size}: incomplete end state ${JSON.stringify(res)}`);
    console.log(`size ${size}: champion ${res.champ}`);
  }

  // watch a live fight at fast speed, skip it part-way, then replay a finished fight and skip that too
  await page.evaluate(() => { state.squad = []; renderDraft(); });
  await click('[data-action="set"][data-key="size"][data-val="8"]');
  await click('[data-action="random"]');
  await click('[data-action="start"]');
  await click('[data-action="speed"][data-val="fast"]');
  await click('[data-action="watch"]');
  await page.waitForTimeout(2500);
  ok(await page.evaluate(() => state.busy), 'watch: not busy after 2.5 s');
  await click('[data-action="skip"]');
  await page.waitForFunction(() => !state.busy, null, { timeout: 15000 }).catch(() => fail.push('skip: fight did not finish within 15 s'));
  const after = await page.evaluate(() => ({ m: state.m, done: !!state.rounds[0][0].result, log: document.querySelectorAll('#log li').length }));
  ok(after.m === 1 && after.done, 'skip: first match not recorded ' + JSON.stringify(after));
  ok(after.log > 3, 'skip: log not filled');

  await click('.mc.done');
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => state.busy), 'replay: did not start');
  await click('[data-action="skip"]');
  await page.waitForFunction(() => !state.busy, null, { timeout: 15000 }).catch(() => fail.push('replay: did not finish'));
  ok(await page.evaluate(() => state.m === 1), 'replay changed the bracket');

  // a full fight watched without skipping, at fast speed, must finish
  await click('[data-action="watch"]');
  await page.waitForFunction(() => !state.busy, null, { timeout: 120000 }).catch(() => fail.push('watch: full fight did not finish in 120 s'));
  ok(await page.evaluate(() => state.m === 2), 'watch: second match not recorded');

  // new draft while a fight is playing must stop it cleanly
  await click('[data-action="watch"]');
  await page.waitForTimeout(1500);
  await click('[data-action="newdraft"]');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => state.screen === 'draft' && !state.stage), 'new draft during a fight left a stage running');

  if (errors.length) fail.push(...errors);
  console.log(fail.length ? 'FAILED:\n' + fail.join('\n') : 'smoke ok');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
