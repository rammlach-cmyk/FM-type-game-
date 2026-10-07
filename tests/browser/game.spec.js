import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixtureDB=JSON.parse(readFileSync(new URL('../fixtures/default-database.json',import.meta.url)));
const data={schemaVersion:1,players:fixtureDB.players};
const career=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('touchline-career-v1')));
const selectClub=async page=>{await page.goto('/');await page.locator('[data-select-club="c0"]').click();await expect(page.getByRole('heading',{name:'Welcome to the dugout.'})).toBeVisible();};
const nav=(page,id)=>page.locator(`.nav [data-go="${id}"]`).click();
const dialog=page=>page.locator('#modal');
const errors=[];
test.beforeEach(async({page})=>{await page.route('**/data/players.json',route=>route.fulfill({json:data}));await page.route('**/data/clubs.json',route=>route.fulfill({json:fixtureDB.clubs}));await page.route('**/data/leagues.json',route=>route.fulfill({json:fixtureDB.leagues}));errors.length=0;page.on('pageerror',e=>errors.push(e.message));});
test.afterEach(()=>expect(errors).toEqual([]));

test('club selection, squad, tactics, live controls and paused save resume',async({page})=>{
  await selectClub(page);await nav(page,'squad');await expect(page.locator('[data-lineup]')).toHaveCount(11);await page.locator('[data-action="auto-lineup"]').click();
  await nav(page,'tactics');await page.locator('[data-tactic="formation"]').selectOption('4-4-2');await page.locator('[data-tactic="passing"]').selectOption('Direct');
  await page.locator('.topbar [data-action="continue"]').click();await page.locator('#match-speed').selectOption('8');await page.locator('#pause-play').click();
  await expect(page.locator('#match-clock')).not.toContainText('0′');await page.locator('#pause-play').click();const saved=await career(page);expect(saved.activeMatch.minute).toBeGreaterThan(0);
  await page.reload();await expect(page.locator('#match-clock')).toContainText('PAUSED');expect((await career(page)).activeMatch.minute).toBe(saved.activeMatch.minute);
  await page.locator('[data-tactic="mentality"]').selectOption('Attacking');await page.locator('#make-sub').click();await expect(page.locator('.match-management')).toContainText('1 / 5 substitutions');
  await page.locator('#instant').click();await expect(page.locator('#match-clock')).toContainText('FULL TIME');await page.screenshot({path:'test-results/match-centre-chromebook.png',fullPage:true});await page.locator('#commit-result').click();
  const s=await career(page);expect(s.round).toBe(1);expect(s.fixtures[0].every(f=>f.result)).toBe(true);expect(s.activeMatch).toBeNull();
});

test('a whole season is playable through the real UI and reloads correctly',async({page})=>{
  await selectClub(page);for(let i=0;i<22;i++){await page.locator('.topbar [data-action="continue"]').click();await page.locator('#instant').click();await page.locator('#commit-result').click();}
  await expect(page.getByText('SEASON COMPLETE',{exact:true})).toBeVisible();let s=await career(page);expect(s.round).toBe(22);expect(s.fixtures.flat().filter(f=>f.result)).toHaveLength(132);
  await page.reload();expect((await career(page)).round).toBe(22);await nav(page,'league');await expect(page.locator('tbody tr')).toHaveCount(12);await expect(page.locator('tbody tr').first()).toContainText('22');
  await page.locator('.topbar [data-action="continue"]').click();await dialog(page).locator('[data-confirm]').click();s=await career(page);expect(s.season).toBe(2);expect(s.history).toHaveLength(1);
});

test('scouting, signings, training, club editor and career export/import',async({page})=>{
  await selectClub(page);await nav(page,'transfers');await page.locator('#transfer-pos').selectOption('MID');await page.locator('[data-scout]').first().click();expect((await career(page)).scouted.length).toBe(1);
  await page.locator('[data-bid]').first().click();await dialog(page).locator('[name="fee"]').fill('2000000');await dialog(page).locator('[name="wage"]').fill('20000');await dialog(page).getByRole('button',{name:'Submit offer'}).click();
  expect((await career(page)).players.filter(p=>p.clubId==='c0')).toHaveLength(23);
  await nav(page,'training');await page.locator('[data-training="Fitness"]').click();await page.locator('#training-intensity').selectOption('Rest');expect((await career(page)).trainingIntensity).toBe('Rest');
  await nav(page,'finances');await page.locator('[data-career-club="c0"]').click();await dialog(page).locator('[name="name"]').fill('Chromebook Athletic');await dialog(page).locator('[name="balance"]').fill('9000000');await dialog(page).getByRole('button',{name:'Save club'}).click();
  expect((await career(page)).clubs[0].name).toBe('Chromebook Athletic');
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="export-save"]').click();const exported=await downloadPromise;const exportPath=await exported.path();
  await page.locator('[data-action="import-save"]').click();await page.locator('#file-input').setInputFiles(exportPath);await dialog(page).locator('[data-confirm]').click();expect((await career(page)).clubs[0].balance).toBe(9000000);
});

test('player editor create, generate, duplicate, delete, CSV/JSON and local persistence',async({page})=>{
  await page.goto('/');await page.locator('[data-go="editor"]').click();await page.locator('[data-editor-action="create-player"]').click();
  await dialog(page).locator('[name="name"]').fill('Custom Striker');await dialog(page).locator('[name="nationality"]').fill('Lunarian');await dialog(page).locator('[name="primaryPosition"]').selectOption('ST');await dialog(page).locator('[name="overall"]').fill('88');await dialog(page).locator('#generate-attrs').click();await dialog(page).locator('[name="finishing"]').fill('97');await dialog(page).getByRole('button',{name:'Save player'}).click();
  await page.locator('#db-search').fill('Custom Striker');await page.locator('#db-search').press('Tab');await expect(page.locator('tbody tr')).toHaveCount(1);
  let player=await page.evaluate(()=>JSON.parse(localStorage.getItem('touchline-database-v1')).players.find(p=>p.name==='Custom Striker'));expect(player.finishing).toBe(97);expect(player.primaryPosition).toBe('ST');expect(player.potential).toBeGreaterThanOrEqual(88);
  await page.locator('[data-duplicate-player]').click();await dialog(page).getByRole('button',{name:'Save player'}).click();await expect(page.locator('tbody tr')).toHaveCount(2);const ids=await page.locator('[data-delete-player]').evaluateAll(els=>els.map(e=>e.dataset.deletePlayer));expect(ids[0]).not.toBe(ids[1]);
  const copyId=await page.evaluate(()=>JSON.parse(localStorage.getItem('touchline-database-v1')).players.find(p=>p.name==='Custom Striker copy').id);await page.locator(`[data-delete-player="${copyId}"]`).click();await dialog(page).locator('[data-confirm]').click();await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.reload();await page.locator('[data-go="editor"]').click();await page.locator('#db-search').fill('Custom Striker');await page.locator('#db-search').press('Tab');await expect(page.locator('tbody tr')).toHaveCount(1);
  const csvPromise=page.waitForEvent('download');await page.locator('[data-editor-action="export-csv"]').click();const csv=await csvPromise;
  await page.locator('[data-editor-action="import-csv"]').click();await page.locator('#file-input').setInputFiles(await csv.path());await dialog(page).locator('[data-confirm]').click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('touchline-database-v1')).players.length)).toBe(265);
  const jsonPromise=page.waitForEvent('download');await page.locator('[data-editor-action="export-json"]').click();const json=await jsonPromise;
  await page.locator('[data-editor-action="import-json"]').click();await page.locator('#file-input').setInputFiles(await json.path());await dialog(page).locator('[data-confirm]').click();
  await page.locator('[data-editor-action="use"]').click();await page.locator('[data-select-club="c0"]').click();expect((await career(page)).players.some(p=>p.name==='Custom Striker'&&p.finishing===97)).toBe(true);
});

test('invalid imported database reports errors and keeps current records',async({page})=>{
  await page.goto('/');await page.locator('[data-go="editor"]').click();const p=structuredClone(data.players[0]);p.clubId='unknown';p.passing=120;
  await page.locator('[data-editor-action="import-json"]').click();await page.locator('#file-input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,players:[p,p]}))});
  await expect(page.locator('.error-list')).toContainText('unknown club');await expect(page.locator('.error-list')).toContainText('duplicate ID');await expect(page.locator('.error-list')).toContainText('passing');await expect(page.locator('.db-status')).toContainText('264 players');
});

test('club creation changes league count with independent player IDs',async({page})=>{
  await page.goto('/');await page.locator('[data-go="editor"]').click();await page.locator('[data-editor-tab="clubs"]').click();await page.locator('[data-editor-action="create-club"]').click();await dialog(page).locator('[name="name"]').fill('Moonrise FC');await dialog(page).getByRole('button',{name:'Save club'}).click();
  await expect(page.getByRole('heading',{name:'Moonrise FC'})).toBeVisible();await page.locator('[data-editor-action="use"]').click();await expect(page.locator('[data-select-club]')).toHaveCount(13);await page.locator('[data-select-club="c0"]').click();const s=await career(page);expect(s.clubs).toHaveLength(13);expect(s.fixtures).toHaveLength(26);expect(new Set(s.players.map(p=>p.id)).size).toBe(286);
});

test('bundled replacement affects new careers while existing saves retain their data',async({page})=>{
  await selectClub(page);const original=(await career(page)).players[0].name;const edited=structuredClone(data);edited.players[0].name='Bundled Custom Keeper';
  await page.route('**/data/players.json',route=>route.fulfill({json:edited}));await page.reload();expect((await career(page)).players[0].name).toBe(original);
  await page.locator('[data-action="new-career"]').click();await dialog(page).locator('[data-confirm]').click();await page.locator('[data-select-club="c0"]').click();expect((await career(page)).players[0].name).toBe('Bundled Custom Keeper');
});

test('Chromebook and narrow layouts render and navigate without horizontal page overflow',async({page})=>{
  await page.setViewportSize({width:1366,height:768});await selectClub(page);await page.screenshot({path:'test-results/dashboard-chromebook.png',fullPage:true});
  for(const id of ['squad','tactics','transfers','training','league','finances','editor']){await nav(page,id);await expect(page.locator('main h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:844});for(const id of ['squad','tactics','transfers','training','league','finances','editor']){await nav(page,id);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}await nav(page,'dashboard');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
});

test('difficulty selection persists and older careers upgrade to Medium',async({page})=>{
  await page.goto('/');await expect(page.locator('.difficulty-card')).toHaveCount(3);await page.locator('[name="career-difficulty"][value="Hard"]').check();await page.locator('[data-select-club="c0"]').click();expect((await career(page)).difficulty).toBe('Hard');
  await page.reload();await expect(page.locator('.assistant-panel')).toContainText('Hard');expect((await career(page)).difficulty).toBe('Hard');
  const legacy=await career(page);delete legacy.difficulty;delete legacy.assistant;legacy.clubs.forEach(c=>delete c.tactics.tempo);legacy.players.forEach(p=>delete p.form);await page.locator('[data-action="import-save"]').click();await page.locator('#file-input').setInputFiles({name:'older-career.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await dialog(page).locator('[data-confirm]').click();await page.reload();
  await page.locator('.topbar [data-action="ask-assistant"]').click();await expect(dialog(page)).toContainText('Your assistant');expect((await career(page)).difficulty).toBe('Medium');await dialog(page).locator('[data-close]').click();
});

test('styles retain formation, show Custom after edits, and assistant previews before applying',async({page})=>{
  await selectClub(page);await nav(page,'tactics');await page.locator('[data-tactic="formation"]').selectOption('3-5-2');await page.locator('[data-style]').selectOption('High Press');
  let s=await career(page);expect(s.clubs[0].tactics.formation).toBe('3-5-2');expect(s.clubs[0].tactics.pressing).toBe('High');expect(s.clubs[0].tactics.tempo).toBe('Quick');
  await page.locator('[data-tactic="line"]').selectOption('Deep');await expect(page.locator('[data-style]')).toContainText('Custom');await page.locator('[data-style-help]').click();await expect(dialog(page).locator('.advice-card')).toHaveCount(6);await dialog(page).locator('[data-close]').click();
  await page.locator('[data-style]').selectOption('Balanced');const before=await career(page);await page.locator('.topbar [data-action="ask-assistant"]').click();const styleAdvice=dialog(page).locator('.advice-card').filter({has:page.getByRole('heading',{name:/fits this squad/})});await styleAdvice.locator('[data-review-advice]').click();
  await expect(dialog(page)).toContainText('Exactly what will change');await expect(dialog(page)).toContainText('Passing: Mixed → Short');expect((await career(page)).clubs[0].tactics.passing).toBe('Mixed');
  await dialog(page).locator('#advice-confirm').click();s=await career(page);expect(s.clubs[0].tactics.passing).toBe('Short');expect(s.clubs[0].tactics.tempo).toBe('Patient');expect(s.clubs[0].tactics.formation).toBe('3-5-2');expect(s.clubs.map(c=>c.balance)).toEqual(before.clubs.map(c=>c.balance));expect(s.assistant.appliedCount).toBe(1);
  await page.reload();await nav(page,'tactics');await expect(page.locator('[data-style]')).toHaveValue('Possession');
});
