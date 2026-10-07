// @ts-check
import {calculateStrengths,tacticalWorkload,POSITION_SLOTS} from './tactics.js';
import {directLevel,lineLevel,pressLevel,tempoLevel} from './tactical-settings.js';
import {roleBehavior} from './roles.js';
import {ensureStats,playerStats,updateRatings} from './statistics.js';
import {describeEvent,describeShot} from './commentary.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function shotXG(context){
 // Geometric/context prior with modest shooter skill and delivery adjustments; fitness/keeper affect conversion separately.
 const {distance,angle,pressure,type}=context;
 const finishingAdjustment=context.finishing===undefined?1:.92+context.finishing/850;
 const deliveryAdjustment=context.delivery===undefined?1:1+(context.delivery-65)/400;
 const geometric=.68*deliveryAdjustment*Math.exp(-distance/13)*clamp(Math.cos(angle),.2,1)*(1-pressure*.46);
 const range={long:[.02,.08],box:[.08,.25],good:[.25,.5],oneOnOne:[.3,.6],exceptional:[.5,.8],cross:[.045,.25],setPiece:[.025,.15],penalty:[.76,.76]}[type]||[.02,.5];
 return clamp(geometric*finishingAdjustment*(type==='oneOnOne'?1.6:type==='exceptional'?1.5:type==='cross'?.48:1),...range);
}
/** @param {import('./types.js').Career} s @param {import('./types.js').Match} m @param {import('./types.js').MatchAdapter} api */
export function advancePossessionMinute(s,m,api){
 const {random:r,event,player,club}=api;ensureStats(m);m.minute++;
 const pick=xs=>xs[Math.min(xs.length-1,Math.floor(r(m)*xs.length))];
 const active=side=>m.lineups[side].filter(Boolean).map(id=>player(s,id));
 const select=(side,purpose)=>{const ps=active(side).filter(p=>p.position!=='GK');const weights=ps.map(p=>{const b=roleBehavior(m.roles[p.id],m.duties[p.id]);return purpose==='aerial'?(p.heading*.45+p.strength*.3+p.jumping*.25)*b.aerial*(p.position==='FWD'?2.5:p.position==='DEF'?.8:.4):purpose==='buildup'?(p.passing*.4+p.vision*.2+p.decisions*.25+p.firstTouch*.15)*b.buildup*(p.position==='DEF'?1.8:p.position==='MID'?1:.3):purpose==='shot'?(p.finishing*.7+p.composure*.3)*b.finishing*(p.position==='FWD'?3:p.position==='MID'?1:.25):purpose==='creator'?(p.passing*.45+p.vision*.35+p.decisions*.2)*b.creation*(p.position==='MID'?1.6:p.position==='FWD'?1.2:.4):(p.tackling*.45+p.positioning*.3+p.decisions*.25)*(p.position==='DEF'?1.5:p.position==='MID'?1:.35);});let roll=r(m)*weights.reduce((a,b)=>a+b,0);return ps[weights.findIndex(w=>(roll-=w)<=0)]||ps.at(-1);};
 for(let side=0;side<2;side++){m.disruption[side]=Math.max(0,m.disruption[side]-.0015);for(const p of active(side)){playerStats(m,p.id);m.minutes[p.id]=(m.minutes[p.id]||0)+1;m.fitness[p.id]=clamp(m.fitness[p.id]-tacticalWorkload(p,m.tactics[side],m.roles[p.id],m.duties[p.id]),10,100);}}
 const strength=[calculateStrengths(s,m,0),calculateStrengths(s,m,1)];
 let side=r(m)<clamp(strength[0].midfield/(strength[0].midfield+strength[1].midfield),.23,.77)?0:1;
 m.possessionTicks[side]++;
 const record={minute:m.minute,side,phases:['goalkeeper'],ending:null,source:'buildup'};
 const note=(type,actor,extra={})=>event(m,type,describeEvent(type,actor.name,r(m)),{side,playerId:actor.id,...extra});
 const end=(ending)=>{record.ending=ending;m.possessions.push(structuredClone(record));};
 const passBlock=(count,quality)=>{const actor=select(side,record.phases.at(-1)==='defensive-buildup'?'buildup':'creator');const completed=Array.from({length:count},()=>r(m)<quality?1:0).reduce((a,b)=>a+b,0);m.stats.passes[side]+=count;m.stats.completedPasses[side]+=completed;const ps=playerStats(m,actor.id);ps.passes+=count;ps.completedPasses+=completed;event(m,'pass',`${club(s,m.teams[side]).short}: ${completed} of ${count} passes completed in ${record.phases.at(-1).replaceAll('-',' ')}.`,{side,playerId:actor.id,passes:count,completedPasses:completed});return completed/count;};
 let a=strength[side],d=strength[1-side],t=m.tactics[side],opp=m.tactics[1-side],direct=directLevel(t);
 const pressure=pressLevel(opp),short=direct<0||t.buildup==='Play Out Of Defense';
 const keeper=player(s,m.lineups[side][0]);
 if(keeper){const ps=playerStats(m,keeper.id);ps.passes++;m.stats.passes[side]++;const success=r(m)<clamp(.88+(a.distribution-65)/300-(t.distribution==='Long'?.22:0),.45,.96);if(success){ps.completedPasses++;m.stats.completedPasses[side]++;}else if(t.distribution==='Long'&&r(m)>.48+(a.aerial-d.aerial)/160){m.stats.interceptions[1-side]++;const defender=select(1-side,'defender');playerStats(m,defender.id).interceptions++;event(m,'interception',describeEvent('interception',defender.name,r(m)),{side:1-side,playerId:defender.id});end('interception');return finishMinute();}}
 record.phases.push('defensive-buildup');
 const buildupPasses=short?4:direct>0?2:3;
 const completion=clamp(.79+(a.buildup-65)/260-pressure*.024+(short?.07:-direct*.065)-(t.freedom==='Expressive'?.025:0),.48,.96);
 const completedBuildup=passBlock(buildupPasses,completion);
 if(completedBuildup<.5&&r(m)<.3){event(m,'misplaced-pass',`${select(side,'creator').name} cannot connect the forward pass.`,{side});end('misplaced-pass');return finishMinute();}
 const lose=clamp(.105+Math.max(0,a.risk-1)*.16+(d.pressing-a.buildup)/220+(short?pressure*.024:0)-(direct>0?.055:0)+(100-a.stamina)*.00035,.035,.35);
 if(r(m)<lose){m.stats.buildupLosses[side]++;const defender=select(1-side,'defender');if(pressure>=2||opp.loss==='Counter-Press'){
  m.stats.highTurnovers[1-side]++;record.source='high-turnover';event(m,'turnover',describeEvent('turnover',defender.name,r(m)),{side:1-side,playerId:defender.id});
  if(r(m)<.54){side=1-side;record.side=side;a=strength[side];d=strength[1-side];t=m.tactics[side];opp=m.tactics[1-side];direct=directLevel(t);record.phases.push('high-turnover');}
  else{end('high-turnover');return finishMinute();}
 }else{m.stats.interceptions[1-side]++;playerStats(m,defender.id).interceptions++;event(m,'interception',describeEvent('interception',defender.name,r(m)),{side:1-side,playerId:defender.id});end('interception');return finishMinute();}}
 record.phases.push('midfield-progression');
 const counter=t.win==='Counter'&&(record.source==='high-turnover'||r(m)<.22+(opp.mentality==='Attacking'?.16:0)+(opp.overlapLeft==='On'||opp.overlapRight==='On'?.08:0));
 if(counter){record.source='counter';m.stats.counterAttacks[side]++;}
 const creator=select(side,'creator');
 if(counter)event(m,'counter',`${creator.name} looks forward immediately: ${club(s,m.teams[side]).short} counter into the space left behind.`,{side,playerId:creator.id});
 const forwardRoles=active(side).filter(p=>p.position==='FWD').map(p=>roleBehavior(m.roles[p.id],m.duties[p.id])),roleWidth=forwardRoles.reduce((n,b)=>n+b.width,0)/Math.max(1,forwardRoles.length);
 const laneRoll=r(m),wide=t.width==='Wide'||t.finalThird==='Early Crosses';const wideProbability=clamp((wide?.4:.2)*roleWidth,.12,.44);const lane=laneRoll<wideProbability?'left':laneRoll<wideProbability*2?'right':'central';record.lane=lane;m.stats[`${lane}Attacks`][side]++;
 const wingBonus=lane!=='central'?(opp.defensiveWidth==='Wide'?0:opp.defensiveWidth==='Narrow'?.06:0)+(a.width-d.organization)/400+(t.overlapLeft==='On'&&lane==='left'||t.overlapRight==='On'&&lane==='right'?.04:0):t.width==='Narrow'?.025:0;
 passBlock(counter||direct>0?2:4,clamp(.79+(a.midfield-65)/280-direct*.065-pressure*.018+(t.freedom==='Disciplined'?.02:0),.45,.94));
 const defender=select(1-side,'defender'),individualDuel=(creator.dribbling*.35+creator.agility*.2+creator.acceleration*.2+creator.decisions*.25)-(defender.tackling*.35+defender.positioning*.35+defender.decisions*.3);
 const progression=clamp(.74+individualDuel/650+(a.creation-d.organization)/160+wingBonus+(counter?(a.transitionAttack-d.transitionDefense)/180+.05:0)+(direct>0?(a.aerial-d.aerial)/240:0),.42,.91);
 if(r(m)>progression){const defender=select(1-side,'defender');const tackle=r(m)<.6;const stat=tackle?'tackles':'interceptions';m.stats[stat][1-side]++;playerStats(m,defender.id)[stat]++;event(m,tackle?'tackle':'interception',describeEvent(tackle?'tackle':'interception',defender.name,r(m)),{side:1-side,playerId:defender.id});end(tackle?'tackle':'interception');return finishMinute();}
 record.phases.push('final-third');
 const breakaway=(counter||direct>0||r(m)<.18)&&lineLevel(opp)>0;
 if(breakaway&&r(m)<(opp.offsideTrap==='On'?.13:.065)+Math.max(0,lineLevel(opp))*.015){m.stats.offsides[side]++;note('offside',creator);end('offside');return finishMinute();}
 if(r(m)<.075){event(m,'progression',`${creator.name} reaches the final third and recycles possession rather than forcing a chance.`,{side,playerId:creator.id});end('completed-progression');return finishMinute();}
 record.phases.push('chance-creation');
 const quality=clamp(.34+(a.creation-d.organization)/190+(counter?.055:0)+(record.source==='high-turnover'?.045:0)+(t.finalThird==='Shoot On Sight'?.11:t.finalThird==='Work Ball Into Box'?-.045:0),.21,.7);
 if(r(m)>quality){m.stats.clearances[1-side]++;const defender=select(1-side,'defender');event(m,'clearance',describeEvent('clearance',defender.name,r(m)),{side:1-side,playerId:defender.id});if(r(m)<.28){m.stats.corners[side]++;event(m,'corner',`${club(s,m.teams[side]).short} win a corner.`,{side});if(r(m)<clamp(.23+(a.aerial-d.aerial)/300+(a.setPieces-65)/700+(cornerDelivery()-65)/300,.08,.38)){record.source='set-piece';takeShot('cross',creator);}else end('corner-clearance');}else end('clearance');return finishMinute();}
 let type='box';const v=r(m);
 if(breakaway&&a.frontPace>d.defensePace-4&&v<.27){type='oneOnOne';m.stats.throughBalls[side]++;event(m,'through-ball',`${creator.name} threads a pass behind the defensive line.`,{side,playerId:creator.id});}
 else if(record.source==='high-turnover'&&v<.16)type='good';
 else if(lane!=='central'&&(wide||v<.5)){type='cross';m.stats.crosses[side]++;event(m,'cross',`${creator.name} sends a cross into the box.`,{side,playerId:creator.id});}
 else if(t.finalThird==='Shoot On Sight'?v<.72:v<.26)type='long';
 else if(v>.988)type='exceptional';else if(v>.945||t.finalThird==='Work Ball Into Box'&&v>.85)type='good';
 takeShot(type,creator);return finishMinute();
 function cornerDelivery(){const id=m.takers[side][record.lane==='left'?'leftCorner':'rightCorner'],p=player(s,id);return p?p.crossing*.45+p.technique*.3+p.passing*.25:a.setPieces;}
 function takeShot(type,helper){
  let shooter=select(side,type==='cross'?'aerial':'shot');if(type==='setPiece'||type==='penalty'){const id=m.takers[side][type==='penalty'?'penalty':'freeKick'];if(m.lineups[side].includes(id))shooter=player(s,id);}
  if(record.source==='set-piece'&&type==='cross'){const id=m.takers[side][record.lane==='left'?'leftCorner':'rightCorner'];if(m.lineups[side].includes(id))helper=player(s,id);}
  const distance=type==='long'?22+r(m)*13:type==='box'?11+r(m)*8:type==='good'?5+r(m)*6:type==='oneOnOne'?7+r(m)*7:type==='exceptional'?2+r(m)*3:type==='penalty'?11:type==='setPiece'?19+r(m)*9:8+r(m)*10;
  const angle=type==='cross'?r(m)*.7:type==='exceptional'?r(m)*.15:r(m)*.85;
  const context={type,distance,angle,...(type==='cross'?{delivery:helper.crossing*.5+helper.technique*.3+helper.passing*.2}:{}),finishing:shooter.finishing*.6+shooter.composure*.4,pressure:type==='oneOnOne'?clamp(.1+((d.sweep??1)-1)*.4,.05,.3):type==='exceptional'?.05:clamp(.25+(d.organization-a.creation)/150+r(m)*.35,.1,.95),source:record.source,lane:record.lane};
  const xg=shotXG(context);m.stats[`${context.lane||'central'}Chances`][side]++;if(context.source==='counter')m.stats.counterXg[side]+=xg;if(context.source==='high-turnover')m.stats.highTurnoverXg[side]+=xg;if(xg>=.3)m.stats.bigChances[side]++;
  const fit=.76+(m.fitness[shooter.id]??100)*.0024;
  const finishing=type==='cross'?shooter.heading*.45+shooter.strength*.2+(shooter.jumping??shooter.aerial)*.15+shooter.composure*.2:shooter.finishing*.6+shooter.composure*.3+shooter.technique*.1;
  const conversion=clamp(xg*(.76+finishing/265)*fit*(1+(65-d.goalkeeping)/245),.005,.91);
  const onTargetChance=clamp(Math.max(conversion,.29+xg*.53+(finishing-65)/420),.2,.95);
  const roll=r(m),goal=roll<conversion,onTarget=roll<onTargetChance,outcome=goal?'goal':onTarget?'saved':r(m)<.3?'blocked':'wide';
  m.shots[side]++;m.playerShots[shooter.id]=(m.playerShots[shooter.id]||0)+1;m.xg[side]+=xg;if(onTarget)m.onTarget[side]++;
  const ps=playerStats(m,shooter.id);ps.shots++;ps.xg+=xg;if(onTarget)ps.onTarget++;
  const assisted=helper.id!==shooter.id&&!['penalty','setPiece'].includes(type);if(assisted)playerStats(m,helper.id).chancesCreated++;
  if(goal){m.score[side]++;m.goals[shooter.id]=(m.goals[shooter.id]||0)+1;ps.goals++;if(assisted){m.assists[helper.id]=(m.assists[helper.id]||0)+1;playerStats(m,helper.id).assists++;}}
  record.phases.push('shot','outcome');event(m,goal?'goal':'shot',describeShot(shooter.name,context,outcome,assisted?helper.name:null,m.score),{side,playerId:shooter.id,assistId:goal&&assisted?helper.id:null,xg,onTarget,goal,outcome,context});end(goal?'goal':'shot');
 }
 function finishMinute(){
  // Discipline and injuries are events with visible consequences, independent of goal conversion.
  const foulSide=r(m)<.5?0:1,ft=m.tactics[foulSide],fps=active(foulSide).filter(p=>p.position!=='GK');
  const aggression=fps.reduce((sum,p)=>sum+p.aggression,0)/Math.max(1,fps.length);
  if(r(m)<.23*(.75+aggression/150)*(ft.tackling==='Get Stuck In'?1.35:ft.tackling==='Stay On Feet'?.65:1)*(1+pressLevel(ft)*.08)){
   const offender=pick(fps);m.possessions.push({minute:m.minute,side:foulSide,phases:['defensive-challenge'],ending:'foul',source:'challenge'});m.stats.fouls[foulSide]++;event(m,'foul',describeEvent('foul',offender.name,r(m)),{side:foulSide,playerId:offender.id});
   if(r(m)<(.17+(ft.tackling==='Get Stuck In'?.05:0))*(m.cards.yellow[offender.id]?.42:1)){
    const previous=m.cards.yellow[offender.id]||0,straight=r(m)<.013,red=(previous>0||straight)&&m.lineups[foulSide].filter(Boolean).length>7;
    if(!straight){m.cards.yellow[offender.id]=Math.min(2,previous+1);m.stats.yellowCards[foulSide]++;}
    if(red){m.cards.red.push(offender.id);m.stats.redCards[foulSide]++;m.lineups[foulSide][m.lineups[foulSide].indexOf(offender.id)]=null;event(m,'card',`${offender.name} is sent off${straight?' for a dangerous challenge':' after a second yellow card'}.`,{side:foulSide,playerId:offender.id,card:'red',secondYellow:!straight});const replacement=m.lineups[foulSide].find(Boolean);if(m.captains[foulSide]===offender.id)m.captains[foulSide]=replacement;if(m.setPieces[foulSide]===offender.id)m.setPieces[foulSide]=replacement;for(const key of Object.keys(m.takers[foulSide]))if(m.takers[foulSide][key]===offender.id)m.takers[foulSide][key]=replacement;}
    else event(m,'card',`${offender.name} receives a yellow card for the challenge.`,{side:foulSide,playerId:offender.id,card:'yellow'});
   }
   if(r(m)<.045){side=1-foulSide;a=strength[side];d=strength[1-side];record.source='set-piece';record.lane='central';record.ending=null;record.phases=['set-piece'];takeShot(r(m)<.12?'penalty':'setPiece',select(side,'creator'));}
  }
  const avgFitness=m.lineups.flat().filter(Boolean).reduce((n,id)=>n+m.fitness[id],0)/m.lineups.flat().filter(Boolean).length;
  if(r(m)<.0055+Math.max(0,65-avgFitness)*.00035){const injurySide=r(m)<.5?0:1,candidates=active(injurySide).filter(p=>!m.knocks.includes(p.id));if(candidates.length){const weights=candidates.filter(p=>m.fitness[p.id]<60),p=pick(weights.length?weights:candidates);m.knocks.push(p.id);m.injuries.push({id:p.id,weeks:1+Math.floor(r(m)*4)});event(m,'injury',`${p.name} picks up a knock and is struggling. Consider a substitution.`,{side:injurySide,playerId:p.id});}}
  updateRatings(m);
 }
}
