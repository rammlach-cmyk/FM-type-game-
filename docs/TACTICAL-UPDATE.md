# TOUCHLINE — The Tactical Update

This extends the existing vanilla JavaScript/CSS/Canvas application. League data, database editing, transfers, finances, training, difficulty, local saves, and publishing remain in place. React was not introduced into the existing lightweight application. TypeScript interfaces and compile-time contracts now describe the new engine modules; the possession module is checked with TypeScript's JavaScript checker.

## Match engine

A match advances in one-minute batches rather than being decided before kickoff. Each batch abstracts a possession through goalkeeper distribution, defensive buildup, midfield progression, final-third entry, chance creation, and a possible shot/outcome. Passing sequences represent several passes, keeping computation small. Possessions can finish as completed progression, a misplaced pass, interception, tackle, high turnover, clearance/corner, foul, offside, shot, or goal.

Team strengths separately represent buildup, creation, finishing, midfield control, width, pressing, attacking/defensive transitions, aerial ability, organization, keeper quality/distribution, and set pieces. Actual player attributes, exact/secondary position fit, roles, duties, fitness, morale, recorded form, familiarity, and home advantage contribute. Overall reference ratings never override attributes. Tactical matchups change progression and chance types: pressing challenges short buildup, direct passes bypass pressure at lower completion, wide attacks stretch narrow defenses, and counters exploit attacking commitment/overlaps/high lines.

Shot context retains distance, angle, defensive pressure, type, origin, lane, and relevant shooter/delivery quality. xG is a geometric/context prior with modest finishing/composure and delivery adjustments. Fitness and keeper quality then affect conversion; a single outcome roll determines goal/save/off-target. Shot and goal events supply the displayed totals and commentary. Crosses use aerial shooters and delivery attributes; penalties/free kicks/corners use selected takers. Individual match ratings use recorded goals, assists, chances, defensive actions and discipline.

Fouls, first/second yellows, straight reds, offsides, corners, knocks, and injuries are simulated. Dismissals immediately leave a vacant pitch slot and reduce team strength; dismissed players cannot be replaced. A red card produces a one-match suspension, served over the next matchweek. Fatigue depends on stamina, pressing, tempo, counter-pressing, role/duty, mentality, and minutes. Tired players contribute less and are more exposed to injury; extremely tired players recover more slowly. Fresh substitutes matter. Half-time recovery, pauses, speed controls, five substitutions, and instant completion still work.

AI managers use the existing difficulty-dependent decision schedule and separate persisted decision RNG. Score, time, fatigue, possession, bookings, numerical disadvantage and buildup pressure can change their approach; no player rating multiplier is attached to difficulty. There is no forced late goal.

## Tactical management

Seven formations: the original 4-3-3, 4-4-2, 3-5-2 and 4-2-3-1, plus 4-1-4-1, 5-3-2 and 4-3-1-2. Instructions are grouped into approach, possession, transition and defending. All requested passing lengths, widths, tempos, creativity, final-third/buildup options, overlaps, loss/win transitions, keeper distributions, lines, pressing intensities, tackling approaches, defensive widths, and offside trap are supported. Existing instruction names remain valid aliases.

Presets include Balanced, Possession, Gegenpress, Tiki-Taka, Counter Attack, Direct Play, Wing Play and Low Block. Existing High Press, Counterattack and Defensive remain available. Presets preserve formation/players/roles; manual deviations display Custom.

All 28 requested distinct roles have behavioral effects. Roles are offered by primary position, with appropriate Defend/Support/Attack duties. Both roles and duties can be changed during a match. There are separate captain, penalty, free-kick, left-corner and right-corner selections. Familiarity in formations, styles, instructions and roles improves gradually with use. Changes temporarily reduce organization, capped at 7%, and the disruption decays as play continues.

New editable 1–99 attributes: jumping, work rate, keeper positioning and distribution. Old databases without these values still load using aerial/teamwork/positioning/kicking defaults. JSON schema remains 1; CSV exports include the new columns and old CSV headers remain accepted. Existing careers retain their own player records. See README for the exact `data/players.json` replacement process.

## Assistant manager

The assistant has a seeded fictional name/nationality and visible tactical knowledge, evaluation, motivating and judging ability on a 1–20 scale. These staff ratings are informational; the advice engine is transparent deterministic rules rather than a probabilistic staff-error model or external AI service.

The dashboard briefing gives 2–5 notes. Recommendations use current selection, positional/role suitability, fitness, morale, form, injury/suspension eligibility, budget and squad depth. Opponent previews use known formation and recorded results, goals, possession, attack types, conceded shot origins and public performances; scouted ratings can be cited. It states when a sample is absent, rather than fabricating percentages or revealing hidden potential.

Ask Assistant, Pick Team, Tactical Advice and Recommend Substitutes lead into the same preview/apply workflow. Formation recommendations retain the existing XI and explicitly ask the manager to review position fit; they never silently reselect players. Live rules can respond to midfield numbers, flank progression, high turnovers, fatigue, high lines, bookings, score/time, and weak chance creation. Easy/Medium refresh a live panel every 12 simulated minutes; Hard keeps guidance on request. Substitution notes show outgoing fitness/rating, incoming fitness/ability and the reason. Accept/Make Change opens an exact preview; Ignore dismisses the note for the current interval. Stale recommendations are rejected. No recommendation automatically spends money or changes players.

Post-match reports retain what worked, what needs review, key player, tactical issue, and one suggested improvement. They cite recorded xG, shots, turnovers, counter xG and player performance. They do not claim that a single result proves a causal tactical effect.

## Verification

Commands:

```sh
npm ci
npm test
npm run typecheck
npm run calibrate
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
npm run build
```

The browser path is optional when Playwright Chromium is installed normally. Production builds run TypeScript checks and validate the actual bundled database, then copy the static application to `dist/`. The existing Vercel install/build/output settings remain `npm ci`, `npm run build`, `dist`.

- 49 Node tests: existing season/finance/transfer/editor checks, deterministic event replay and live restoration, every positional role, duties, new attributes, geometric xG, event/player statistics, pressing/direct tradeoffs, fatigue/substitutions, dismissals/suspensions, familiarity, assistant previews/apply/ignore, malformed saves and version migration.
- 14 Playwright journeys: full season, editor and transfer workflows, desktop/narrow navigation, playback/resume, expanded tactics/takers/live roles, assistant evidence/profile, Accept/Ignore, post-match reports and an actual previous-engine career.
- A fixture generated by the previously committed version-1 engine contains completed results, legacy roles, finances and a live substitution. It migrates and finishes both in Node and the browser.
- 150 additional seeded strongest-versus-weakest matches check that quality matters while upsets/draws remain possible.

The repeatable 600-match AI calibration in `calibration.json` uses all bundled clubs, rotating home/away pairings and presets, fresh starting fitness, and Hard decision rules for both AI managers. These are model checks, not claims of fitting a particular real league. Style averages are descriptive: opponents, club quality and in-match adaptation vary, so they are not a controlled ranking of presets. Small home advantage is present in the strengths; sampled outcome rates can vary with pairings and seeds.

| Metric | 600-match sample |
| --- | ---: |
| Goals / match | 2.633 |
| Shots / match | 22.020 |
| On target / match | 8.027 |
| xG / match | 2.682 |
| Home / draw / away | 37.167% / 26.667% / 36.167% |
| Yellow / red cards per match | 4.068 / 0.185 |
| Fouls / corners per match | 25.412 / 9.867 |
| Average home possession | 50.482% |
| Pass completion | 80.214% |
| 0–0 / eight-plus combined goals | 9.500% / 1.000% |

Early calibration exposed excessive cross quality and close-range chances; those were corrected before this sample. Calibration guards fail for extreme scoring, shot or draw distributions. Further tuning across custom databases, tactical specialists and consecutive-season fatigue remains useful.

## Save compatibility

Version 1 upgrades to version 2 automatically under the same browser key, `touchline-career-v1`. Missing fields receive sensible defaults. Names, IDs, balances, completed results, players, lineups, substitutions, events and match minute remain. Difficulty defaults to Medium if missing. Unknown new event statistics start at the migrated active match's minute and are explicitly labeled as partial. Old completed fixture reports stay as recorded; unavailable pass/turnover/shot-origin history is not reconstructed.

The remaining minutes of an older active match run with the new engine and may produce different future outcomes. Version-2 replay is exact for identical seed, inputs and decisions, including saving mid-match. Export a backup before upgrading; the older application cannot load version-2 saves. Explicit preseason roster migration clears the retained player report when replacing its referenced player IDs.

## Remaining simplifications

- Efficient phase abstraction, not continuous player physics or every individual pass. Flank pressure uses attack/shot origins and roles, rather than tracking every defender's marking assignment. Preferred foot remains informational.
- Exactly 90 minutes; no stoppage time, extra time or penalty shootout. Discipline has no detailed referee personality/positioning, accumulated-yellow bans or league-specific suspension tables. No abandoned-match model; at least seven players are retained per side.
- Familiarity uses final match settings and participating roles for progression rather than a minute-by-minute coaching log. Tactical advice is rules with thresholds; assistant staff ratings do not simulate staff mistakes.
- Existing transfer/training/finance simplifications remain. No simultaneous multi-league seasons, actual promotion/relegation movement, loans, agent conversations, cloud saves or multiplayer.
- Chromebook-sized and narrow Chromium views were tested; this is not a physical Chromebook hardware benchmark. Runtime still has no framework or external service dependency.
