# Fantasy Shinobi Tournament

A single-file browser game: draft a squad from Naruto characters (or spin for it), then watch a single-elimination
tournament (8/16/32/64 fighters) play out as animated canvas fights, or fight your squad's matches yourself
(turn-based: you pick each technique). Quick fight lets you play any two fighters against each other. Fan project, no external art:
every character, effect and background is drawn in code. Same creator as Shinobi Life
(https://github.com/zoned2042/shinobi-life, a BitLife-style Naruto life sim): the page says "From the creator of
Shinobi Life" and the footer links that repo. The UI follows Shinobi Life's look: its "Deep Field" palette (near-black,
amber `#e08a3c` accent) and "Old Scroll" light theme, Georgia serif titles, spaced-caps kicker lines, film grain and
rising embers. CSS tokens live on `:root` (`--serif`, `--soft`, `--glow`, `--edge`); the canvas keeps its own fonts.

- Entry point: `index.html` (about 6,000 lines, HTML + CSS + one `<script>`, plus a generated data `<script id="snfig">`; no build step, no dependencies).
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
npm run test:meta                 # every Kinjutsu animates differently from its Ultimate, Lee/Guy never use nin/gen and do
                                  #   open gates; tournament types (every size/seed/field), squad names, story, history + reload,
                                  #   spectator (pause, skip to the final), spins/XP, fight it yourself, quick fight,
                                  #   clear history; screenshots in tests/out/meta_*.png
node tests/moves.js all           # every version x {sig,ult,super,tai,nin,gen,focus,guard} x {hit,dodge,ko,crit,skip} (+ gate/drain for
                                  #   Lee and Guy), checks for errors,
                                  #   hangs, leftover fx/props/mood/camera and fighters not reset (~2,300 runs, ~1 min;
                                  #   split with: node tests/moves.js ult 0 3 / 1 3 / 2 3, or name ids: node tests/moves.js sig itachi1)
npm run test:balance              # Ultimate/Kinjutsu rate, damage caps, KO rate, upsets, champion spread (exits 1 if a target is missed)
node tests/frames.js kaguya ult   # contact sheet of stage frames in tests/out/ so you can LOOK at an animation
node tests/frames.js all ult ko   #   one sheet per version; "styles" instead of "all" = first user of each style
node tests/titles.js              # every Ultimate, Kinjutsu and signature cut-in title, frozen when fully revealed
npm run portraits                 # contact sheet of every look to tests/out/portraits.png
node tests/look.js itachi1,pain    # close-up of a look: big portrait, face icon, fighter in 6 poses at 2x
node tests/look.js crow,kazekage   #   also takes puppet looks (PUP_LOOK keys): figure only
node tests/nodes.js <dir> out.png  # contact sheet of Stick Nodes .nodes figures (reference packs the user sends)
node tests/sticknodes/build.js <packs dir>  # rebuild the in-game figures (SNFIG) from unzipped packs, per tests/sticknodes/figures.json
node tests/sticknodes/poses.js     # every figure fighter drawn in 7 poses -> tests/out/sn_poses.png (check the bones)
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
| `ROSTER` | `C(id,name,short,base,tags,form,[nin,tai,gen,spd,sta,int],sig,sigType,opts)`. 95 versions of 66 characters. `id` = unique version, `base` = character family, `short` = unique display name. opts: `regen`, `guard` (chance to halve damage), `last` (survive one lethal hit), `mv` (ninjutsu names), `gates` (Eight Gates user: how many gates it can open; makes it taijutsu only), `sg` (gate its signature forces open). Stats 0-130. |
| `MOVES` | Per-`base` lists: `tm` taijutsu, `mv` ninjutsu, `gj` genjutsu names. Merged into ROSTER at load. `jutsuFx(name,baseFx)` picks projectile visuals from keywords in the name. |
| `FX` | Per-`base` projectile colours/shape (`orb`, `rasen`, `bolt`, `wave`, `swarm`, `shards`). |
| `LK` / `lookOf` | Per-`base` and per-`id` look: skin `sk`, hair `hr`/`hs` (style), eyes `ey`/`es`, outfit `tp bt sl sv os vs`, headband `bd`, mask `mk`, marks `mr[]`, back item `bk`, glow, `bw` body width. Hokage tag auto-applies robe+hat; `Edo` tag auto-applies cracked grey skin. `cl` = Akatsuki clouds (`drawCloud`), `hc` = high collar on the portrait, `chk` = glowing chakra-cloak body with seal markings (Kurama/Baryon/Six Paths Naruto), `nohat` = Hokage without the auto hat, `bd:'helmet'`, `mk:'bandage'`, `bk:'cleaver'`, `bk:'tanto'`, `sv:'warm'` (arm warmers), `hs:'cowl'` (fitted hood), `os:'crop'` (cropped jacket, bare midriff), `es:'kakuzu'`, `cape:{c,fl,len}` (cloak hanging from the shoulders with flame hem), `yk` (dark shoulder yoke, Shippuden jacket), `bdt` (headband tails), `cf` / `wst` (sleeve / waist stripes), `bk:'scroll'`, `staff`. |
| `drawHead`, `hairFront/Back`, `drawMarks`, `drawEye`, `drawPortrait`, `faceURL`, `drawCloud` | Head-frame drawing (origin at head centre, +x forward, -y up). Used by in-fight fighters, both cut-ins and face icons. |
| `RULES` | All big-move and Guard numbers in one place (gauge gains, thresholds, AI fire chances, damage bases and caps, Guard multiplier). Re-run `npm run test:balance` after touching it. |
| `GATES` / `taiOnly` | Eight Gates (Rock Lee 5 / Gates Lee 6 / Might Guy 7 / Eighth Gate Guy 8). Gate users are taijutsu only (`canUse` refuses nin/gen; the command bar shows "Gate N" on key 2 and a disabled Genjutsu). The `gate` move opens the next gate and strikes in the same turn; open gates stack: `GATES[g]` = state with g open, `pw` damage multiplier on tai/sig/big moves (1.04 to 1.5), `sp` speed bonus (dodge and turn order), `dr` HP burned at the end of each turn from gate 4 (never below 1 HP, log type `'drain'`), the Gate of Healing gives 8 HP once. A signature (`d.sg`) or big move (`u.gate`) that needs more gates forces them open. The AI climbs early and saves the Gate of Death for when it is losing. Log entries carry `gt:[g0,g1]` (open gates) and `gate` (highest gate opened by this entry); the Stage plays `openGates` before the move, keeps steam, a gate-coloured aura and (from gate 3) red skin on the fighter (`gateLook`), and `drain()` for the cost. HUD line `#glA/#glB`. |
| `makeDuel(A,B)` / `simFight(A,B)` | `makeDuel` is the rules, one action at a time: `act(i,choice)` (no choice = the AI's weighted pick; `tai nin gen sig ult super guard focus gate` = the player's), `order()` (speed roll per turn), `endTurn()` (chakra, gauge, cooldown, regen), `over()`, `options(i)` (what is usable + hit/trap odds for the command bar), `result()`. `simFight` loops it with the AI on both sides and returns `{winner,loser,ko,hpLeft,log,turns,ultW,ultL,supW,supL}` (`ultW` = winner landed a big move, `supW` = it was the Super). `focus` (+30 chakra) and `guard` (all damage that turn x0.4, +10 chakra, always acts first) exist only for the player; log types `'focus'` / `'guard'`. Log entries also carry `sm` (Super charge 0-100) and `uu` (2 = big move spent); a Super is `mv:'ult'` with `sup:true`. |
| `SUPERMAP` / `supOf` / `KIN` | Kinjutsu ("forbidden technique"; called "super" in code, e.g. `e.sup`, `supOf`): the tier above the Ultimate, each character's top technique. The player-facing name is the one constant `KIN`. Hashirama's is Sage Art Shinsu Senju, Thousand-Armed Kannon. Same format and styles as `ULTMAP`; played with `big:true`, a gold "KINJUTSU" cut-in (`ultCut.sup`) and a gold impact (`stage.superOn` in `ultHit`). Rule (checked by `tests/meta.js`): a version's Kinjutsu never plays the same style+mode as its Ultimate. `titan` has a `kannon` mode (golden halo of 40 arms striking in three waves). |
| `Sfx` | Tiny WebAudio synth (no assets). `tone(...,at)` schedules on the audio clock. Measured worst case (stacked KO impacts) peaks at ~0.55 of full scale, so there is no limiter. |
| `class Stage` | Canvas renderer + animation engine. Fighters are skeletons driven by pose angles (`POSES`). Plays log entries as animations. `titleLayout` breaks Ultimate titles into 1-4 lines. |
| `SIGMAP` / `STYLES` | 33 staged signature moves, keyed by id or base. Unmapped characters fall back to a generic move by `sigType` (currently none). |
| `ULTMAP` / `ULTS` | 28 Ultimate/Kinjutsu choreographies, keyed by id or base. Fallback by sigType via `ULTFB`. Mostly Kinjutsu-tier ones with modes: `gatesKin` (`drunk` Drunken Fist, `peacock` Morning Peacock, `tiger` Daytime Tiger, `elephant` Evening Elephant, `night` Night Guy), `summon` (`kind` toad/slug/salamander/weasel/wolf/snake, drawn by `Stage.drawSummon`), `bind` (`mode` shadow/tree/mind/ritual/chains/hive/water/threads, drawn by `Stage.drawBind`), `barrage` (bomb/shuriken/coral/tsb/lava/swallows), `skyfall` (heel/guillotine/gold/boulder), `beam` (cannon/circus/spear/bone), `giant` (butterfly/hydro, grows the fighter with `scale`), `trigram` (vacuum/palms64/lions). |
| `SNFIG` / `snFig` / `snPose` / `snDraw` / `SNALIAS` / `SNDMG` / `SNGATE` / `SNSUSA` / `snProp` / `EYEFIG` | Stick Nodes figures (community packs from sticknodes.com, credited in the footer) for 62 versions: Konohamaru (hair file riding on the head node), Young, Shippuden, Sage, Kurama, Baryon, Six Paths, The Last and Hokage Naruto, Young Sasuke, Young Hinata, Young Sakura, Rock Lee, Might Guy and Eighth Gate Guy, Kabuto (Sage Mode, assembled from body/head/arm parts), Boruto, Kurotsuchi, Chojuro (Hiramekarei on his back), Hokage Kakashi and Tsunade (Hokage Pack parts), Jugo (curse mark grows: `jugo_m1` at 50 HP, `jugo_m2` at 25), Hidan (Peck Akatsuki pack, scythe in hand), Hiruzen (and Edo), Minato (and Edo), Danzo, Kazekage Gaara, Temari (with her fan), Hawk Sasuke (Kusanagi at the waist), Hinata, Gates Lee, Neji, Shikamaru, Ino, Sakura, Hashirama, Tobirama, Copy Ninja Kakashi, Kimimaro, Itachi (and Edo), Kisame (with Samehada and the pack's separate arm), Deidara (and Edo), Sasori (and Edo), Kakuzu (and Edo), Konan (all The Akatsuki pack; Deidara from Deidara Pack 2), Pain (Pain Pack 2, assembled from parts), Black Zetsu, Orochimaru, Prime Madara (Madara Pack 3, with the gunbai), Rinnegan Madara (the pack's reanimated Madara, gunbai with chain), Tobi, Jinchuriki Obito (the pack's War Obito), plus `SNALIAS` (Edo Hashirama/Tobirama/Kimimaro/Deidara, Eighth Gate Guy reuse a figure; Edo skin turns ashen via `edoPal`). Data lives in `<script id="snfig">`, written by `tests/sticknodes/build.js`: per node parent, type, length, width, angle relative to parent, palette colour, draw order, polyfills, and the skeleton `b` (torso, shoulders, neck, head, both arms, both legs, found by `tests/sticknodes/detect.js`). `Stage.mk` sets `f.sn`; `drawFighter` then calls `snPose(f.sn,pose)` (drives those bones with the game's `POSES`, rotates the torso by `lean`, the head by `hd`, all by `rot`) and `snDraw` instead of drawing the body, so every move, tint, hit flash, trail and KO still works. `SNDMG` swaps a figure for torn ones as HP drops (Shippuden Naruto: `narutoS_d1` at 50 HP, `narutoS_d2` at 25 and on KO; Danzo: his one-armed `danzo_d1` at 50; `Stage.snDamage`, called from `hp()` and `setFinal`). `SNGATE` (by base) swaps Might Guy's figure as gates open, at draw time (`snGateFig`): Lower Gates Open at 3, 7th Gate Open at 7, Night Guy at 8. Portraits/cut-ins/face icons stay drawn. ~1.3 ms per frame for two figures. Effect figures (`prop:true` in figures.json, no skeleton): `SNSUSA` (by base) gives Sasuke the pack's Perfect Susanoo (+ wing) in place of the tinted giant copy in the `susanoo` signature and `titan` arrow/sword Ultimates (`drawFighter` takes `o.sn`); `snProp`/`snPropDraw` draw a prop centred and scaled (the Rasengans pack's Rasengan and Rasenshuriken spin over the chakra glow in `drawOrb` and the `rasen` projectile); `EYEFIG` (by id, then base) puts each Uchiha's own Sharingan/Mangekyo pattern from Sharingan Pack 2 over a red iris in `drawEye` when the iris is at least 4.5 px (portraits, cut-ins). `drawMangekyo(ctx,x,y,R,rot,fig)` draws a giant pack eye over a red disc: the Tsukuyomi moon in the `dimension` style and Itachi's `crows` signature use the caster's eye (`eyeOf`: own `EYEFIG` pattern, Madara = Rinne-Sharingan `eye_rinneSh`, default Itachi's). |
| `PUPPETS` / `PUP_LOOK` / `mkPup` / `pupFree` / `pupHome` | Puppet masters (Kankuro: Crow; Chiyo: Mother and Father; both Sasoris: the Third Kazekage). `Stage.mk` gives each fighter `f.pups`: pseudo-fighters drawn with `drawFighter` (look from `PUP_LOOK`, `pup:true` = wooden limbs with ball joints and a hinged jaw; `arms4`, `tail`, `bk:'shell'`) that hover behind their master (`p.off`) on chakra threads (`drawThreads`) while `p.follow` is set, and drop when the master is KO'd (`p.down`). The puppet does the master's tai and nin (`pupFree` takes it off follow), steps in front on Guard, raises its arms during other big moves. Signature style `puppetry` (`m:'crow'|'pair'|'sand'`), Ultimate styles `army` with `pk` (real puppet looks: `CHIKA` ten, `HUNDRED` for Sasori) and `threepup` (Kankuro: Salamander shields, Black Ant swallows, Crow's blades; `sasori:true` adds the Sasori puppet for the Kinjutsu). `recover()` hands every puppet back (`pupHome`); `T.check` fails a run that leaves a puppet off its threads. |
| `LINES` / `Announcer` | Live commentary ticker text. |
| `APP STATE AND UI` | Draft screen, settings, bracket tabs, arena HUD, `playSim`, scoring (`finalize`), events. |
| `MODES` / `ERA` / `VILLAINS` / `TAI_MASTERS` / `akaSide` | Tournament types. A mode is `{id,t,d,ok(f,era),pick(f),max}`; `ok` filters versions for the field AND the draft, `pick` further limits what the player may draft or spin (`draftable`), `max` caps the bracket. Themed types stay in their story period: Akatsuki War = Shippuden/War versions only (`inEra(f,'SW')`), sides by version (`akaSide`: Akatsuki-tagged + `AKA_ALLIES`), up to 32; Edo Rising = Edo-only squad (`pick:isEdo`), living defenders from the War era; Taijutsu Masters = the explicit `TAI_MASTERS` list. Classic, Legends, Kage Clash, Underdogs, Villains and Random Chaos are deliberate all-eras dream matches. `buildField` has the special cases (Akatsuki War pairs the two sides in round 1, Edo Rising puts Edo versions first, Random Chaos rolls versions, squad included). `ERA[id]` = eras a version fits (`1` Part I, `S` Shippuden, `W` War, `N` Next Gen). `state.settings.mode` is the draft choice, `state.mode` the running tournament's. |
| `TEAMS` / `FACTIONS` / `squadIdent` / `drawEmblem` | Squad identity: name from team/clan rules (needs at least half the squad) or a faction majority, else a style-based name; style = majority signature type + best of spd/sta/int; rating = mean overall. Emblem symbols drawn in code. Scoring: +4 style bonus (`styleHit`), captain x1.5. |
| `HIST` / `recordTournament` / `liveRec` | History saved under `fst_hist`: `{v:1,n,list[≤60 summaries],f:{id:{w,l,ko,u,up,t,fi,sf,e,b,st,bs}},h2h:{'baseA\|baseB':[wins,wins]},my:{p,t}}`. Committed once, when a tournament ends (`state.saved`). `liveRec(id)` = saved record + the tournament in progress. |
| `tell` / `storyFight` / `storyRound` / `storyChampion` / `storyline` | The tournament story: events `{k,t,x,r,mi}` (kind, title, text, round, match index or null for round-level). Shown as the headline strip, the Story tab, ribbons on match cards and round notes. `storyline(a,b)` = pre-fight talking points (defending champ, head-to-head, streaks, upsets, titles, captain). |
| `spectateLoop` / `worthWatching` | Spectator mode: no squad, auto-runs. Sims each fight first (pure), plays it only if worth watching (quarterfinals on, upsets, Ultimates, close finishes, story fighters, at least one per round), batches the rest "off camera". |
| `renderHistory` | History screen: tournament cards, champions table, records table (by version or character). |
| `playControlled` / `duelPanel` / `fightYourself` / `renderVersus` | Fights you control. `playControlled(a,b,me,o)` steps a `makeDuel`, asks for your move (`askMove`, buttons or keys 1-7; key 2 is Open Gate for gate users), lets the opponent's AI answer, and plays every new log entry on the Stage; returns a `simFight`-style result, so `finalize`, replays, history and story treat it like any fight. The command bar renders into `#cmdslot` under the canvas; the stage shrinks (`.arena.duel`) so both fit on a laptop screen. "Fight it yourself" appears when your squad member is up; Quick fight (`state.vs`) is its own screen, a win gives 15 XP. "Let the AI finish" hands the rest of the fight to the AI. |
| `PROF` / `grantXP` / `RANKS` / `RARITY` / `doSpin` | Ninja profile saved under `fst_prof` `{xp,spins,day}`. XP per finished tournament = squad points + 25 (x2 for a spun squad, 10 for spectating); level L needs `xpAt(L)=30L(L+1)` XP; each level gives 5 spins, a squad title 3, a new day 10 (`dailySpins`). Rarity is the tier: C Common, B Rare, A Legendary, S Mythic. Spin draft (`state.settings.draft='spin'`) rolls rarity by weight (50/30/15/5) among eligible characters not already in the squad, with a reel animation (plain `setTimeout`: UI, not the Stage). |

## Core contracts

**Log entry** (from `simFight`, consumed by `Stage.playEntry`): `{text,type,hp:[a,b],ch:[a,b],um:[a,b],sm,uu,gt:[a,b],gate,att,tgt,mv,name,dmg,dodge,crit,guard,stun,surv,ko,skip,resist,who,heal,st,win}`
where `mv` is `tai|nin|gen|sig|ult`, `att/tgt` are 0/1, `st` is the attacker's sigType. `type:'info'` is the intro, `'heal'` is regen, `'drain'` is HP burned by open gates (`who`, `dmg`), `'end'` is the result. `gate` > 0 = this entry opened gates up to that number (`heal` then holds the Gate of Healing HP).

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

- **Add a character version:** add a `C(...)` row in ROSTER (new `id`; reuse `base` for another form of the same character), add look data to `LK` (by `id` for form-specific changes), optionally `MOVES[base]`, `SIGMAP`, `ULTMAP`. Base count must stay >= bracket size for a 64 bracket (currently 66 bases; `tests/balance.js` draws 64 of them per bracket).
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
- Second batch (Oct 2026): Hokage Pack 2 (Hiruzen and Minato, assembled from head/body/arm/leg part files by the
  builder's `parts` option; Hashirama/Tobirama keep their Senju-pack figures, per the user: never replace a character
  that already has a pack figure), Bijuu and Gaara, Temari (body + separate head + fan), Danzo (one-armed damaged form via
  `oneArm`), Naruto Shippuden Pack 2 (Hawk Sasuke, Hinata, Gates Lee, Neji, Shikamaru, Ino, Sakura; its Naruto is
  unused because Shippuden Naruto already has one). Detector fixes: legs prefer the bone that continues the limb (helper
  bones folding back lost), short hip connectors are looked past, arm connectors up to 18 units. Not used: Shukaku,
  Ino genin, the extra kunai. 2,624 move runs, smoke, meta, layout pass.
- Third batch (Oct 2026): Naruto Genin pack (Young Naruto, Young Sasuke, Young Hinata, Young Sakura with the pack's
  separate head, Rock Lee; its Neji and Shikamaru unused, they already have figures), Baryon Mode Naruto, Updated Might
  Guy (four figures, swapped by open gates), Kabuto Yakushi (Sage Mode body + head + front arm). Not used: Kid Naruto
  Pack 3 (a second Young Naruto in part files), Kabuto's normal/snake/cloak forms, hood and snakes, the kid katana.
  Detector fixes: hip and arm connector limits grow with the figure (Guy is ~1,000 units tall), a second leg raised
  forward is found by matching the first leg's length, a bone ending in a circle (a neck carrying a head) is not an arm,
  and a hidden helper bone counts half when picking the forearm (this also fixed Six Paths, Kurama, Hiruzen and Minato,
  whose forearms used to be helper bones and did not bend). 2,624 move runs, smoke, meta, layout pass.
- Fourth batch (Oct 2026), per the user: a new pack for a character that already has a figure REPLACES it (this
  overrides the earlier "never replace" rule). Madara Uchiha Pack 3 (Prime = Body/Head/arms + gunbai; Rinnegan =
  Reanimated parts + gunbai with chain), Pain Pack 2 (torso/head/arms/legs), Boruto Pack 4 (Boruto; Borushiki unused).
  The Tsuchikage and Mizukage packs are Kurotsuchi (Fourth Tsuchikage) and Chojuro (Sixth Mizukage), not Onoki and Mei,
  so they were added as two new versions (Kage tag, eras War + Next Gen, ~40% / ~46% vs random, B tier) with looks,
  moves, signatures (lava flame / iai) and Ultimate/Kinjutsu (Quicklime Prison bind + Golem Mountain Drop; Twin Blade
  Storm + Great Chakra Hammer). Unused: the stone fist props, Madara's long-robe and Hashirama-cells forms, the scythe.
  Builder: `parts.frontLeg`, and `partsAt {arm, head, headFrom, headBack}` for part files drawn around another origin
  (Pain's head is drawn from the waist and goes behind the cloak; `headScale` shrinks a head part drawn bigger than its body, Pain 0.62); with `partsAt` the grafted arms/legs are the skeleton's.
  2,680 move runs, smoke, meta, layout, balance pass.
- Fifth batch (Oct 2026), replacing per the user (Tobirama keeps his Senju figure): Peck Akatsuki pack now draws
  Itachi, Kisame (+ the old pack's Samehada), Kakuzu, Sasori, Konan, Tobi, Black Zetsu and the new Hidan; their Edo
  versions alias the living figure (ashen skin). Its Pain and Deidara are unused: Pain keeps the dedicated Pain Pack 2,
  Deidara uses the dedicated Deidara Pack 2 (`deidara_d1` cloak off at 50 HP, `deidara_d2` C0 marks at 25). Hokage
  Pack: Hokage Naruto (replaces Naruto Pack 8's; cape behind + collar in front via the builder's `extra` parts), Hokage
  Kakashi, Tsunade. Jugo Pack (3 forms), Zabuza Pack (body + arm + leg). Unused: Tsunade without cape, Deidara's clay
  birds/dragon/C2-C4 props. 2,680 move runs, smoke, meta, layout pass.
- Sixth batch (Oct 2026): Konohamaru Pack (Body + hair; arm/torso variants and the knife unused), Sasuke Perfect
  Susanoo 360 (Susanoo 2 + wing, see `SNSUSA`), Rasengans pack (Rasengan, RasenShuriken; the six "load" frames and
  side views unused), Sharingan Pack 2 (2/3 tomoe, Itachi/Sasuke/Shisui/Obito MS, Madara EMS; Rinnegan versions keep
  their Rinnegan). NOT used: Martial Arts Hands pack, saved in Stick Nodes format version 406 (the reader in
  `tests/sticknodes/sn.js` and `tests/nodes.js` handles < 403 only; sticknodes-rs read.rs shows the 403+ layout).
  2,680 move runs, smoke, meta, layout pass.
- Renderer fidelity pass (Oct 2026), after the user said the figures looked chopped and Konan was not Konan:
  Stick Nodes draws CIRCLE nodes (type 2, the only circle type the packs use) as FILLED discs; they used to be drawn as
  rings, which left faces, joints, eyes and the Rasengan hollow. The disc's radius is length/2 + line width/2 (the
  outer edge of the old ring): a small circle with a thick line is a big head (Gaara's face vanished without it). Also now honoured (semantics from sticknodes-rs
  node.rs): segment scale (offset AND thickness x node scale when `use_segment_scale`), the figure colour for nodes and
  polyfills that do not use their own, trapezoid end ratio (was read for ellipses by mistake, so trapezoids drew as
  rectangles), curved segments (`K`, degrees of bend, also along polyfill edges; direction is a best guess: no
  reference renderer, sticknodes.com is blocked here), half arcs (`H`), gradients (`G`), circle outlines (`U`),
  polygon nodes (`V`). Line width stays thickness/2 (head-to-limb proportions and the hair framing faces confirm it).
  Sizing: every figure is scaled to the same standing height (legs + hips-to-head = 138), not the same leg length;
  swap figures (damage, gates, curse marks) keep their base's legs (`SWAPOF` in build.js), `size` tweaks one (Baryon
  x1.2). Konan, Itachi (+Edo), Kisame, Kakuzu (+Edo), Sasori (+Edo) and Tobi went back to The Akatsuki pack figures,
  which look like the characters once circles are filled; Peck Akatsuki is kept only for Black Zetsu and Hidan.
  Zabuza's pack figure was dropped (its parts did not assemble into a usable body); Zabuza is drawn again.
  Builder `drape: [[startNode, angleDeg, bendDeg], ...]` re-aims cloth chains a pack saved flung out in an action pose
  so they hang (Kazekage Gaara's coat tails stuck out sideways like wings).
- Stick Nodes figures (Oct 2026): six packs the user sent (Naruto Pack 8, The Akatsuki, Senju Brothers, Kakashi Hatake,
  Kimimaro Kaguya, Obito 360) drive 30 versions. Naruto Pack 8 also added two versions: Shippuden Naruto (`narutoS`, B tier,
  ~40% vs random, tears up at 50/25 HP) and The Last Naruto (`narutoL`, ~68%); neither regenerates, which kept the Ultimate
  rate inside its 35-65% target (it hovered at 65% with regen). `tests/sticknodes/poses.js` sheet and fights looked at; `node tests/moves.js all` 2,568 runs,
  smoke, meta and layout pass. The pack files themselves are not in the repo (rebuild needs them unzipped somewhere).
  Not used yet: teen Kakashi, Kimimaro's curse-mark/bone forms, Kisame and Kakuzu without
  cloaks, the masked War Obito, Orochimaru's newer outfit, Sasori's true form.
- Kakuzu and Sai redrawn from reference art (Oct 2026): Kakuzu has a fitted grey cowl (`hs:'cowl'`) with a slashed
  forehead protector, black mask, red-sclera green eyes (`es:'kakuzu'`), high collar, grey pants with white shin wraps;
  Sai has very pale skin, a black Leaf headband, a cropped jacket with red trim and bare midriff (`os:'crop'`) and a
  sheathed tanto (`bk:'tanto'`). Looked at in close-up (`tests/look.js`) and at fight size.
- Naruto redrawn from the user's Stick Nodes "Naruto Pack 8" (Oct 2026, viewed with `tests/nodes.js`; the pack itself is
  not in the repo): Sage Naruto = Shippuden black-and-orange jacket, red cloak with black flames, toad scroll, black
  headband with tails; Hokage Naruto = white cloak with red flames over orange/black, sleeve and waist stripes, no hat or
  headband; Six Paths = black pants and the shakujo staff; Kurama mode = flared chakra coat, black headband; Baryon
  has no headband. (In fights these versions now use the pack figures themselves; the drawn looks remain for portraits.)
- Eight Gates (Oct 2026): Lee and Guy are taijutsu only and climb the gates (`GATES`). Simulated win rates vs random
  opponents: Rock Lee ~46%, Gates Lee ~66%, Might Guy ~65%, Eighth Gate Guy ~91% (same as before the gates; his `last`
  trait, see below). Frames looked at: a gate opening, every gate finisher, the command bar at 390 px and on desktop.
- Distinct Kinjutsu (Oct 2026): 53 versions used to replay their Ultimate's animation; every Kinjutsu now has its own
  (new styles above, plus remaps: Zetsu army, Konan supernova, Iruka rainUlt, Mifune blitz, Kakuzu hydra, Kankuro's
  puppet corps; and new Ultimates for Orochimaru (summon Manda), Hagoromo (Truth-Seeking Balls), Onoki (mountain drop),
  Eighth Gate Guy (Evening Elephant)). Key frames of every new Kinjutsu were looked at. `node tests/moves.js all`:
  2,568 runs, 0 failures.
- Puppet masters fight with visible puppets (see `PUPPETS`): moves suite 2,548 runs clean, plus every version's sig/ult/tai/nin/gen
  (hit/KO/skip) against Chiyo and Kankuro as defenders (2,700 runs, 0 failures). Frames looked at: idle, tai, nin, Guard, every
  puppet signature, all three puppet Ultimates (hit/dodge/KO) and Kankuro's Kinjutsu, a puppet master KO'd.
- Sound: `npm run sounds` renders every effect and the busiest stacked moments; worst peak 0.54 of full scale, no
  clipping. The effects have still never been HEARD by a person: listen to `tests/out/sfx.wav`.
- Phone layout at 390 and 360 px: no horizontal overflow; squad tray is one scrolling row, the live ticker sits under
  the canvas instead of covering the fighters. Checked on Chromium's mobile emulation only, not a real device.
- Balance targets pass: big move in ~64% of fights (Kinjutsu ~15%), 28-31 distinct champions / 300 brackets, top fighter ~15-19%,
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
