import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as E from '../src/engine.js';
import {applyStyle,TACTICAL_STYLES} from '../src/styles.js';
import {passCompletion} from '../src/statistics.js';
const read=async name=>JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const [clubs,leagues,file]=await Promise.all(['clubs','leagues','players'].map(read));
const db={clubs,leagues,players:file.players||file},count=Number(process.argv[2]||600),styles=Object.keys(TACTICAL_STYLES);
if(!Number.isInteger(count)||count<100||count>10000)throw Error('Choose 100–10,000 matches.');
const base=E.newGame(2026,clubs[0].id,db),totals={goals:0,shots:0,onTarget:0,xg:0,yellowCards:0,redCards:0,fouls:0,corners:0,homePossession:0,passCompletion:0,homeWins:0,draws:0,awayWins:0,maxGoals:0,scoreless:0,extreme:0};
const styleResults={};const started=performance.now();
for(let i=0;i<count;i++){
 const s=structuredClone(base);s.seed=(i+1)*7919;s.userClubId='calibration-observer';s.difficulty='Hard';
 const h=i%clubs.length,a=(h+1+Math.floor(i/clubs.length)%(clubs.length-1))%clubs.length;
 const home=E.club(s,clubs[h].id),away=E.club(s,clubs[a].id),hs=styles[i%styles.length],as=styles[(i*7+3)%styles.length];home.tactics=applyStyle(home.tactics,hs);away.tactics=applyStyle(away.tactics,as);
 const m=E.simulateMatch(s,E.createMatch(s,{id:`calibration-${i}`,home:home.id,away:away.id}));
 for(const k of ['score','shots','onTarget','xg'])totals[k==='score'?'goals':k]+=m[k][0]+m[k][1];
 for(const k of ['yellowCards','redCards','fouls','corners'])totals[k]+=m.stats[k][0]+m.stats[k][1];
 totals.homePossession+=E.possession(m)[0];totals.passCompletion+=(passCompletion(m,0)+passCompletion(m,1))/2;
 if(m.score[0]>m.score[1])totals.homeWins++;else if(m.score[0]<m.score[1])totals.awayWins++;else totals.draws++;
 const g=m.score[0]+m.score[1];totals.maxGoals=Math.max(totals.maxGoals,g);if(g===0)totals.scoreless++;if(g>=8)totals.extreme++;
 for(let side=0;side<2;side++){const style=side===0?hs:as,r=styleResults[style]??={matches:0,goals:0,xg:0,possession:0,fitness:0};r.matches++;r.goals+=m.score[side];r.xg+=m.xg[side];r.possession+=E.possession(m)[side];r.fitness+=m.used[side].reduce((n,id)=>n+m.fitness[id],0)/m.used[side].length;}
}
const round=n=>Number(n.toFixed(3));
const report={model:'TOUCHLINE tactical update v2',seedSequence:'7919 × (index + 1)',matches:count,pairing:'Round-robin club pairs, rotating styles; both AI managers use Hard decision rules. No rating boosts.',seconds:round((performance.now()-started)/1000),averages:Object.fromEntries(['goals','shots','onTarget','xg','yellowCards','redCards','fouls','corners','homePossession','passCompletion'].map(k=>[k,round(totals[k]/count)])),outcomes:{homeWinPercent:round(totals.homeWins/count*100),drawPercent:round(totals.draws/count*100),awayWinPercent:round(totals.awayWins/count*100),scorelessPercent:round(totals.scoreless/count*100),eightPlusGoalPercent:round(totals.extreme/count*100),maximumCombinedGoals:totals.maxGoals},styles:Object.fromEntries(Object.entries(styleResults).map(([k,r])=>[k,{matches:r.matches,goals:round(r.goals/r.matches),xg:round(r.xg/r.matches),possession:round(r.possession/r.matches),remainingFitness:round(r.fitness/r.matches)}]))};
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});await writeFile(new URL('../docs/calibration.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
// Broad guards detect broken calibration without claiming these are measured professional league statistics.
if(report.averages.goals<1.5||report.averages.goals>4.2||report.averages.shots<14||report.averages.shots>35||report.outcomes.drawPercent<12||report.outcomes.drawPercent>38||report.outcomes.eightPlusGoalPercent>5)process.exitCode=1;
