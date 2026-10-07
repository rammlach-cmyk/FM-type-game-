export const POSITIONS = ['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'];
export const GROUPS = {GK:'GK',CB:'DEF',LB:'DEF',RB:'DEF',DM:'MID',CM:'MID',AM:'MID',LW:'FWD',RW:'FWD',ST:'FWD',DEF:'DEF',MID:'MID',FWD:'FWD'};
export const ATTRIBUTES = {
  Technical:['finishing','passing','defending','crossing','dribbling','firstTouch','tackling','marking','heading','technique'],
  Physical:['pace','acceleration','stamina','strength','agility'],
  Mental:['decisions','composure','positioning','teamwork','vision','aggression'],
  Goalkeeper:['keeping','reflexes','handling','aerial','kicking']
};
export const ALL_ATTRIBUTES=Object.values(ATTRIBUTES).flat();
export const LABELS={firstTouch:'First touch',keeping:'Goalkeeping',aerial:'Aerial reach'};
export function uid(prefix='p') {return `${prefix}-${globalThis.crypto.randomUUID()}`;}
export function generateAttributes(overall,position) {
  const group=GROUPS[position];const result={};
  for(const [category,keys] of Object.entries(ATTRIBUTES))for(const k of keys){let modifier=0;
    if(category==='Goalkeeper'&&group!=='GK')modifier=k==='kicking'?-12:-42;
    if(group==='GK'&&category==='Technical')modifier=['passing','technique'].includes(k)?-10:-28;
    if(group==='DEF'&&['finishing','dribbling','vision'].includes(k))modifier=-16;
    if(group==='MID'&&['finishing','heading'].includes(k))modifier=-8;
    if(group==='FWD'&&['defending','tackling','marking','positioning'].includes(k))modifier=-23;
    if(['LB','RB','LW','RW'].includes(position)&&['pace','acceleration','crossing'].includes(k))modifier=5;
    if(position==='ST'&&['finishing','composure','heading'].includes(k))modifier=4;
    if(position==='DM'&&['tackling','positioning','teamwork'].includes(k))modifier=4;
    result[k]=Math.max(1,Math.min(99,Math.round(overall+modifier)));
  }return result;
}
export function createDatabasePlayer(clubId,position='CM',overall=65) {
  return {id:uid(),name:'New player',age:22,nationality:'Asterian',clubId,primaryPosition:position,secondaryPositions:[],position:GROUPS[position],preferredFoot:'Right',overall,potential:Math.min(99,overall+10),...generateAttributes(overall,position),wage:Math.round(overall**2*.85/100)*100,contract:3};
}
export function validatePlayers(input,clubs) {
  const errors=[];const ids=new Set(),clubIds=new Set(clubs.map(c=>c.id));
  if(!Array.isArray(input)||!input.length)return ['Database must contain at least one player.'];
  if(input.length>5000)return ['Maximum database size is 5,000 players.'];
  input.forEach((p,i)=>{
    const label=`Row ${i+1}${p?.name?` (${String(p.name).slice(0,60)})`:''}`;
    if(!p||typeof p!=='object'){errors.push(`${label}: missing player record.`);return;}
    for(const key of ['id','name','nationality','clubId'])if(typeof p[key]!=='string'||!p[key].trim()||p[key].length>100)errors.push(`${label}: missing or invalid ${key}.`);
    if(typeof p.id==='string'&&!/^[a-zA-Z0-9_-]+$/.test(p.id))errors.push(`${label}: ID must contain letters, numbers, hyphens, or underscores.`);
    if(Object.getOwnPropertyNames(Object.prototype).includes(p.id))errors.push(`${label}: reserved ID ${p.id}; choose a distinct stable ID.`);
    if(ids.has(p.id))errors.push(`${label}: duplicate ID ${p.id}.`);ids.add(p.id);
    if(!clubIds.has(p.clubId))errors.push(`${label}: unknown club ${p.clubId}.`);
    if(!POSITIONS.includes(p.primaryPosition))errors.push(`${label}: unknown primary position.`);
    if(!Array.isArray(p.secondaryPositions)||p.secondaryPositions.some(pos=>!POSITIONS.includes(pos)||pos===p.primaryPosition)||new Set(p.secondaryPositions).size!==p.secondaryPositions.length)errors.push(`${label}: invalid secondary positions.`);
    if(!['Left','Right','Both'].includes(p.preferredFoot))errors.push(`${label}: invalid preferred foot.`);
    if(!Number.isInteger(p.age)||p.age<15||p.age>50)errors.push(`${label}: age must be 15–50.`);
    for(const key of ['overall','potential',...ALL_ATTRIBUTES])if(!Number.isInteger(p[key])||p[key]<1||p[key]>99)errors.push(`${label}: ${key} must be an integer from 1 to 99.`);
    if(p.potential<p.overall)errors.push(`${label}: potential cannot be below overall.`);
    if(!Number.isSafeInteger(p.wage)||p.wage<100||p.wage>1_000_000)errors.push(`${label}: wage must be £100–1,000,000/week.`);
    if(!Number.isInteger(p.contract)||p.contract<1||p.contract>5)errors.push(`${label}: contract must be 1–5 years.`);
  });return errors;
}
export function normalizePlayer(p) {return {...p,position:GROUPS[p.primaryPosition],secondaryPositions:[...p.secondaryPositions]};}
export function parsePlayerJSON(text) {
  if(text.length>10_000_000)throw Error('File is too large (maximum 10 MB).');
  const data=JSON.parse(text);if(Array.isArray(data))return data;if(data.schemaVersion!==1||!Array.isArray(data.players))throw Error('Expected schemaVersion 1 and a players array.');return data.players;
}
export function playerJSON(players){return JSON.stringify({schemaVersion:1,players:players.map(normalizePlayer)},null,2);}
export const CSV_COLUMNS=['id','name','age','nationality','clubId','primaryPosition','secondaryPositions','preferredFoot','overall','potential','wage','contract',...ALL_ATTRIBUTES];
const numeric=new Set(['age','overall','potential','wage','contract',...ALL_ATTRIBUTES]);
export function exportCSV(players) {
  const quote=v=>{let text=String(v??'');return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
  return [CSV_COLUMNS.join(','),...players.map(p=>CSV_COLUMNS.map(k=>quote(k==='secondaryPositions'?p[k].join('|'):p[k])).join(','))].join('\r\n');
}
export function importCSV(text) {
  if(text.length>10_000_000)throw Error('File is too large (maximum 10 MB).');
  text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw Error('CSV has an unclosed quoted field.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)throw Error('CSV must contain a header and player rows.');const headers=rows.shift().map(s=>s.trim());
  if(new Set(headers).size!==headers.length)throw Error('CSV contains duplicate column headers.');
  const missing=CSV_COLUMNS.filter(k=>!headers.includes(k));if(missing.length)throw Error(`Missing CSV columns: ${missing.join(', ')}.`);
  return rows.map((values,i)=>{if(values.length!==headers.length)throw Error(`CSV row ${i+2}: expected ${headers.length} columns.`);const p={};headers.forEach((k,j)=>{const v=values[j].trim();p[k]=numeric.has(k)?v===''?NaN:Number(v):k==='secondaryPositions'?v?v.split('|').map(x=>x.trim()):[]:v;});return p;});
}
export function validateDatabase(db) {
  const errors=[];
  if(!Array.isArray(db.leagues)||!db.leagues.length||!Array.isArray(db.clubs)||!db.clubs.length)return ['Missing leagues or clubs.'];
  const lids=new Set(),cids=new Set();
  for(const c of db.clubs){if(!c.id||cids.has(c.id))errors.push('Missing or duplicate club ID.');cids.add(c.id);if(!c.name?.trim()||!/^#[a-f0-9]{6}$/i.test(c.color)||!Number.isFinite(c.balance)||c.balance<0||!Number.isFinite(c.strength)||c.strength<1||c.strength>99)errors.push(`Invalid club: ${c.id}.`);}
  for(const l of db.leagues){if(!l.id||lids.has(l.id))errors.push('Missing or duplicate league ID.');lids.add(l.id);if(!l.name?.trim()||!Array.isArray(l.teamIds)||l.teamIds.length<2||l.teamIds.length>40||new Set(l.teamIds).size!==l.teamIds.length||l.teamIds.some(id=>!cids.has(id)||db.clubs.find(c=>c.id===id).leagueId!==l.id))errors.push(`Invalid teams for ${l.name}.`);if(l.schedule?.format!=='round-robin'||![1,2,3,4].includes(l.schedule?.legs))errors.push(`Invalid schedule for ${l.name}.`);
    const r=l.transferRules;if(!r||!['always','preseason'].includes(r.window)||!['maxSquad','minSquad','minKeepers','minOutfieldPerGroup','scoutingCost','wageReserveWeeks'].every(k=>Number.isInteger(r[k])&&r[k]>=0)||r.maxSquad<11||r.maxSquad>100||r.minSquad<11||r.minSquad>r.maxSquad||r.minKeepers<1)errors.push(`Invalid transfer rules for ${l.name}.`);
    if(!l.finance||!['sponsorship','operations','prizeBase','prizeStep','prizeMinimum'].every(k=>Number.isFinite(l.finance[k])&&l.finance[k]>=0))errors.push(`Invalid finances for ${l.name}.`);
    if(!l.promotionRelegation||!['promote','relegate'].every(k=>Number.isInteger(l.promotionRelegation[k])&&l.promotionRelegation[k]>=0&&l.promotionRelegation[k]<l.teamIds.length))errors.push(`Invalid promotion settings for ${l.name}.`);
  }
  if(db.clubs.some(c=>!lids.has(c.leagueId)))errors.push('Club refers to an unknown league.');
  errors.push(...validatePlayers(db.players,db.clubs));return errors;
}
export async function loadBundledDatabase(){
  const [leagues,clubs,data]=await Promise.all(['leagues','clubs','players'].map(async name=>{const res=await fetch(`./data/${name}.json`);if(!res.ok)throw Error(`Cannot load data/${name}.json (${res.status}).`);return res.json();}));
  const db={leagues,clubs,players:parsePlayerJSON(JSON.stringify(data))};const errors=validateDatabase(db);if(errors.length)throw Error(errors.slice(0,10).join('\n'));return db;
}
