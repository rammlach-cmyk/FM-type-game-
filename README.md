# Touchline Twelve

A playable, lightweight browser soccer management game. Vanilla JavaScript, CSS, and Canvas; no runtime framework, backend, accounts, paid APIs, or external assets. All clubs and players are fictional. Careers and editor databases live in your browser and can be exported.

## Run locally

Requires Node.js 20 or newer. In the repository folder:

```sh
npm start
```

Open **http://localhost:5173** in Chrome, Chromium, or another modern browser. Runtime dependencies are zero, so installing npm packages is not needed to play. `PORT=8080 npm start` chooses another port. Use a web server rather than opening `index.html` directly: modules and JSON loading need HTTP.

Choose a club, inspect Squad and Tactics, then Play match. Press Play inside the match centre. Half-time pauses automatically; change instructions or substitute before starting the second half. Instant result runs the remaining match. At full-time, **Continue** settles the entire league matchweek, finances, training, and recovery. Space toggles match playback when you are not editing a control. Hidden tabs pause matches.

Export your career before switching devices, clearing browser data, changing website addresses, or replacing your career. Saves are local to the browser **and website origin**. A published link lets friends start independent careers; it does not synchronize careers or provide multiplayer.

## What works

- Default 12-club league, 264 players, a double round robin with 22 matchweeks / 132 matches, standings, fixture reports, player goals/assists/appearances/shots/minutes, and repeat seasons with a history archive.
- Clubs with individual colors, identities, stadiums, balances, and board expectations.
- Selectable XI, seven bench slots, captain and set-piece taker; four formations, per-player roles, mentality, pressing, defensive line, width, tempo, and passing instructions; six tactical styles with manual customization.
- Seeded minute-by-minute simulation: actual player attributes, position fit, secondary positions, fitness, morale, captain leadership, home advantage, and tactical matchups affect chances. Every shot has an xG value and a single outcome. Goals, shots, saves, xG, and commentary use those same events.
- Animated 2D event view; pause, 1×/2×/4×/8× playback, automatic half-time pause, five substitutions, in-match tactical changes, and instant simulation. Save a match in progress and resume it paused.
- Paid scouting with approximate unscouted ratings, asking prices, fee/wage/contract offers, club/player rejections, one negotiation per player per week, squad-depth and cash-reserve rules, player sales, and AI transfers/substitutions.
- Weekly training, attribute gains, fitness and morale, training/match injuries and recovery.
- Wage payments, sponsorship, operations, home match income, transfers, scouting, season prizes, and an auditable finance ledger; contract renewal and season-end bridge contracts.
- Responsive dark interface, keyboard-accessible native controls, local autosave, validated save imports, and career export.
- Independent player database studio; career club and league editing; editable bundled data files.

## Difficulty, styles, and assistant manager

Choose **Easy**, **Medium** (recommended), or **Hard** before selecting a club. Difficulty is fixed for the career and included in local/exported saves. Older version-1 saves without this field load as Medium; missing tempo becomes Normal and recent-form history starts empty.

| Difficulty | Board and transfers | Opponent decisions | Assistant guidance |
| --- | --- | --- | --- |
| Easy | Board target relaxed by two positions; lower asking prices and wage requirements | Occasional reactions, later substitutions | Frequent proactive advice |
| Medium | Standard targets and negotiations | Score-aware changes and fitness-aware substitutions | Important issues highlighted |
| Hard | Target tightened by up to two positions, with more board pressure; higher prices and wage demands | More frequent reactions to your line, width, passing, possession, score, and fatigue | Available on request |

Difficulty **never changes player attributes, fitness formulas, shooting/conversion rules, home advantage, or seeds to favor an opponent**. There is no scripted result. AI decision randomness has its own saved stream, separate from shot outcomes. Different managerial decisions can produce different matches. Board confidence remains advisory, without dismissal.

The tactical screen and match centre offer **Balanced, Possession, High Press, Counterattack, Direct Play, and Defensive**. Each shows suitable players, strengths, and tradeoffs. Presets set mentality, pressing, line, width, passing, and tempo; they preserve your formation and player roles. Manual instruction changes show **Custom** when they differ from every preset. Styles are saved through their actual settings, without a separate label that can fall out of sync. High pressing/quick tempo consume more fitness. High lines expose defenders to fast direct play; short patient passing favors control at the cost of urgency. Direct play uses heading/strength and second-ball contests. No preset guarantees results.

Use **Ask Assistant** from the top bar or assistant panel. Recommendations use your selected formation, actual ability, natural/secondary positions, current fitness, last five recorded performances, injuries, finances, and observed match state. It offers an XI/bench, a suitable style, position/depth concerns, affordable targets, and an opponent preview. During matches it considers score, time, knocks, fatigue, shots, possession, xG, and observed instructions. Yellow-card events appear in commentary, statistics, match reports, and player totals. Booked players are more cautious, and the assistant can recommend reducing a high press. Dismissals and suspensions are not simulated.

Click **Apply recommendation…** to preview the exact lineup/bench/leader or instruction changes. Click **Apply recommendation** in the preview to confirm. Recommendations never buy players, spend money, renew contracts, or mutate anything merely by being displayed. The assistant does not disclose unscouted potential or exact unscouted attributes. Transfer targets use the same broad estimates as the market. A stale match/formation recommendation is rejected; ask again.

## Player database studio

Open **Database studio** from club selection or the sidebar. Its data is separate from the career. It autosaves validated edits in local storage under `touchline-database-v1`.

Create, edit, duplicate, and delete players. Enter name, age, nationality, club, primary/secondary positions, preferred foot, overall reference rating, potential, weekly wage, and contract duration. Every technical, physical, mental, and goalkeeper attribute is editable on a **1–99 integer** scale. Enter an overall rating, pick a position, click **Generate attributes from rating**, then adjust the generated values manually. Potential must be at least the reference overall rating. The match engine uses the actual attributes; the reference overall rating is not a hidden strength override.

Search by name, ID, or nationality. Filter by club, position, and maximum age. Sort by name, club, primary position, age, or rating. Duplicate generates a new unique ID; editing keeps the original ID. Imports report missing fields, duplicate IDs, out-of-range ratings, invalid positions, unknown clubs, and malformed files before changing the database. A failed import leaves existing editor records intact. A successful import asks you to confirm replacing the editor roster.

**Export JSON** exports the complete editor roster, not only the filtered rows. **Export CSV** supports spreadsheet work. Keep stable IDs and do not let your spreadsheet rename columns or convert IDs to numbers. Secondary positions use `|` within a cell (for example `CM|AM`). Standard CSV quotes, commas, CRLF, embedded quotes, and embedded newlines are supported. All numeric cells must be filled. Supported primary/secondary positions: `GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LW`, `RW`, `ST`. Preferred foot: `Left`, `Right`, or `Both`. Names/nationalities are up to 100 characters; ages 15–50; wages £100–1,000,000/week; contracts 1–5 years. Maximum database size: 5,000 players.

The CSV columns are:

```text
id,name,age,nationality,clubId,primaryPosition,secondaryPositions,preferredFoot,overall,potential,wage,contract,
finishing,passing,defending,crossing,dribbling,firstTouch,tackling,marking,heading,technique,
pace,acceleration,stamina,strength,agility,
decisions,composure,positioning,teamwork,vision,aggression,
keeping,reflexes,handling,aerial,kicking
```

The exported CSV places these on one header line. Export one first as a template. CSV protects normal RFC-style quoting; keep your spreadsheet's macro/formula handling settings appropriate for the names you import.

### Bundle your custom players into the game

The exact built-in player file is **`data/players.json`** (repository root → `data` → `players.json`). Its format is:

```json
{
  "schemaVersion": 1,
  "players": [
    { "id": "your-stable-id", "name": "Your Player", "clubId": "c0", "primaryPosition": "ST", "secondaryPositions": ["LW"], "...": "all exported fields" }
  ]
}
```

The above is a shape illustration. Use the editor export, which includes every required field, as the actual file.

1. Finish your roster in Database studio and **Export JSON**. Back up the existing bundled file.
2. Replace **`data/players.json`** with the downloaded **`players.json`**. Use the exact filename; do not wrap it in another object or rename fields. Club IDs must match `data/clubs.json`.
3. If you created/edited clubs or league rules, use **Export clubs & leagues** and replace **`data/clubs.json`** and **`data/leagues.json`** too. Allow the browser's two downloads if prompted.
4. Run **`npm test`** for the default regression suite and **`npm run build`** to validate the edited data and copy the website to `dist/`. Regressions use the original default database in `tests/fixtures/default-database.json`, so replacing your bundled roster does not require rewriting the tests. Build validation checks your actual edited data and works with custom leagues.
5. Reload the local site. Start a **new career** with **Use my edited database unchecked** to verify the new bundled roster. Choose **Reset editor to bundled** only if you also want to replace the separate locally saved editor draft.
6. Publish the rebuilt `dist/` folder, then start a new career on the website.

There is no bundler or compilation requirement for normal play: `npm start` serves the source files directly. `npm run build` provides a validated, deployable copy. New careers copy the chosen bundled database into their save; they are not linked to that JSON file afterward. Existing saves keep their own rosters even when you deploy a different default file.

To experiment without replacing files, click **Use for next career** in the studio, or check **Use my edited database** on the club-selection screen. This explicitly uses the browser's editor draft instead of the bundle. It does not affect an existing career.

To change an existing career, export its save first. Before the first match of a season, click **Migrate into career…** in the studio. Migration explicitly replaces career player records for the career's club IDs, resets lineups/statistics/fitness/injuries, and preserves career clubs/finances. It is blocked mid-match and after any matchweek, so historical statistics cannot silently change.

## Clubs and leagues

- **`data/clubs.json`**: stable ID, league ID, name, abbreviation, color, stadium, identity, strength/reputation, initial cash balance, and board expectation.
- **`data/leagues.json`**: stable league ID, name/country, `teamIds`, round-robin `schedule.legs` (1–4), transfer rules, promotion/relegation metadata, and finance settings.
- **`data/players.json`**: standalone, versioned player records. `clubId` references a stable club ID.

No team names or team count are embedded in the engine. Team membership determines schedule size; odd leagues include byes. A career selects one configured league. Multiple independent league definitions can be bundled and selected for new careers, but only the selected league is simulated. A squad needs at least eleven uninjured players including a keeper to play; keep reserves and a second goalkeeper for injuries.

Studio → **Clubs** edits names, colors, budgets, stadiums, identity, and reputation. **Create club with cloned squad** creates a stable new club ID, updates league membership, and clones players with new stable IDs; edit those players next. Deleting a club removes its editor roster and changes the team count. These studio changes affect careers only when explicitly selected as a new-career database.

Studio → **Leagues** edits schedule legs, transfer window (all season or preseason only), squad size/depth rules, scouting cost, wage reserve, and promotion/relegation metadata. The schema also stores league-specific weekly sponsorship/operations and prize-money rules. Change those finance values directly in `data/leagues.json` if desired.

Career → **Club & finances** edits club names, colors, and cash budgets in that save. Budget changes appear in the ledger as editor adjustments. **Edit league rules** changes that career's settings; schedule changes are allowed only before matchweek one. Renaming a club leaves its ID and player ownership intact.

## Publish as a website

This is a static site. It runs entirely on the visitor's device after loading its JavaScript and data files. HTTPS hosting is recommended. All paths are relative, so a GitHub Pages project subdirectory also works.

### Upload to a static host

```sh
npm run build
```

Upload **the contents of `dist/`** to your website root, or choose `dist` as the publish directory on Netlify/Cloudflare Pages/another static host. If a host requests a build command, use `npm run build`; Node version 20 or newer; publish directory `dist`. No environment variables, credentials, server functions, or database service are required for the game. The host returns the link you can share with friends.

### Vercel

Import this GitHub repository into Vercel and select `main` as the production branch. The root `vercel.json` configures `npm ci`, `npm run build`, and the `dist` output directory; no framework preset or environment variables are needed. Keep the project root directory at the repository root. Vercel serves the static build; it does not run `server.js`. Deploy and share the HTTPS URL Vercel provides.

### GitHub Pages without a deployment workflow

Once you push this project to your GitHub repository:

1. Open repository **Settings → Pages**.
2. Choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
3. Wait for GitHub Pages to publish and use the URL it provides. `index.html`, `src/`, `assets/`, and `data/` are already in the repository root, so a build is optional for this method.

For a rebuilt `dist/` deployment, upload its contents to a dedicated Pages branch and select that branch's root instead. Publishing is intentionally not automatic; no remote push or hosting deployment has been performed by this implementation.

## Verification

Engine/database checks use only Node's built-in test runner:

```sh
npm test
npm run build
```

Optional real browser tests use Playwright (development dependency only):

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

If Chromium is already installed, skip the download:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Browser tests start their own server on port 5174 and exercise a full 22-week season through the actual UI; playback/substitutions/tactics; live save/reload; transfers and accounting; career save import/export; editor create/duplicate/delete/generation; CSV/JSON round trips and validation; custom club/team counts; bundled replacement versus existing-save independence; and Chromebook/narrow layouts. Screenshots are generated in ignored `test-results/`.

The engine suite checks 132 fixtures, standings/goal/shot totals, finances, deterministic replay and mid-match restoration, odd/even league schedules, transfers, injuries/development support, database migration, malformed saves, and 150 seeded strong-vs-weak matches. Regressions use an independent original default database fixture. The build validates the actual bundled database, so your custom roster can be published without modifying tests.

## Simplifications and limits

- The 2D pitch illustrates simulation events; it is not a physics/ball-collision simulator. Each player can receive one yellow card per match; booked players are slightly more cautious. Matches have 90 minutes and half-time, without stoppage time, extra time, penalties, red/second-yellow dismissals, suspensions, offside decisions, or detailed referee logic. Saves, goals, shots, possession, and xG remain tied to actual simulated events.
- Positions are grouped into GK/DEF/MID/FWD for lineup fit. Secondary positions soften the mismatch penalty. Preferred foot and nationality are stored/displayed editor fields without special match modifiers. Overall is a reference value; weighted actual attributes determine match strength.
- AI squad management uses automatic lineups, substitutions, simple transfers, and difficulty-based tactical reactions. Negotiation is a one-off weekly offer rather than a multi-round agent conversation. Transfers are permanent; no loans, free agents, release clauses, agent fees, or sell-on clauses.
- Training improves individual attributes gradually. Injury durations are week-based. There are no facilities, coaches, youth intake, retirement, or medical staff decisions. Expiring contracts automatically receive a one-year bridge deal (+8% wages) to keep squads playable; ages cap at 50. There is no age-related attribute decline yet.
- Board confidence is feedback, without dismissal. Cash can go negative, but transfers require funds. A ledger retains the latest 1,000 league transactions; club cumulative income/expenses remain intact.
- The first league is complete. Multiple league definitions and per-league settings are supported; simultaneous multi-league simulation, cross-league transfers, and actual promotion/relegation movement are future work. Movement counts/targets persist as metadata.
- Careers are single-player local saves. Sharing a website link shares the game; it does not create multiplayer, cloud saves, or live shared leagues. Clearing browser data removes local work, so export backups.
- Rendering is capped at about 30 fps, with reduced-motion support and no external fonts/images/audio. Browser verification uses a Chromebook-sized viewport; it is not a physical Chromebook hardware benchmark.

## Code map

```text
data/                 Editable default leagues, clubs, and players
src/engine.js         Pure seeded simulation and career operations (no DOM/storage)
src/management.js     Difficulty policies and board targets
src/styles.js         Six tactical presets and Custom detection
src/assistant.js      Read-only rule-based recommendations and explicit application
src/database.js       Database validation, attribute generator, CSV/JSON handling
src/app.js            Screens, match controls, browser career persistence
src/editor.js         Player/club/league studio and independent draft persistence
src/pitch.js          Canvas event animation, independent of simulation RNG
src/ui.js             Shared UI helpers, safe escaping, downloads and dialogs
src/style.css         Responsive dark interface
assets/crest.svg      Original vector branding
server.js             Dependency-free local HTTP server
scripts/build.mjs     Data validation and static deployment copy
tests/                Engine/database regressions and Playwright journeys
```

The simulation serializes RNG states for the career and each match. Match seeds derive from career seed, season, round, and stable club IDs. Keeping the same inputs and decisions reproduces the same events; UI animations do not consume simulation randomness.
