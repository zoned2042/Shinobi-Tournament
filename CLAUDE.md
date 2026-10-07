# Fantasy Shinobi Tournament

A single-file browser game: draft a squad from Naruto characters (or spin for it), then watch a single-elimination
tournament (8/16/32/64 fighters) play out as animated canvas fights, or fight your squad's matches yourself
(turn-based: you pick each technique). Quick fight lets you play any two fighters against each other. Fan project, no external art:
every character, effect and background is drawn in code. Same creator as Shinobi Life
(https://github.com/zoned2042/shinobi-life, a BitLife-style Naruto life sim): the page says "From the creator of
Shinobi Life" and the footer links that repo. The UI follows Shinobi Life's look: its "Deep Field" palette (near-black,
amber `#e08a3c` accent) and "Old Scroll" light theme, Georgia serif titles, spaced-caps kicker lines, film grain and
rising embers. CSS tokens live on `:root` (`--serif`, `--soft`, `--glow`, `--edge`); the canvas keeps its own fonts.

- Entry point: `index.html` (about 4,600 lines, HTML + CSS + one `<script>`, no build step, no dependencies).
- Originally built and published as a Claude artifact: https://claude.ai/artifact/Ng4jRYAvPF7r3B9QLgtmZ3
- Keep it a SINGLE self-contained HTML file. It must keep working when published as an artifact
  (CSP allows scripts only from cdnjs/jsdelivr/jquery, nothing else; fonts come from Google Fonts with fallbacks).
  Wrap every `localStorage` use in try/catch (keys: `fst_best2` best scores, `fst_theme`, `fst_sound`, `fst_hist` history, `fst_prof` XP/spins/last visit day).

## Run and test

```
npm install                       # installs playwright only (used by tests)
npx playwright install chromium   # skip if a Chromium build is already present (set CHROMIUM_PATH to use another one)
npm run serve                     # or just open index.html in a browser
npm run test:smoke                # all bracket sizes, one-version-per-character, skip mid-fight, replay, new draft mid-fight
npm run test:meta                 # tournament types (every size/seed/field), squad names, story, history + reload,
                                  #   spectator (pause, skip to the final), spins/XP, fight it yourself, quick fight,
                                  #   clear history; screenshots in tests/out/meta_*.png
node tests/moves.js all           # every version x {sig,ult,super,tai,nin,gen,focus,guard} x {hit,dodge,ko,crit,skip}, checks for errors,
                                  #   hangs, leftover fx/props/mood/camera and fighters not reset (~2,300 runs, ~1 min;
                                  #   split with: node tests/moves.js ult 0 3 / 1 3 / 2 3, or name ids: node tests/moves.js sig itachi1)
npm run test:balance              # Ultimate/Kinjutsu rate, damage caps, KO rate, upsets, champion spread (exits 1 if a target is missed)
node tests/frames.js kaguya ult   # contact sheet of stage frames in tests/out/ so you can LOOK at an animation
node tests/frames.js all ult ko   #   one sheet per version; "styles" instead of "all" = first user of each style
node tests/titles.js              # every Ultimate, Kinjutsu and signature cut-in title, frozen when fully revealed
npm run portraits                 # contact sheet of every look to tests/out/portraits.png
node tests/look.js itachi1,pain    # close-up of a look: big portrait, face icon, fighter in 6 poses at 2x
node tests/look.js crow,kazekage   #   also takes puppet looks (PUP_LOOK keys): figure only
npm run sounds                    # renders every effect + the busiest moments offline to tests/out/sfx.wav, reports peaks/clipping
npm run layout                    # phone-width screenshots (draft, bracket, arena, story, history, modes, spectator) + overflow check
```

Always look at frames after changing visuals; passing tests only prove nothing crashes or hangs.
`tests/harness.js` is injected into the page and drives a `Stage` by hand (16 ms steps), so playback in tests is
deterministic and much faster than real time. In sandboxes whose proxy re-terminates TLS, `tests/lib.js` fetches
Google Fonts through curl so the canvas text uses the real fonts.

## Map of index.html (search for these markers)

| Section | What lives there |
|---|---|
| `ROSTER` | `C(id,name,short,base,tags,form,[nin,tai,gen,spd,sta,int],sig,sigType,opts)`. 91 versions of 64 characters. `id` = unique version, `base` = character family, `short` = unique display name. opts: `regen`, `guard` (chance to halve damage), `last` (survive one lethal hit), `mv` (ninjutsu names). Stats 0-130. |
| `MOVES` | Per-`base` lists: `tm` taijutsu, `mv` ninjutsu, `gj` genjutsu names. Merged into ROSTER at load. `jutsuFx(name,baseFx)` picks projectile visuals from keywords in the name. |
| `FX` | Per-`base` projectile colours/shape (`orb`, `rasen`, `bolt`, `wave`, `swarm`, `shards`). |
| `LK` / `lookOf` | Per-`base` and per-`id` look: skin `sk`, hair `hr`/`hs` (style), eyes `ey`/`es`, outfit `tp bt sl sv os vs`, headband `bd`, mask `mk`, marks `mr[]`, back item `bk`, glow, `bw` body width. Hokage tag auto-applies robe+hat; `Edo` tag auto-applies cracked grey skin. `cl` = Akatsuki clouds (`drawCloud`), `hc` = high collar on the portrait, `chk` = glowing chakra-cloak body with seal markings (Kurama/Baryon/Six Paths Naruto), `nohat` = Hokage without the auto hat, `bd:'helmet'`, `mk:'bandage'`, `bk:'cleaver'`, `sv:'warm'` (arm warmers). |
| `drawHead`, `hairFront/Back`, `drawMarks`, `drawEye`, `drawPortrait`, `faceURL`, `drawCloud` | Head-frame drawing (origin at head centre, +x forward, -y up). Used by in-fight fighters, both cut-ins and face icons. |
| `RULES` | All big-move and Guard numbers in one place (gauge gains, thresholds, AI fire chances, damage bases and caps, Guard multiplier). Re-run `npm run test:balance` after touching it. |
| `makeDuel(A,B)` / `simFight(A,B)` | `makeDuel` is the rules, one action at a time: `act(i,choice)` (no choice = the AI's weighted pick; `tai nin gen sig ult super guard focus` = the player's), `order()` (speed roll per turn), `endTurn()` (chakra, gauge, cooldown, regen), `over()`, `options(i)` (what is usable + hit/trap odds for the command bar), `result()`. `simFight` loops it with the AI on both sides and returns `{winner,loser,ko,hpLeft,log,turns,ultW,ultL,supW,supL}` (`ultW` = winner landed a big move, `supW` = it was the Super). `focus` (+30 chakra) and `guard` (all damage that turn x0.4, +10 chakra, always acts first) exist only for the player; log types `'focus'` / `'guard'`. Log entries also carry `sm` (Super charge 0-100) and `uu` (2 = big move spent); a Super is `mv:'ult'` with `sup:true`. |
| `SUPERMAP` / `supOf` / `KIN` | Kinjutsu ("forbidden technique"; called "super" in code, e.g. `e.sup`, `supOf`): the tier above the Ultimate, each character's top technique. The player-facing name is the one constant `KIN`. Hashirama's is Sage Art Shinsu Senju, Thousand-Armed Kannon. Same format and styles as `ULTMAP`; played with `big:true`, a gold "KINJUTSU" cut-in (`ultCut.sup`) and a gold impact (`stage.superOn` in `ultHit`). `titan` has a `kannon` mode (golden halo of 40 arms striking in three waves). |
| `Sfx` | Tiny WebAudio synth (no assets). `tone(...,at)` schedules on the audio clock. Measured worst case (stacked KO impacts) peaks at ~0.55 of full scale, so there is no limiter. |
| `class Stage` | Canvas renderer + animation engine. Fighters are skeletons driven by pose angles (`POSES`). Plays log entries as animations. `titleLayout` breaks Ultimate titles into 1-4 lines. |
| `SIGMAP` / `STYLES` | 33 staged signature moves, keyed by id or base. Unmapped characters fall back to a generic move by `sigType` (currently none). |
| `ULTMAP` / `ULTS` | 20 Ultimate choreographies, keyed by id or base. Fallback by sigType via `ULTFB`. |
| `PUPPETS` / `PUP_LOOK` / `mkPup` / `pupFree` / `pupHome` | Puppet masters (Kankuro: Crow; Chiyo: Mother and Father; both Sasoris: the Third Kazekage). `Stage.mk` gives each fighter `f.pups`: pseudo-fighters drawn with `drawFighter` (look from `PUP_LOOK`, `pup:true` = wooden limbs with ball joints and a hinged jaw; `arms4`, `tail`, `bk:'shell'`) that hover behind their master (`p.off`) on chakra threads (`drawThreads`) while `p.follow` is set, and drop when the master is KO'd (`p.down`). The puppet does the master's tai and nin (`pupFree` takes it off follow), steps in front on Guard, raises its arms during other big moves. Signature style `puppetry` (`m:'crow'|'pair'|'sand'`), Ultimate styles `army` with `pk` (real puppet looks: `CHIKA` ten, `HUNDRED` for Sasori) and `threepup` (Kankuro: Salamander shields, Black Ant swallows, Crow's blades; `sasori:true` adds the Sasori puppet for the Kinjutsu). `recover()` hands every puppet back (`pupHome`); `T.check` fails a run that leaves a puppet off its threads. |
| `LINES` / `Announcer` | Live commentary ticker text. |
| `APP STATE AND UI` | Draft screen, settings, bracket tabs, arena HUD, `playSim`, scoring (`finalize`), events. |
| `MODES` / `ERA` / `VILLAINS` / `TAI_MASTERS` / `akaSide` | Tournament types. A mode is `{id,t,d,ok(f,era),pick(f),max}`; `ok` filters versions for the field AND the draft, `pick` further limits what the player may draft or spin (`draftable`), `max` caps the bracket. Themed types stay in their story period: Akatsuki War = Shippuden/War versions only (`inEra(f,'SW')`), sides by version (`akaSide`: Akatsuki-tagged + `AKA_ALLIES`), up to 32; Edo Rising = Edo-only squad (`pick:isEdo`), living defenders from the War era; Taijutsu Masters = the explicit `TAI_MASTERS` list. Classic, Legends, Kage Clash, Underdogs, Villains and Random Chaos are deliberate all-eras dream matches. `buildField` has the special cases (Akatsuki War pairs the two sides in round 1, Edo Rising puts Edo versions first, Random Chaos rolls versions, squad included). `ERA[id]` = eras a version fits (`1` Part I, `S` Shippuden, `W` War, `N` Next Gen). `state.settings.mode` is the draft choice, `state.mode` the running tournament's. |
| `TEAMS` / `FACTIONS` / `squadIdent` / `drawEmblem` | Squad identity: name from team/clan rules (needs at least half the squad) or a faction majority, else a style-based name; style = majority signature type + best of spd/sta/int; rating = mean overall. Emblem symbols drawn in code. Scoring: +4 style bonus (`styleHit`), captain x1.5. |
| `HIST` / `recordTournament` / `liveRec` | History saved under `fst_hist`: `{v:1,n,list[≤60 summaries],f:{id:{w,l,ko,u,up,t,fi,sf,e,b,st,bs}},h2h:{'baseA\|baseB':[wins,wins]},my:{p,t}}`. Committed once, when a tournament ends (`state.saved`). `liveRec(id)` = saved record + the tournament in progress. |
| `tell` / `storyFight` / `storyRound` / `storyChampion` / `storyline` | The tournament story: events `{k,t,x,r,mi}` (kind, title, text, round, match index or null for round-level). Shown as the headline strip, the Story tab, ribbons on match cards and round notes. `storyline(a,b)` = pre-fight talking points (defending champ, head-to-head, streaks, upsets, titles, captain). |
| `spectateLoop` / `worthWatching` | Spectator mode: no squad, auto-runs. Sims each fight first (pure), plays it only if worth watching (quarterfinals on, upsets, Ultimates, close finishes, story fighters, at least one per round), batches the rest "off camera". |
| `renderHistory` | History screen: tournament cards, champions table, records table (by version or character). |
| `playControlled` / `duelPanel` / `fightYourself` / `renderVersus` | Fights you control. `playControlled(a,b,me,o)` steps a `makeDuel`, asks for your move (`askMove`, buttons or keys 1-6), lets the opponent's AI answer, and plays every new log entry on the Stage; returns a `simFight`-style result, so `finalize`, replays, history and story treat it like any fight. The command bar renders into `#cmdslot` under the canvas; the stage shrinks (`.arena.duel`) so both fit on a laptop screen. "Fight it yourself" appears when your squad member is up; Quick fight (`state.vs`) is its own screen, a win gives 15 XP. "Let the AI finish" hands the rest of the fight to the AI. |
| `PROF` / `grantXP` / `RANKS` / `RARITY` / `doSpin` | Ninja profile saved under `fst_prof` `{xp,spins,day}`. XP per finished tournament = squad points + 25 (x2 for a spun squad, 10 for spectating); level L needs `xpAt(L)=30L(L+1)` XP; each level gives 5 spins, a squad title 3, a new day 10 (`dailySpins`). Rarity is the tier: C Common, B Rare, A Legendary, S Mythic. Spin draft (`state.settings.draft='spin'`) rolls rarity by weight (50/30/15/5) among eligible characters not already in the squad, with a reel animation (plain `setTimeout`: UI, not the Stage). |

## Core contracts

**Log entry** (from `simFight`, consumed by `Stage.playEntry`): `{text,type,hp:[a,b],ch:[a,b],um:[a,b],att,tgt,mv,name,dmg,dodge,crit,guard,stun,surv,ko,skip,resist,who,heal,st,win}`
where `mv` is `tai|nin|gen|sig|ult`, `att/tgt` are 0/1, `st` is the attacker's sigType. `type:'info'` is the intro, `'heal'` is regen, `'end'` is the result.

**Stage conventions** (break these and animations hang or desync):
- Every duration goes through `this.d(ms)` (playback speed). Never use raw `setTimeout` for animation.
- Use `await this.wait(ms)`, `this.tween(obj,props,ms,ease)`, `this.pose(f,name,ms)`. They resolve instantly while `this.skipping` is true (that is how "Skip animation" works), so loops must be bounded and must not wait on real time.
- `tween()` on the same object/keys cancels and early-resolves the previous tween.
- Custom visuals: `this.fxAdd(durMs,(ctx,k,o)=>{...},back)`. `back=true` draws behind fighters. Set `ef.t=ef.dur` to remove early, on EVERY exit path (dodge paths return early; `tests/moves.js` flags layers still alive 1.5 s after the entry).
- A signature/ultimate style must: do its windup, call `await this.impact(...)` (signatures) or `await this.ultHit(...)` (ultimates) at the moment of contact (they handle dodge, damage popup, KO finisher, HP bar), and let `sigEnd`/`ultEnd` reset state. Start dodge early with `const pd=this.pdodge(e,A,D)` and pass `{pd}`.
- Coordinates: stage is 800x450, ground line `GY=372`, fighter homes x=240 (left, face +1) and x=560 (right, face -1). Fighters are drawn ground-fit; `lift` raises them; `pose.rot` rotates around the hip.
- `state.run` is bumped on new tournament/draft so stale async playback stops. Do not call `buildArena` while a fight is playing.
- `stage.paused` freezes the stage clock (the frame loop passes dt=0); `playSim`'s per-entry time limit (`stageGuard`) stops counting while paused.
- A controlled fight resets `stage.skipping=false` before every turn, so "Skip animation" only skips the turn that is playing.

## Recipes

- **Add a character version:** add a `C(...)` row in ROSTER (new `id`; reuse `base` for another form of the same character), add look data to `LK` (by `id` for form-specific changes), optionally `MOVES[base]`, `SIGMAP`, `ULTMAP`. Base count must stay >= bracket size for a 64 bracket (currently exactly 64 bases).
- **Add a signature style:** add `async name(e,A,D,fx,P){...}` to `STYLES`, map characters in `SIGMAP` as `[ 'name', {params} ]`.
- **Add an Ultimate style:** add to `ULTS`, map in `ULTMAP` as `{s:'style',n:'Move name',c:'#hex',c2:'#hex',...params}`. Cut-in is automatic.
- **Add a hair style / mark:** `hairFront`/`hairBack` switch on `L.hs`; `drawMarks` switch on mark name.
- **Add a tournament type:** add `{id,t,d,ok}` to `MODES` (needs at least 8 characters; `maxSize()` works out the biggest bracket), and a case in `buildField` only if the field is not just "eligible versions". `tests/meta.js` checks every type at every size.
- **Add a squad name:** a row in `TEAMS` (character bases + how many needed) or `FACTIONS` (a test on the fighter); emblem symbol from `drawEmblem`.
- **Add a story beat:** call `tell(kind,title,text,round,matchIndex)` from `storyFight` (after each fight), `storyRound` (round done) or `storyChampion`. Kinds: `upset squad round champ streak war ko` (colours in CSS `.k-*`).

## Balance model (in `simFight`)

Damage = `base * (0.82+0.42*pow/100) * defenseFactor * rand(0.65..1.35) * formRoll`, crit chance from intellect, dodge from speed/intellect gaps.
Big moves (numbers in `RULES`): one per fight. The gauge fills +0.7x damage dealt, +0.5x taken, +2.5 per turn. At 100 the Ultimate
is ready, at 125 the Kinjutsu; each unlocks the turn AFTER its threshold is crossed (a warning turn the player can Guard on).
The AI fires a ready Ultimate 45% of turns (otherwise it holds for the Kinjutsu), a ready Kinjutsu 90%. Ultimate base 36, capped at 35
damage, dodge x0.2; Kinjutsu base 58, capped at 50, dodge x0.15. This was retuned after players were one-shot by Ultimates: before,
an uncapped Ultimate (avg ~47, crits 60+) fired the moment a beaten-down opponent's gauge filled (the gauge filled mostly from
damage taken). Measured now: a big move in ~64% of fights, a Kinjutsu in ~14%, nothing over the caps; a simple player strategy wins ~80%
against similarly rated AI and dies to a big move in ~13% of fights.
Targets while tuning: about half of fights contain an Ultimate, 25+ distinct champions across 300 simulated 64-brackets, no fighter over ~20% of titles. Edo Tensei versions were nerfed once already for winning too often; re-check with `npm run test:balance` after changing stats.

## State of the work

Verified (Oct 2026):
- `node tests/moves.js all`: 2,548 runs (Super, Focus and Guard included), 0 failures. Every version's signature, Ultimate, tai, nin and gen moves in
  hit/dodge/KO/crit plus Skip-mid-move, from both sides: no errors, hangs, leftover fx/props/mood/camera, fighters reset.
- `npm run test:smoke` (8/16/32/64 brackets, one version per character, skip, replay, new draft mid-fight) passes.
- Frames of all 91 Ultimates (hit) were looked at, plus dodge/KO/crit sheets of every Ultimate style and KO against an
  Edo defender. Every Ultimate and signature cut-in title was looked at (`tests/titles.js`), none overflow.
- Shino/Zetsu/Hanzo/Sai plague swarm redone and checked (it used to read as falling snow).
- Akatsuki Itachi has a custom signature (`crows`: crow flock + Mangekyo Tsukuyomi), checked in hit/dodge/KO.
- Puppet masters fight with visible puppets (see `PUPPETS`): moves suite 2,548 runs clean, plus every version's sig/ult/tai/nin/gen
  (hit/KO/skip) against Chiyo and Kankuro as defenders (2,700 runs, 0 failures). Frames looked at: idle, tai, nin, Guard, every
  puppet signature, all three puppet Ultimates (hit/dodge/KO) and Kankuro's Kinjutsu, a puppet master KO'd.
- Sound: `npm run sounds` renders every effect and the busiest stacked moments; worst peak 0.54 of full scale, no
  clipping. The effects have still never been HEARD by a person: listen to `tests/out/sfx.wav`.
- Phone layout at 390 and 360 px: no horizontal overflow; squad tray is one scrolling row, the live ticker sits under
  the canvas instead of covering the fighters. Checked on Chromium's mobile emulation only, not a real device.
- Balance targets pass: big move in ~64% of fights (Kinjutsu ~14%), 28-29 distinct champions / 300 brackets, top fighter ~15-19%,
  Edo champions ~39-46% across runs (was ~49%).
- Every Kinjutsu title fits its cut-in (`tests/titles.js`); Kinjutsu frames looked at for Hashirama (Kannon), Kurama
  Naruto, Prime Madara, Pain, Night Guy.
- Meta layer (tournament types, squad identity, story, history, spectator): `npm run test:meta` passes: every type builds
  valid fields at every allowed size/seed/field setting, records add up (wins = losses = fights, one title per
  tournament), history survives a reload, spectator plays every fight of an 8 bracket and "Skip to the final" works.
  Draft, bracket, story, history and spectator screens were looked at on desktop and at 390/360 px.

Worth knowing:
- Early dodges in staged moves are a Substitution Jutsu (log takes the hit, see `substitute`/`reappear`); the
  announcer calls the dodge when it visibly happens (`onSay('miss')`), not before the move.
- `skeleton(pose)` / `jointAt(...)` give joint positions, so effects can attach to a giant's hand or head.
- Every fight in 5,000 simulations ended by KO (time decisions never happen), and Edo Tensei versions take about
  half of all titles even though only 10 of 91 versions are Edo. Both are inside the stated targets; flagging them
  in case they are not intended.
- The overall rating ignores traits, and `last` (last stand) is worth far more than it says: against random
  opponents Eighth Gate Guy (overall 69) wins 91%, Edo Hashirama 93%, Edo Zabuza/Kakuzu ~83%, Hidan (64) 64%, while
  Hokage Kakashi (95) wins 51%. So many "upsets" in the story and history are these fighters. Not changed; it is a
  combat-balance decision.

Backlog ideas: custom stat editing, team-vs-team brackets, story mode with a boss, per-character basic-attack
animations, save/share a bracket, more Edo versions, a real-device phone pass, export/import history, rivalries page
(head-to-head data is already stored in `HIST.h2h`), a bracket tree view for spectator mode.
