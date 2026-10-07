import {INSTRUCTION_DEFAULTS} from './tactical-settings.js';
import {defaultRole,roleDefinition} from './roles.js';
import {emptyStats,ensureStats} from './statistics.js';
export const SAVE_VERSION=2;
const seedHash=(text)=>{let h=2166136261;for(const ch of String(text))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};
export function assistantProfile(seed){const names=['Emil Rowan','Mara Vale','Adrian Voss','Nico Ardent','Talia Mercer','Luca Fen'];const countries=['Asterian','Valorian','Norlandic','Meridian'];const h=seedHash(`assistant:${seed}`);return {name:names[h%names.length],nationality:countries[(h>>>4)%countries.length],tacticalKnowledge:12+(h%7),playerEvaluation:11+((h>>>6)%8),motivating:10+((h>>>12)%9),judgingAbility:12+((h>>>18)%7)};}
export function additionalAttributes(p){return {workRate:p.workRate??p.teamwork,jumping:p.jumping??p.aerial,goalkeeperPositioning:p.goalkeeperPositioning??p.positioning,distribution:p.distribution??p.kicking};}
export function defaultTakers(c){return {penalty:c.setPiece,freeKick:c.setPiece,leftCorner:c.setPiece,rightCorner:c.setPiece};}
export function initializeMatchData(s,m){
 ensureStats(m);m.roles??=Object.fromEntries(s.players.filter(p=>m.teams.includes(p.clubId)).map(p=>[p.id,p.role]));m.duties??=Object.fromEntries(s.players.filter(p=>m.teams.includes(p.clubId)).map(p=>[p.id,p.duty||'Support']));m.disruption??=[0,0];m.takers??=m.teams.map((id,side)=>({...defaultTakers({setPiece:m.setPieces[side]}),...s.clubs.find(c=>c.id===id)?.takers}));for(let side=0;side<2;side++)for(const key of Object.keys(m.takers[side]))if(!m.lineups[side].includes(m.takers[side][key]))m.takers[side][key]=m.setPieces[side];m.assistantLive??={lastPromptMinute:0,ignored:[]};
}
export function migrateSave(s){
 if(!s||typeof s!=='object'||![1,2].includes(s.version))return;
 const old=s.version===1;
 s.difficulty??='Medium';s.assistant??={lastAsked:null,appliedCount:0};s.assistant.profile??=assistantProfile(s.seed||0);s.lastMatch??=null;
 if(Array.isArray(s.clubs))for(const c of s.clubs){if(c.tactics)c.tactics={...INSTRUCTION_DEFAULTS,...c.tactics};c.familiarity??={formations:{[c.tactics?.formation||'4-3-3']:65},instructions:{}};c.familiarity.styles??={};c.takers??=defaultTakers(c);}
 if(Array.isArray(s.players))for(const p of s.players){p.form??=[];p.yellowCards??=0;p.redCards??=0;p.suspension??=0;Object.assign(p,additionalAttributes(p));p.role??=defaultRole(p);p.duty??=roleDefinition(p.role).duties.includes('Support')?'Support':roleDefinition(p.role).duties[0];p.familiarity??={[p.role]:65};}
 if(Array.isArray(s.fixtures))for(const rr of s.fixtures)if(Array.isArray(rr))for(const f of rr)if(f.result){f.result.yellowCards??=[0,0];f.result.redCards??=[0,0];}
 const m=s.activeMatch;if(m){m.cards??={yellow:{},red:[]};m.aiRng??=seedHash(String(m.fixtureId)+'ai')^(s.seed||0);m.aiChanges??=[0,0];if(Array.isArray(m.tactics))m.tactics=m.tactics.map(t=>({...INSTRUCTION_DEFAULTS,...t}));if(old&&!m.stats){m.stats=emptyStats();m.statsSinceMinute=m.minute;m.stats.yellowCards=m.teams.map((id,side)=>m.used[side].reduce((n,id)=>n+(m.cards.yellow[id]||0),0));}// Prior unrecorded pass/foul data stays explicitly unavailable.
 initializeMatchData(s,m);}
 s.version=SAVE_VERSION;
}
