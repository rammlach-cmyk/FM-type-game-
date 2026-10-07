import {POSITION_ROLES,LEGACY_ROLES,defaultRole,roleDefinition} from './roles.js';
import {INSTRUCTION_DEFAULTS,INSTRUCTION_OPTIONS} from './tactical-settings.js';
import {POSITION_SLOTS,positionFit,calculateStrengths,buildFamiliarity} from './tactics.js';
import {advancePossessionMinute} from './match.js';
import {STAT_KEYS,matchSummary} from './statistics.js';
import {SAVE_VERSION,migrateSave,initializeMatchData,additionalAttributes,defaultTakers,assistantProfile} from './migrations.js';
import { DIFFICULTIES, difficultySettings, boardTarget, boardGoal } from './management.js';
import { applyStyle } from './styles.js';
import { GROUPS, ALL_ATTRIBUTES, validateDatabase, validatePlayers } from './database.js';
// Pure, JSON-serializable simulation. All randomness passes through persisted RNG states.
export const VERSION = SAVE_VERSION;
export const FORMATIONS = {
  '4-3-3':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','FWD','FWD','FWD'],
  '4-4-2':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD'],
  '3-5-2':['GK','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD','FWD'],
  '4-2-3-1':['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD']
};
for(const [name,slots]of Object.entries(POSITION_SLOTS))if(!FORMATIONS[name])FORMATIONS[name]=slots.map(p=>GROUPS[p]);
export const DEFAULT_TACTICS={formation:'4-3-3',...INSTRUCTION_DEFAULTS};
export const OPTIONS=INSTRUCTION_OPTIONS;
export const ROLES={GK:[...POSITION_ROLES.GK,'Keeper','Sweeper'],DEF:[...new Set([...POSITION_ROLES.CB,...POSITION_ROLES.LB,...POSITION_ROLES.RB,'Defender','Ball player','Wing back'])],MID:[...new Set([...POSITION_ROLES.DM,...POSITION_ROLES.CM,...POSITION_ROLES.AM,'Runner'])],FWD:[...new Set([...POSITION_ROLES.LW,...POSITION_ROLES.ST,'Creator','Target'])]};
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function random(holder) { let t = holder.rng = (holder.rng + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const hash = text => {let h=2166136261;for(const ch of text)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};
const choose = (h,a) => a[Math.floor(random(h)*a.length)];
export const ability = p => (p.position==='GK' ? p.keeping*.35+p.reflexes*.2+p.handling*.15+p.aerial*.1+p.agility*.1+p.kicking*.1 : p.position==='DEF' ? p.defending*.2+p.tackling*.15+p.marking*.1+p.positioning*.15+p.pace*.1+p.strength*.1+p.passing*.1+p.stamina*.1 : p.position==='MID' ? p.passing*.2+p.vision*.15+p.technique*.1+p.decisions*.1+p.firstTouch*.1+p.defending*.1+p.finishing*.1+p.pace*.05+p.stamina*.1 : p.finishing*.25+p.composure*.15+p.dribbling*.1+p.firstTouch*.1+p.pace*.15+p.acceleration*.1+p.heading*.05+p.passing*.05+p.stamina*.05);
export const playerValue = p => Math.round((ability(p)**3 * 1.8 * (p.age<24?1.25:p.age>30?.65:1) * (.8 + p.contract*.1))/1000)*1000;
export function askingPrice(p) {return Math.round(playerValue(p)*1.15/1000)*1000;}
export function club(state,id) { return state.clubs.find(c=>c.id===id); }
export function player(state,id) { return state.players.find(p=>p.id===id); }
export function squad(state,id) { return state.players.filter(p=>p.clubId===id); }
export function autoLineup(state,c) {
  const available = squad(state,c.id).filter(p=>!p.injury&&!p.suspension).sort((a,b)=>ability(b)*b.fitness/100-ability(a)*a.fitness/100);
  const used = new Set();
  c.lineup = FORMATIONS[c.tactics.formation].map((pos,index)=>{
    const slot=POSITION_SLOTS[c.tactics.formation][index];const p=available.filter(p=>!used.has(p.id)&&(index!==0||p.position==='GK')).sort((a,b)=>ability(b)*b.fitness*positionFit(b,slot)-ability(a)*a.fitness*positionFit(a,slot))[0];
    if(p)used.add(p.id);return p?.id||null;
  });
  c.bench = available.filter(p=>!used.has(p.id)).slice(0,7).map(p=>p.id);
  if(!c.lineup.includes(c.captain)) c.captain = c.lineup.filter(Boolean).map(id=>player(state,id)).sort((a,b)=>b.age-a.age)[0]?.id;
  if(!c.lineup.includes(c.setPiece)) c.setPiece = c.lineup.filter(Boolean).map(id=>player(state,id)).sort((a,b)=>b.passing+b.finishing-a.passing-a.finishing)[0]?.id;
  c.takers??=defaultTakers(c);for(const key of Object.keys(c.takers))if(!c.lineup.includes(c.takers[key]))c.takers[key]=c.setPiece;
}
export function validateLineup(state,c) {
  const ids = [...c.lineup,...c.bench];
  if(c.lineup.length!==11 || c.lineup.some(id=>!id)) return 'Select eleven starters.';
  if(c.bench.length>7 || new Set(ids).size!==ids.length) return 'Each player can appear once; choose up to seven substitutes.';
  if(ids.some(id=>!player(state,id)||player(state,id).clubId!==c.id||(player(state,id).injury||player(state,id).suspension))) return 'Only fit, unsuspended players from your club can be selected.';
  if(player(state,c.lineup[0]).position!=='GK') return 'Select a goalkeeper in the first slot.';
  if(c.takers&&Object.values(c.takers).some(id=>!c.lineup.includes(id)))return 'All set-piece takers must start.';
  if(!c.lineup.includes(c.captain)||!c.lineup.includes(c.setPiece)) return 'Captain and set-piece taker must start.';
  return null;
}
export function fixtures(ids,season=1,legs=2) {
  let rotation=[...ids],rounds=[];
  if(rotation.length%2)rotation.push(null);
  const count=rotation.length;
  for(let r=0;r<count-1;r++) {
    const matches=[];
    for(let i=0;i<count/2;i++) { const a=rotation[i],b=rotation[count-1-i]; const flip=(r+i)%2; if(a!==null&&b!==null)matches.push({id:`s${season}r${r}m${i}`,home:flip?b:a,away:flip?a:b,result:null}); }
    rounds.push(matches); rotation=[rotation[0],rotation.at(-1),...rotation.slice(1,-1)];
  }
  return Array.from({length:legs},(_,leg)=>rounds.map((rr,r)=>rr.map((f,i)=>({id:`s${season}r${r+leg*(count-1)}m${i}`,home:leg%2?f.away:f.home,away:leg%2?f.home:f.away,result:null})))).flat();
}
export function newGame(seed=2026,clubId,database,leagueId,difficulty='Medium') {
  if(!DIFFICULTIES[difficulty])throw Error('Choose Easy, Medium, or Hard difficulty.');
  const errors=validateDatabase(database);if(errors.length)throw Error(errors.slice(0,10).join('\n'));
  const sourceLeague=database.leagues.find(l=>l.id===leagueId)||database.leagues.find(l=>l.teamIds.includes(clubId))||database.leagues[0];
  const selected=database.clubs.filter(c=>sourceLeague.teamIds.includes(c.id));
  if(!selected.some(c=>c.id===clubId))clubId=selected[0].id;
  const s={version:VERSION,rng:seed>>>0,seed:seed>>>0,season:1,round:0,userClubId:clubId,difficulty,assistant:{lastAsked:null,appliedCount:0,profile:assistantProfile(seed)},league:structuredClone(sourceLeague),leagues:structuredClone(database.leagues),clubs:[],players:[],fixtures:[],news:[],ledger:[],activeMatch:null,history:[],scouted:[],training:'Balanced',trainingIntensity:'Normal',negotiations:[],boardConfidence:difficultySettings({difficulty}).boardBase};
  s.clubs=selected.map(c=>({...structuredClone(c),tactics:{...DEFAULT_TACTICS},lineup:[],bench:[],captain:null,setPiece:null,takers:null,familiarity:{formations:{'4-3-3':65},instructions:{}},training:'Balanced',income:0,expenses:0}));
  s.players=database.players.filter(p=>sourceLeague.teamIds.includes(p.clubId)).map(p=>({...structuredClone(p),position:GROUPS[p.primaryPosition],fitness:100,morale:75,injury:0,goals:0,assists:0,appearances:0,minutes:0,shots:0,yellowCards:0,development:0,form:[],role:defaultRole(p),duty:roleDefinition(defaultRole(p)).duties.includes('Support')?'Support':roleDefinition(defaultRole(p)).duties[0],familiarity:{[defaultRole(p)]:65},suspension:0,redCards:0,...additionalAttributes(p)}));
  for(const c of s.clubs){if(squad(s,c.id).length<11||!squad(s,c.id).some(p=>p.position==='GK'))throw Error(`${c.name} needs at least eleven players, including a goalkeeper.`);autoLineup(s,c);}
  s.fixtures=fixtures(s.clubs.map(c=>c.id),1,s.league.schedule.legs);
  news(s,`Welcome to ${club(s,clubId).name}. The board expects: ${boardGoal(s,club(s,clubId))}. Difficulty: ${difficulty}.`);
  migrateSave(s);return s;
}
export function news(s,text) {s.news.unshift({season:s.season,round:s.round,text});s.news=s.news.slice(0,100);}
export function nextFixture(s,id=s.userClubId) {return s.fixtures[s.round]?.find(f=>f.home===id||f.away===id);}
export function standings(s) {
  const rows=s.clubs.map(c=>({...c,played:0,w:0,d:0,l:0,gf:0,ga:0,points:0,form:[]}));
  for(const round of s.fixtures) for(const f of round) if(f.result) {
    const h=rows.find(c=>c.id===f.home),a=rows.find(c=>c.id===f.away),[hg,ag]=f.result.score;
    for(const [x,gf,ga] of [[h,hg,ag],[a,ag,hg]]) {x.played++;x.gf+=gf;x.ga+=ga;const out=gf>ga?'W':gf===ga?'D':'L';x[out==='W'?'w':out==='D'?'d':'l']++;x.points+=out==='W'?3:out==='D'?1:0;x.form.push(out);}
  }
  return rows.sort((a,b)=>b.points-a.points || (b.gf-b.ga)-(a.gf-a.ga) || b.gf-a.gf || a.name.localeCompare(b.name));
}
export function teamRatings(s,m,side){return calculateStrengths(s,m,side);}
export function createMatch(s,f) {
  for(const id of [f.home,f.away]) {const c=club(s,id);if(id!==s.userClubId||validateLineup(s,c))autoLineup(s,c);}
  const teams=[f.home,f.away],cs=teams.map(id=>club(s,id));
  const m={fixtureId:f.id,teams,rng:((s.seed ^ Math.imul(s.season,100003) ^ Math.imul(s.round+1,99991) ^ hash(f.home) ^ Math.imul(hash(f.away),7907))>>>0),minute:0,phase:'first',done:false,score:[0,0],shots:[0,0],onTarget:[0,0],xg:[0,0],possessionTicks:[0,0],events:[],lineups:cs.map(c=>[...c.lineup]),bench:cs.map(c=>[...c.bench]),tactics:cs.map(c=>({...c.tactics})),aiRng:hash(f.id+'ai')^s.seed,aiChanges:[0,0],captains:cs.map(c=>c.captain),setPieces:cs.map(c=>c.setPiece),fitness:{},minutes:{},goals:{},assists:{},playerShots:{},subs:[0,0],used:cs.map(c=>[...c.lineup]),knocks:[],injuries:[],cards:{yellow:{},red:[]},lastEvent:null};
  cs.forEach(c=>[...c.lineup,...c.bench].forEach(id=>{m.fitness[id]=player(s,id).fitness;m.minutes[id]=0;}));
  initializeMatchData(s,m);event(m,'kickoff','The whistle sounds. A new chapter begins.'); return m;
}
function event(m,type,text,extra={}) {const e={minute:m.minute,type,text,...extra};m.events.push(e);m.lastEvent=e;}
export function substitute(s,m,side,outId,inId) {
  if(m.done)throw Error('The match has ended.');
  if(m.subs[side]>=5)throw Error('Five substitutions already used.');
  const i=m.lineups[side].indexOf(outId);if(i<0||!m.bench[side].includes(inId)||m.used[side].includes(inId))throw Error('Choose a starter and an unused substitute.');
  const incoming=player(s,inId);if(incoming.injury||incoming.suspension)throw Error('This substitute is injured.');
  if(i===0&&incoming.position!=='GK')throw Error('A goalkeeper must replace the goalkeeper.');
  m.lineups[side][i]=inId;m.bench[side]=m.bench[side].filter(id=>id!==inId);m.used[side].push(inId);m.subs[side]++;
  for(const key of Object.keys(m.takers[side]))if(m.takers[side][key]===outId)m.takers[side][key]=inId;
  if(m.captains[side]===outId)m.captains[side]=inId;if(m.setPieces[side]===outId)m.setPieces[side]=inId;
  event(m,'sub',`${club(s,m.teams[side]).short}: ${incoming.name} replaces ${player(s,outId).name}.`,{side,outId,inId});
}
export function changeMatchTactic(m,side,key,value) {
  if(m.done)throw Error('The match has ended.');
  if(key==='formation'?!FORMATIONS[value]:!OPTIONS[key]?.includes(value))throw Error('Invalid tactical choice.');
  if(m.tactics[side][key]!==value)m.disruption[side]=Math.min(.07,m.disruption[side]+(key==='formation'?.035:.008));
  m.tactics[side][key]=value;
  event(m,'tactic',`${side===0?'Home':'Away'} change ${key} to ${value}.`,{side});
}
export function stepMatch(s,m) {
  if(m.done||m.phase==='halftime')return m;
  advancePossessionMinute(s,m,{random,event,player,club});
  manageOpponents(s,m);
  if(m.minute===45){m.phase='halftime';event(m,'halftime',`Half-time. ${m.score[0]}–${m.score[1]}. Time to regroup.`);}
  if(m.minute===90){m.phase='fulltime';m.done=true;event(m,'fulltime',`Full-time. ${club(s,m.teams[0]).name} ${m.score[0]}–${m.score[1]} ${club(s,m.teams[1]).name}.`);}
  return m;
}
export function resumeMatch(m) {if(m.phase==='halftime'){m.phase='second';for(const id of m.lineups.flat().filter(Boolean))m.fitness[id]=clamp(m.fitness[id]+3,0,100);event(m,'kickoff','The second half gets underway.');}}
export function simulateMatch(s,m) {while(!m.done){resumeMatch(m);stepMatch(s,m);}return m;}
export function startMatch(s) {
  if(s.activeMatch)return s.activeMatch;
  const f=nextFixture(s);if(!f)throw Error('The season is complete.');
  const error=validateLineup(s,club(s,s.userClubId));if(error)throw Error(error);
  s.activeMatch=createMatch(s,f);return s.activeMatch;
}
function account(s,c,amount,reason) {c.balance+=amount;if(amount>0)c.income+=amount;else c.expenses-=amount;s.ledger.unshift({season:s.season,round:s.round,clubId:c.id,amount,reason});s.ledger=s.ledger.slice(0,1000);}
function commitMatch(s,f,m) {
  if(f.result)throw Error('Fixture already played.');
  f.result={score:[...m.score],shots:[...m.shots],onTarget:[...m.onTarget],xg:[...m.xg],possession:possession(m),goals:{...m.goals},assists:{...m.assists},yellowCards:[...m.stats.yellowCards],redCards:[...m.stats.redCards],stats:structuredClone(m.stats),statsSinceMinute:m.statsSinceMinute,playerStats:structuredClone(m.playerStats)};
  for(const id of Object.keys(m.minutes))if(m.minutes[id]>0){const p=player(s,id);p.appearances++;p.minutes+=m.minutes[id];p.goals+=m.goals[id]||0;p.assists+=m.assists[id]||0;p.shots+=m.playerShots[id]||0;p.yellowCards+=m.cards.yellow[id]||0;if(m.cards.red.includes(id)){p.redCards++;p.suspension=2;} const sideForm=m.teams.indexOf(p.clubId);const resultBonus=m.score[sideForm]>m.score[1-sideForm]?.25:m.score[sideForm]<m.score[1-sideForm]?-.35:0;const cleanSheet=m.score[1-sideForm]===0&&['GK','DEF'].includes(p.position)?.4:0;const formRating=m.statsSinceMinute===0&&m.playerStats[id]?m.playerStats[id].rating:clamp(6.5+(m.goals[id]||0)*.8+(m.assists[id]||0)*.4+(m.playerShots[id]||0)*.04+resultBonus+cleanSheet,4,10);p.form=[...(p.form||[]),Number(formRating.toFixed(1))].slice(-5);p.fitness=m.fitness[id];const side=m.teams.indexOf(p.clubId);p.morale=clamp(p.morale+(m.score[side]>m.score[1-side]?5:m.score[side]===m.score[1-side]?0:-5),25,100);}
  for(const inj of m.injuries){player(s,inj.id).injury=inj.weeks+1; if(player(s,inj.id).clubId===s.userClubId)news(s,`${player(s,inj.id).name} will miss ${inj.weeks} week(s) through injury.`);}
  for(let side=0;side<2;side++)buildFamiliarity(club(s,m.teams[side]),squad(s,m.teams[side]),m,side);
  if(m.teams.includes(s.userClubId))s.lastMatch=matchSummary(m);
  const home=club(s,f.home);account(s,home,Math.round(95000+home.strength*1600+random(s)*20000),'Matchday revenue');
}
export function possession(m) {const total=m.possessionTicks[0]+m.possessionTicks[1];return total?[Math.round(m.possessionTicks[0]/total*100),100-Math.round(m.possessionTicks[0]/total*100)]:[50,50];}
function weeklyUpdate(s) {
  for(const c of s.clubs){const wages=squad(s,c.id).reduce((a,p)=>a+p.wage,0);account(s,c,-wages,'Weekly wages');account(s,c,s.league.finance.sponsorship,'Sponsorship');account(s,c,-s.league.finance.operations,'Club operations');}
  for(const p of s.players) {
    if(p.suspension>0)p.suspension--;
    const focus=p.clubId===s.userClubId?s.training:'Balanced',intensity=p.clubId===s.userClubId?s.trainingIntensity:'Normal';
    if(p.injury){p.injury--;p.fitness=clamp(p.fitness+7,0,100);}
    else {
      p.fitness=clamp(p.fitness+(intensity==='Rest'?24:intensity==='Intense'?12:19)-(p.fitness<35?5:0),0,100);
      p.morale=clamp(p.morale+(intensity==='Rest'?2:1),0,100);
      if(intensity==='Intense'&&random(s)<.018){p.injury=1+Math.floor(random(s)*2);if(p.clubId===s.userClubId)news(s,`${p.name} suffered a training injury (${p.injury} weeks).`);}
      if(intensity!=='Rest'&&ability(p)<p.potential) {
        p.development+=(p.age<24?.32:.13)*(intensity==='Intense'?1.6:1);
        if(p.development>=1){p.development-=1;const fields=focus==='Attacking'?['finishing','composure','dribbling','technique']:focus==='Defending'?['defending','tackling','marking','keeping','reflexes']:focus==='Fitness'?['stamina','pace','strength','acceleration']:ALL_ATTRIBUTES;const key=choose(s,fields);p[key]=clamp(p[key]+1,1,99);}
      }
    }
  }
}
export function finishRound(s) {
  const m=s.activeMatch;const bye=!nextFixture(s)&&s.round<s.fixtures.length;if(!bye&&!m?.done)throw Error('Finish your match first.');
  const fs=s.fixtures[s.round],own=m?fs.find(f=>f.id===m.fixtureId):null;if(own)commitMatch(s,own,m);
  for(const f of fs)if(!f.result){const other=createMatch(s,f);simulateMatch(s,other);commitMatch(s,f,other);}
  const user=club(s,s.userClubId);if(own)news(s,`${club(s,own.home).short} ${m.score[0]}–${m.score[1]} ${club(s,own.away).short}. Matchweek ${s.round+1} complete.`);
  weeklyUpdate(s);s.round++;s.activeMatch=null;
  for(const c of s.clubs)if(c.id!==s.userClubId||validateLineup(s,c))autoLineup(s,c);
  const rank=standings(s).findIndex(c=>c.id===s.userClubId)+1;const target=boardTarget(s,user),settings=difficultySettings(s);
  s.boardConfidence=clamp(settings.boardBase+(target-rank)*settings.boardSlope,15,100);
  if(s.round===s.fixtures.length){const winner=standings(s)[0];news(s,`${winner.name} are champions! Your club finishes ${rank}${rank===1?'st':rank===2?'nd':rank===3?'rd':'th'}.`);for(const [i,c] of standings(s).entries())account(s,club(s,c.id),Math.max(s.league.finance.prizeMinimum,s.league.finance.prizeBase-i*s.league.finance.prizeStep),'Season prize money');}
  else aiTransfers(s);
  return own?.result||null;
}
export function scout(s,id) {
  if(s.activeMatch)throw Error('Scouting is unavailable during a match.');
  const p=player(s,id),c=club(s,s.userClubId);if(!p||p.clubId===c.id)throw Error('Choose another club’s player.');
  if(s.scouted.includes(id))return;
  if(c.balance<s.league.transferRules.scoutingCost)throw Error('Insufficient scouting budget.');account(s,c,-s.league.transferRules.scoutingCost,`Scouting: ${p.name}`);s.scouted.push(id);news(s,`Scout report ready: ${p.name}. Ability ${Math.round(ability(p))}, potential ${p.potential}.`);
}
function movePlayer(s,p,buyer,fee,wage,years) {
  const seller=club(s,p.clubId);account(s,buyer,-fee,`Transfer in: ${p.name}`);account(s,seller,fee,`Transfer out: ${p.name}`);p.clubId=buyer.id;p.wage=wage;p.contract=years;p.morale=80;
  for(const c of [seller,buyer])autoLineup(s,c);
}
export function transfer(s,id,fee,wage,years=3) {
  if(s.activeMatch)throw Error('Transfers are unavailable during a match.');if(s.league.transferRules.window==='preseason'&&s.round!==0)throw Error('The transfer window is closed until next season.');
  const p=player(s,id),buyer=club(s,s.userClubId);if(!p||p.clubId===buyer.id)throw Error('Player is already at your club.');
  if(!Number.isSafeInteger(fee)||fee<0||!Number.isSafeInteger(wage)||wage<100||![1,2,3,4].includes(years))throw Error('Enter valid fee, weekly wage, and contract length.');
  if(buyer.balance<fee+wage*s.league.transferRules.wageReserveWeeks)throw Error('Insufficient cash for fee and required wage reserve.');
  const seller=club(s,p.clubId),roster=squad(s,seller.id);if(roster.length<=s.league.transferRules.minSquad||roster.filter(x=>x.position===p.position).length<=(p.position==='GK'?s.league.transferRules.minKeepers:s.league.transferRules.minOutfieldPerGroup))throw Error('The selling club cannot spare this player.');
  if(squad(s,buyer.id).length>=s.league.transferRules.maxSquad)throw Error('League squad limit reached.');
  if(s.negotiations.some(n=>n.id===id&&n.round===s.round))throw Error('This player has already negotiated this week.');
  s.negotiations.push({id,round:s.round});
  const desiredWage=negotiationWage(s,p);
  const acceptsClub=fee>=marketPrice(s,p)*(1+(random(s)-.5)*.16);
  const acceptsPlayer=wage>=desiredWage&&(!p.injury)&&years>= (p.age<24?2:1);
  if(!acceptsClub){news(s,`${seller.name} rejected your £${fee.toLocaleString()} bid for ${p.name}.`);return {ok:false,message:'Club rejected the fee. Try next week.'};}
  if(!acceptsPlayer){news(s,`${p.name} declined your contract offer.`);return {ok:false,message:`Player wants at least £${desiredWage.toLocaleString()}/week${p.age<24?' and a two-year deal':''}; injured players wait until recovery. Try next week.`};}
  movePlayer(s,p,buyer,fee,wage,years);news(s,`${p.name} joins ${buyer.name} for £${fee.toLocaleString()}, on £${wage.toLocaleString()}/week.`);return {ok:true,message:'Transfer completed.'};
}
export function sellPlayer(s,id) {
  if(s.activeMatch)throw Error('Transfers are unavailable during a match.');if(s.league.transferRules.window==='preseason'&&s.round!==0)throw Error('The transfer window is closed until next season.');const p=player(s,id),seller=club(s,s.userClubId);
  if(!p||p.clubId!==seller.id)throw Error('Choose your player.');
  const roster=squad(s,seller.id);if(roster.length<=s.league.transferRules.minSquad||roster.filter(x=>x.position===p.position).length<=(p.position==='GK'?s.league.transferRules.minKeepers:s.league.transferRules.minOutfieldPerGroup))throw Error('Keep at least sixteen players, two keepers, and three players in each outfield position.');
  if(p.injury)throw Error('Buyers will wait until this player recovers.');
  const fee=playerValue(p);const buyers=s.clubs.filter(c=>c.id!==seller.id&&c.balance>fee+p.wage*s.league.transferRules.wageReserveWeeks&&squad(s,c.id).length<s.league.transferRules.maxSquad);
  if(!buyers.length)throw Error('No club can afford this player.');
  const buyer=choose(s,buyers);movePlayer(s,p,buyer,fee,p.wage,p.contract);news(s,`${buyer.name} sign ${p.name} for £${fee.toLocaleString()}.`);return fee;
}
function aiTransfers(s) {
  if(s.league.transferRules.window==='preseason'&&s.round!==0)return;
  if(random(s)>.6)return;const buyers=s.clubs.filter(c=>c.id!==s.userClubId&&squad(s,c.id).length<Math.min(26,s.league.transferRules.maxSquad));const buyer=choose(s,buyers);if(!buyer)return;
  const targets=s.players.filter(p=>p.clubId!==buyer.id&&p.clubId!==s.userClubId&&!p.injury&&askingPrice(p)+p.wage*s.league.transferRules.wageReserveWeeks<buyer.balance&&squad(s,p.clubId).length>Math.max(18,s.league.transferRules.minSquad)&&squad(s,p.clubId).filter(x=>x.position===p.position).length>(p.position==='GK'?s.league.transferRules.minKeepers:s.league.transferRules.minOutfieldPerGroup));
  if(targets.length){const p=choose(s,targets);movePlayer(s,p,buyer,askingPrice(p),Math.round(p.wage*1.1/100)*100,3);news(s,`${buyer.name} sign ${p.name} from the transfer market.`);}
}
export function renewContract(s,id,years,wage) {
  if(s.activeMatch)throw Error('Renew contracts between matches.');const p=player(s,id);if(!p||p.clubId!==s.userClubId)throw Error('Choose your player.');
  if(!Number.isSafeInteger(wage)||wage<Math.round(p.wage*1.05/100)*100||![1,2,3,4].includes(years))throw Error('Offer 1–4 years and at least a 5% wage rise.');
  if(club(s,p.clubId).balance<wage*s.league.transferRules.wageReserveWeeks)throw Error('Insufficient wage reserve.');p.wage=wage;p.contract=years;p.morale=clamp(p.morale+5,0,100);news(s,`${p.name} renews for ${years} years.`);
}
export function nextSeason(s) {
  if(s.round!==s.fixtures.length||s.activeMatch)throw Error('Finish the season first.');
  s.history.push({season:s.season,table:standings(s).map(c=>({name:c.name,points:c.points,gf:c.gf,ga:c.ga})),topScorer:[...s.players].sort((a,b)=>b.goals-a.goals)[0].name});
  // Expiring players remain through a one-year bridge deal. No squad is silently gutted.
  for(const p of s.players){p.age=Math.min(50,p.age+1);p.contract--;if(p.contract<=0){p.contract=1;p.wage=Math.round(p.wage*1.08/100)*100;if(p.clubId===s.userClubId)news(s,`${p.name} accepts an automatic one-year bridge deal (+8% wage).`);}p.goals=0;p.assists=0;p.appearances=0;p.minutes=0;p.shots=0;p.yellowCards=0;p.redCards=0;p.suspension=0;p.form=[];p.fitness=100;p.injury=0;}
  s.season++;s.round=0;s.fixtures=fixtures(s.clubs.map(c=>c.id),s.season,s.league.schedule.legs);s.negotiations=[];for(const c of s.clubs)autoLineup(s,c);news(s,`Season ${s.season} begins. All ${s.clubs.length} clubs return for another title race.`);
}
export function serialize(s) {return JSON.stringify(s);}
export function deserialize(text) {
  if(typeof text!=='string'||text.length>5_000_000)throw Error('Invalid or oversized save.');
  const s=JSON.parse(text);upgradeSave(s);validateSave(s);return s;
}
function validateSave(s) {
  const fail=()=>{throw Error('Invalid save file or unsupported version.');};
  if(!s||s.version!==VERSION||!Number.isInteger(s.rng)||!Number.isInteger(s.seed)||!Number.isInteger(s.season)||s.season<1||!Number.isInteger(s.round)||s.round<0||s.round>s.fixtures?.length||!Array.isArray(s.clubs)||s.clubs.length<2||s.clubs.length>40||!Array.isArray(s.players)||s.players.length<22||s.players.length>5000||!Array.isArray(s.fixtures)||!s.league||s.fixtures.length!==fixtures(s.clubs.map(c=>c.id),s.season,s.league.schedule?.legs).length)fail();
  if(!DIFFICULTIES[s.difficulty]||!s.assistant||!Number.isInteger(s.assistant.appliedCount)||s.assistant.appliedCount<0)fail();
  const profile=s.assistant.profile;if(!profile||!['name','nationality'].every(k=>typeof profile[k]==='string'&&profile[k].length<=100)||!['tacticalKnowledge','playerEvaluation','motivating','judgingAbility'].every(k=>Number.isInteger(profile[k])&&profile[k]>=1&&profile[k]<=20))fail();
  const validFamiliarity=f=>f&&typeof f==='object'&&Object.values(f).every(v=>Number.isFinite(v)&&v>=0&&v<=100);
  const validStats=st=>st&&STAT_KEYS.every(k=>Array.isArray(st[k])&&st[k].length===2&&st[k].every(v=>Number.isFinite(v)&&v>=0));
  const validPair=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0);
  if(validateDatabase({leagues:[s.league],clubs:s.clubs.map(c=>({...c,balance:Math.max(0,c.balance)})),players:s.players}).length)fail();
  const cids=new Set(s.clubs.map(c=>c.id)),pids=new Set(s.players.map(p=>p.id));if(cids.size!==s.clubs.length||pids.size!==s.players.length||!cids.has(s.userClubId))fail();
  const validT=t=>t&&FORMATIONS[t.formation]&&Object.keys(OPTIONS).every(k=>OPTIONS[k].includes(t[k]));
  const textOk=t=>typeof t==='string'&&t.length<=300;
  for(const c of s.clubs)if(!textOk(c.id)||!textOk(c.name)||!textOk(c.short)||!textOk(c.stadium)||!textOk(c.identity)||!/^#[0-9a-f]{6}$/i.test(c.color)||!textOk(c.expectation)||![c.balance,c.strength,c.income,c.expenses].every(Number.isFinite)||!validT(c.tactics)||!Array.isArray(c.lineup)||c.lineup.length!==11||!Array.isArray(c.bench)||c.bench.length>7||[...c.lineup,...c.bench].some(id=>id!==null&&!pids.has(id)))fail();
  for(const c of s.clubs){if(!c.familiarity||!validFamiliarity(c.familiarity.formations)||!validFamiliarity(c.familiarity.instructions)||!validFamiliarity(c.familiarity.styles)||!c.takers||!['penalty','freeKick','leftCorner','rightCorner'].every(k=>pids.has(c.takers[k])&&player(s,c.takers[k]).clubId===c.id))fail();}
  for(const p of s.players)if(!validFamiliarity(p.familiarity)||!roleDefinition(p.role).duties.includes(p.duty)||!Number.isInteger(p.suspension)||p.suspension<0||p.suspension>10||!Number.isInteger(p.redCards)||p.redCards<0)fail();
  for(const p of s.players)if(!Array.isArray(p.form)||p.form.length>5||p.form.some(v=>!Number.isFinite(v)||v<0||v>10)||!textOk(p.id)||!textOk(p.name)||!cids.has(p.clubId)||!ROLES[p.position]?.includes(p.role)||!['finishing','passing','defending','keeping','pace','stamina','potential','fitness','morale'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=100)||!['age','injury','wage','contract','yellowCards','goals','assists','appearances','minutes','shots','development'].every(k=>Number.isFinite(p[k])&&p[k]>=0))fail();
  const fids=new Set();
  s.fixtures.forEach((round,r)=>{if(!Array.isArray(round)||round.length!==Math.floor(s.clubs.length/2))fail();const teams=new Set();for(const f of round){if(!textOk(f.id)||fids.has(f.id)||!cids.has(f.home)||!cids.has(f.away)||f.home===f.away)fail();fids.add(f.id);teams.add(f.home);teams.add(f.away);if((r<s.round)!==!!f.result)fail();if(f.result&&(!Array.isArray(f.result.score)||f.result.score.length!==2||f.result.score.some(x=>!Number.isInteger(x)||x<0||x>90)))fail();}if(teams.size!==Math.floor(s.clubs.length/2)*2)fail();});
  if(!Array.isArray(s.news)||s.news.length>100||s.news.some(n=>!textOk(n.text))||!Array.isArray(s.ledger)||s.ledger.length>1000||s.ledger.some(l=>!textOk(l.reason)||!Number.isFinite(l.amount)||!cids.has(l.clubId))||!Array.isArray(s.scouted)||s.scouted.some(id=>!pids.has(id))||!Array.isArray(s.negotiations)||!Array.isArray(s.history)||!['Balanced','Attacking','Defending','Fitness'].includes(s.training)||!['Normal','Intense','Rest'].includes(s.trainingIntensity)||!Number.isFinite(s.boardConfidence))fail();
  const m=s.activeMatch;if(m){
    if(!validStats(m.stats)||!Number.isInteger(m.statsSinceMinute)||m.statsSinceMinute<0||m.statsSinceMinute>m.minute||!Array.isArray(m.possessions)||m.possessions.length>500||!validPair(m.disruption)||m.disruption.some(v=>v>.1)||!m.roles||!m.duties||Object.entries(m.roles).some(([id,role])=>!pids.has(id)||!ROLES[player(s,id).position].includes(role))||Object.entries(m.duties).some(([id,duty])=>!pids.has(id)||!roleDefinition(m.roles[id]).duties.includes(duty)))fail();
    if(!Array.isArray(m.takers)||m.takers.length!==2||m.takers.some((t,i)=>!['penalty','freeKick','leftCorner','rightCorner'].every(k=>m.lineups[i].includes(t[k])))||!m.assistantLive||!Number.isInteger(m.assistantLive.lastPromptMinute)||m.assistantLive.lastPromptMinute<0||!Array.isArray(m.assistantLive.ignored)||m.assistantLive.ignored.length>500||m.assistantLive.ignored.some(v=>typeof v!=='string'||v.length>100))fail();
    if(!m.playerStats||Object.entries(m.playerStats).some(([id,stats])=>!pids.has(id)||!stats||Object.values(stats).some(v=>!Number.isFinite(v)||v<0)))fail();
    if(m.score.some((v,i)=>v>m.onTarget[i])||m.onTarget.some((v,i)=>v>m.shots[i])||m.cards.red.some(id=>m.lineups.flat().includes(id)))fail();
if(!m.cards||!m.cards.yellow||!Array.isArray(m.cards.red)||m.cards.red.some(id=>!pids.has(id))||Object.entries(m.cards.yellow).some(([id,n])=>!pids.has(id)||![1,2].includes(n)))fail();if(!Number.isInteger(m.aiRng)||!Array.isArray(m.aiChanges)||m.aiChanges.length!==2||m.aiChanges.some(n=>!Number.isInteger(n)||n<0))fail();const expected=nextFixture(s);if(!expected||m.fixtureId!==expected.id||JSON.stringify(m.teams)!==JSON.stringify([expected.home,expected.away])||!Number.isInteger(m.rng)||!Number.isInteger(m.minute)||m.minute<0||m.minute>90||!['first','halftime','second','fulltime'].includes(m.phase)||typeof m.done!=='boolean'||m.done!==(m.minute===90)||!Array.isArray(m.tactics)||m.tactics.length!==2||!m.tactics.every(validT))fail();
    for(const key of ['score','shots','onTarget','xg','possessionTicks','subs'])if(!Array.isArray(m[key])||m[key].length!==2||m[key].some(x=>!Number.isFinite(x)||x<0))fail();
    for(const key of ['lineups','bench','used'])if(!Array.isArray(m[key])||m[key].length!==2||m[key].some((ids,i)=>!Array.isArray(ids)||ids.some(id=>id!==null&&(!pids.has(id)||player(s,id).clubId!==m.teams[i]))))fail();
    if(m.lineups.some(ids=>ids.length!==11||new Set(ids.filter(Boolean)).size!==ids.filter(Boolean).length||ids.filter(Boolean).length<7)||!Array.isArray(m.events)||m.events.some(e=>!textOk(e.text))||!Array.isArray(m.knocks)||!Array.isArray(m.injuries)||m.injuries.some(i=>!pids.has(i.id)||!Number.isInteger(i.weeks)||i.weeks<1||i.weeks>4))fail();
    for(const key of ['fitness','minutes','goals','assists','playerShots'])if(!m[key]||typeof m[key]!=='object'||Object.entries(m[key]).some(([id,v])=>!pids.has(id)||!Number.isFinite(v)||v<0))fail();
    for(const key of ['captains','setPieces'])if(!Array.isArray(m[key])||m[key].length!==2||m[key].some(id=>!pids.has(id)))fail();
  }
}

export function editClub(s,id,changes) {
  if(s.activeMatch)throw Error('Edit clubs between matches.');
  const c=club(s,id);if(!c)throw Error('Unknown club.');
  if(!changes.name?.trim()||changes.name.length>60||!/^#[a-f0-9]{6}$/i.test(changes.color)||!Number.isSafeInteger(changes.balance)||changes.balance<0)throw Error('Enter a club name, hex color, and nonnegative whole-pound budget.');
  const delta=changes.balance-c.balance;if(delta)account(s,c,delta,'Editor budget adjustment');
  c.name=changes.name.trim();c.color=changes.color;c.short=(changes.short||c.short).slice(0,4).toUpperCase();
  news(s,`${c.name} club settings updated.`);
}
export function editLeague(s,changes) {
  if(s.activeMatch)throw Error('Edit league settings between matches.');
  const updated={...s.league,...structuredClone(changes)};
  const errors=validateDatabase({leagues:[updated],clubs:s.clubs.map(c=>({...c,balance:Math.max(0,c.balance)})),players:s.players});if(errors.length)throw Error(errors.slice(0,5).join('\n'));
  if(s.round>0&&JSON.stringify(updated.schedule)!==JSON.stringify(s.league.schedule))throw Error('Change the schedule before the first match of a season.');
  s.league=updated;if(s.round===0)s.fixtures=fixtures(s.clubs.map(c=>c.id),s.season,s.league.schedule.legs);news(s,'League settings updated.');
}
export function migratePlayers(s,players) {
  if(s.activeMatch)throw Error('Finish the match before migrating.');
  if(s.round!==0)throw Error('Migrate only before the first match of a season so statistics stay consistent.');
  const selected=players.filter(p=>s.clubs.some(c=>c.id===p.clubId));
  const errors=validatePlayers(selected,s.clubs);if(errors.length)throw Error(errors.slice(0,8).join('\n'));
  for(const c of s.clubs)if(selected.filter(p=>p.clubId===c.id).length<11||!selected.some(p=>p.clubId===c.id&&GROUPS[p.primaryPosition]==='GK'))throw Error(`${c.name} needs at least eleven players including a keeper.`);
  s.players=selected.map(p=>({...structuredClone(p),position:GROUPS[p.primaryPosition],fitness:100,morale:75,injury:0,goals:0,assists:0,appearances:0,minutes:0,shots:0,yellowCards:0,development:0,form:[],role:defaultRole(p),duty:roleDefinition(defaultRole(p)).duties.includes('Support')?'Support':roleDefinition(defaultRole(p)).duties[0],familiarity:{[defaultRole(p)]:65},suspension:0,redCards:0,...additionalAttributes(p)}));s.scouted=[];s.negotiations=[];s.lastMatch=null;for(const c of s.clubs)autoLineup(s,c);news(s,'Player database explicitly migrated into this career. Statistics and lineups reset.');
}

function upgradeSave(s){migrateSave(s);}
export function marketPrice(s,p){return Math.round(askingPrice(p)*difficultySettings(s).feeFactor/1000)*1000;}
export function negotiationWage(s,p){const buyer=club(s,s.userClubId),seller=club(s,p.clubId),settings=difficultySettings(s);return Math.round(p.wage*(buyer.strength<seller.strength?settings.lowerReputationWage:settings.wageFactor)/100)*100;}
export function setTacticalStyle(s,name) {
  if(s.activeMatch)throw Error('Use match-centre tactical controls during a match.');
  const c=club(s,s.userClubId);c.tactics=applyStyle(c.tactics,name);
}
export function changeMatchStyle(m,side,name) {
  if(m.done)throw Error('The match has ended.');
  m.disruption[side]=Math.min(.07,m.disruption[side]+.025);m.tactics[side]=applyStyle(m.tactics[side],name);event(m,'tactic',`${side===0?'Home':'Away'} switch to ${name}.`,{side});
}
function aiRandom(m){const holder={rng:m.aiRng};const value=random(holder);m.aiRng=holder.rng;return value;}
function manageOpponents(s,m) {
  const settings=difficultySettings(s);
  for(let side=0;side<2;side++){
    if(m.teams[side]===s.userClubId)continue;
    const other=1-side,t=m.tactics[side],opp=m.tactics[other],diff=m.score[side]-m.score[other];
    if(m.minute>=16&&m.minute%settings.adaptEvery===0&&aiRandom(m)<settings.adaptChance){
      const changes={};
      if(s.difficulty==='Easy') {if(m.minute>=70&&diff<=-2)changes.mentality='Attacking';}
      else {
        if(diff<0&&m.minute>=60){changes.mentality='Attacking';changes.tempo='Quick';}
        if(diff>0&&m.minute>=80){changes.mentality='Cautious';changes.pressing='Low';}
        if(s.difficulty==='Hard'){
          if(m.lineups[side].filter(Boolean).length<m.lineups[other].filter(Boolean).length&&diff>=0){changes.mentality='Cautious';changes.loss='Regroup';changes.line='Deep';}
          if(m.stats.highTurnovers[other]>=3&&t.buildup==='Play Out Of Defense'){changes.buildup='Direct From Defense';changes.distribution='Long';}
          const own=teamRatings(s,m,side),op=teamRatings(s,m,other),poss=possession(m)[side],avgFit=m.lineups[side].slice(1).filter(Boolean).reduce((n,id)=>n+m.fitness[id],0)/10;
          if(opp.line==='High'&&own.pace>=op.pace-3){changes.passing='Direct';changes.tempo='Quick';}
          if(t.line==='High'&&opp.passing==='Direct'&&op.pace>own.pace-2)changes.line='Deep';
          if(opp.width==='Narrow')changes.width='Wide';
          if(poss<40&&diff<=0&&avgFit>72){changes.pressing='High';changes.passing=opp.line==='High'&&own.pace>=op.pace-3?'Direct':own.control>58?'Short':'Direct';}
          if(avgFit<65)changes.pressing='Low';
          if(m.lineups[side].filter(id=>m.cards.yellow[id]).length>=2&&t.pressing==='High')changes.pressing='Standard';
          if(m.minute>=72&&diff<0)changes.mentality='Attacking';
          if(m.minute>=80&&diff>0){changes.mentality='Cautious';changes.line='Deep';}
        }
      }
      const actual=Object.entries(changes).filter(([key,val])=>t[key]!==val);
      if(actual.length){for(const [key,value]of actual)t[key]=value;m.aiChanges[side]++;event(m,'tactic',`${club(s,m.teams[side]).short} adjust ${actual.map(([k,v])=>`${k}: ${v}`).join(', ')}.`,{side});}
    }
    if(m.minute>=settings.subFrom&&m.minute%settings.subEvery===0&&m.subs[side]<5){
      const candidates=m.lineups[side].slice(1).filter(Boolean).map(id=>player(s,id)).sort((a,b)=>(m.knocks.includes(b.id)?1:0)-(m.knocks.includes(a.id)?1:0)||m.fitness[a.id]-m.fitness[b.id]);
      for(const out of candidates){
        const incoming=m.bench[side].map(id=>player(s,id)).filter(p=>!p.injury&&p.position===out.position).sort((a,b)=>ability(b)-ability(a))[0];
        if(incoming&&(m.fitness[out.id]<settings.subFitness||m.knocks.includes(out.id)||s.difficulty==='Hard'&&diff<0&&ability(incoming)>=ability(out)-5)){substitute(s,m,side,out.id,incoming.id);break;}
      }
    }
  }
}

export function changeMatchRole(s,m,side,id,role,duty){
 if(m.done||!m.lineups[side].includes(id))throw Error('Select an active player.');
 const p=player(s,id);if(!POSITION_ROLES[p.primaryPosition]?.includes(LEGACY_ROLES[role]||role)||!roleDefinition(role).duties.includes(duty))throw Error('Invalid role or duty for this player.');
 m.roles[id]=role;m.duties[id]=duty;m.disruption[side]=Math.min(.07,m.disruption[side]+.006);event(m,'tactic',`${p.name}: ${role}, ${duty}.`,{side,playerId:id});
}
