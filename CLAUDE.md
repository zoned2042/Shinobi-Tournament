# Fantasy Shinobi Tournament

A single-file browser game: draft a squad from Naruto characters, then watch a single-elimination
tournament (8/16/32/64 fighters) play out as animated canvas fights. Fan project, no external art:
every character, effect and background is drawn in code.

- Entry point: `index.html` (about 3,700 lines, HTML + CSS + one `<script>`, no build step, no dependencies).
- Originally built and published as a Claude artifact: https://claude.ai/artifact/Ng4jRYAvPF7r3B9QLgtmZ3
- Keep it a SINGLE self-contained HTML file. It must keep working when published as an artifact
  (CSP allows scripts only from cdnjs/jsdelivr/jquery, nothing else; fonts come from Google Fonts with fallbacks).
  Wrap every `localStorage` use in try/catch (keys: `fst_best2`, `fst_theme`, `fst_sound`).

## Run and test

```
npm install                       # installs playwright only (used by tests)
npx playwright install chromium   # skip if a Chromium build is already present (set CHROMIUM_PATH to use another one)
npm run serve                     # or just open index.html in a browser
npm run test:smoke                # all bracket sizes, one-version-per-character, skip mid-fight, replay, new draft mid-fight
node tests/moves.js all           # every version x {sig,ult,tai,nin,gen} x {hit,dodge,ko,crit,skip}, checks for errors,
                                  #   hangs, leftover fx/props/mood/camera and fighters not reset (~2,300 runs, ~1 min;
                                  #   split with: node tests/moves.js ult 0 3 / 1 3 / 2 3, or name ids: node tests/moves.js sig itachi1)
npm run test:balance              # Ultimate rate, KO rate, upsets, champion spread (exits 1 if a target is missed)
node tests/frames.js kaguya ult   # contact sheet of stage frames in tests/out/ so you can LOOK at an animation
node tests/frames.js all ult ko   #   one sheet per version; "styles" instead of "all" = first user of each style
node tests/titles.js              # every Ultimate and signature cut-in title, frozen when fully revealed
npm run portraits                 # contact sheet of every look to tests/out/portraits.png
npm run sounds                    # renders every sound effect offline to tests/out/sfx.wav and reports peaks/clipping
npm run layout                    # phone-width screenshots (draft, bracket, arena) + horizontal-overflow check
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
| `LK` / `lookOf` | Per-`base` and per-`id` look: skin `sk`, hair `hr`/`hs` (style), eyes `ey`/`es`, outfit `tp bt sl sv os vs`, headband `bd`, mask `mk`, marks `mr[]`, back item `bk`, glow, `bw` body width. Hokage tag auto-applies robe+hat; `Edo` tag auto-applies cracked grey skin. |
| `drawHead`, `hairFront/Back`, `drawMarks`, `drawEye`, `drawPortrait`, `faceURL` | Head-frame drawing (origin at head centre, +x forward, -y up). Used by in-fight fighters, both cut-ins and face icons. |
| `simFight(A,B)` | Pure simulation. Returns `{winner,loser,ko,hpLeft,log,turns,ultW}`. Contains the damage model and the Ultimate gauge. |
| `Sfx` | Tiny WebAudio synth (no assets), all voices go through one master gain + compressor. |
| `class Stage` | Canvas renderer + animation engine. Fighters are skeletons driven by pose angles (`POSES`). Plays log entries as animations. `titleLayout` breaks Ultimate titles into 1-4 lines. |
| `SIGMAP` / `STYLES` | 32 staged signature moves, keyed by id or base. Unmapped characters fall back to a generic move by `sigType` (currently none). |
| `ULTMAP` / `ULTS` | 19 Ultimate choreographies, keyed by id or base. Fallback by sigType via `ULTFB`. |
| `LINES` / `Announcer` | Live commentary ticker text. |
| `APP STATE AND UI` | Draft screen, settings, bracket tabs, arena HUD, `playSim`, scoring (`finalize`), events. |

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

## Recipes

- **Add a character version:** add a `C(...)` row in ROSTER (new `id`; reuse `base` for another form of the same character), add look data to `LK` (by `id` for form-specific changes), optionally `MOVES[base]`, `SIGMAP`, `ULTMAP`. Base count must stay >= bracket size for a 64 bracket (currently exactly 64 bases).
- **Add a signature style:** add `async name(e,A,D,fx,P){...}` to `STYLES`, map characters in `SIGMAP` as `[ 'name', {params} ]`.
- **Add an Ultimate style:** add to `ULTS`, map in `ULTMAP` as `{s:'style',n:'Move name',c:'#hex',c2:'#hex',...params}`. Cut-in is automatic.
- **Add a hair style / mark:** `hairFront`/`hairBack` switch on `L.hs`; `drawMarks` switch on mark name.

## Balance model (in `simFight`)

Damage = `base * (0.82+0.42*pow/100) * defenseFactor * rand(0.65..1.35) * formRoll`, crit chance from intellect, dodge from speed/intellect gaps.
Ultimate: gauge +0.46x damage dealt, +0.67x damage taken, +1.2 per turn; fires once per fight at 100 (85% chance on that turn), base damage 46, dodge chance x0.2.
Targets while tuning: about half of fights contain an Ultimate, 25+ distinct champions across 300 simulated 64-brackets, no fighter over ~20% of titles. Edo Tensei versions were nerfed once already for winning too often; re-check with `npm run test:balance` after changing stats.

## State of the work

(updated at the end of this session, see below)
