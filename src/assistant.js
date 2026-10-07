import {opponentPreview,extraMatchAdvice,postMatchReport,roleSuitability} from './assistant-analysis.js';
import {POSITION_SLOTS,positionFit} from './tactics.js';
import {rolesFor,roleDefinition} from './roles.js';
// Rule-based, read-only recommendations. No external service, RNG, hidden potential, or purchases.
import * as E from './engine.js';
import {GROUPS} from './database.js';
import {TACTICAL_STYLES,styleName} from './styles.js';
const mean=(ps,key)=>ps.length?ps.reduce((n,p)=>n+p[key],0)/ps.length:50;
const recentForm=p=>p.form?.length?p.form.reduce((n,v)=>n+v,0)/p.form.length:6.5;
const matchContext=s=>({clubId:s.userClubId,season:s.season,round:s.round,fixtureId:s.activeMatch?.fixtureId||null,minute:s.activeMatch?.minute??null,formation:s.activeMatch?s.activeMatch.tactics[s.activeMatch.teams.indexOf(s.userClubId)].formation:E.club(s,s.userClubId).tactics.formation});
export function suggestSelection(s){
  const c=E.club(s,s.userClubId),available=E.squad(s,c.id).filter(p=>!p.injury&&!p.suspension),used=new Set(),slots=E.FORMATIONS[c.tactics.formation];
  const score=(p,pos,slot)=>E.ability(p)*(.55+.45*p.fitness/100)*(1+(recentForm(p)-6.5)*.045)*positionFit(p,slot??p.primaryPosition)*(.92+p.morale*.001)*(.96+roleSuitability(p,slot??p.primaryPosition)/1600);
  const lineup=slots.map((pos,index)=>{const p=available.filter(p=>!used.has(p.id)&&(pos!=='GK'||p.position==='GK')).sort((a,b)=>score(b,pos,POSITION_SLOTS[c.tactics.formation][index])-score(a,pos,POSITION_SLOTS[c.tactics.formation][index]))[0];if(p)used.add(p.id);return p?.id||null;});
  const rest=available.filter(p=>!used.has(p.id)).sort((a,b)=>score(b,b.position)-score(a,a.position));
  const keeper=rest.find(p=>p.position==='GK'),bench=keeper?[keeper.id]:[];
  for(const p of rest)if(bench.length<7&&!bench.includes(p.id))bench.push(p.id);
  const starters=lineup.filter(Boolean).map(id=>E.player(s,id));
  const captain=starters.find(p=>p.id===c.captain)?.id||[...starters].sort((a,b)=>b.teamwork+b.decisions+b.morale-a.teamwork-a.decisions-a.morale)[0]?.id;
  const setPiece=starters.find(p=>p.id===c.setPiece)?.id||[...starters].sort((a,b)=>b.passing+b.technique+b.finishing-a.passing-a.technique-a.finishing)[0]?.id;
  return {lineup,bench,captain,setPiece};
}
export function suitableStyle(players){
  const fit=players.filter(p=>!p.injury&&!p.suspension),def=fit.filter(p=>p.position==='DEF'),fwd=fit.filter(p=>p.position==='FWD'),out=fit.filter(p=>p.position!=='GK');
  const metrics={pace:mean(def,'pace'),frontPace:(mean(fwd,'pace')+mean(fwd,'acceleration'))/2,passing:(mean(out,'passing')+mean(out,'vision')+mean(out,'decisions')+mean(out,'firstTouch'))/4,stamina:mean(out,'stamina'),fitness:mean(out,'fitness'),power:(mean(fwd,'strength')+mean(fwd,'heading'))/2,defense:(mean(def,'defending')+mean(def,'positioning')+mean(def,'teamwork'))/3};
  if(metrics.pace<62)return {name:'Counterattack',reason:`Your defenders average ${Math.round(metrics.pace)} pace. A deeper line helps protect them${metrics.frontPace>=70?', while your quick forwards offer an outlet':''}.`,metrics};
  if(metrics.passing>=74)return {name:'Possession',reason:`Your squad averages ${Math.round(metrics.passing)} across passing, vision, decisions, and first touch. Patient short passing gives those strengths room to work.`,metrics};
  if(metrics.power>=73&&metrics.power>metrics.passing+4)return {name:'Direct Play',reason:`Your forwards average ${Math.round(metrics.power)} for heading and strength. Direct passes and second balls suit them.`,metrics};
  if(metrics.stamina>=75&&metrics.fitness>=86&&metrics.pace>=70)return {name:'High Press',reason:`Your outfield players have ${Math.round(metrics.stamina)} average stamina and ${Math.round(metrics.fitness)}% fitness, with pace behind them. They can support a higher press.`,metrics};
  if(metrics.frontPace>=73)return {name:'Counterattack',reason:`Your forwards average ${Math.round(metrics.frontPace)} for pace and acceleration. Quick forward transitions can use that speed.`,metrics};
  if(metrics.defense>=68&&metrics.passing<58)return {name:'Defensive',reason:`Your defenders' positioning, teamwork, and defending (${Math.round(metrics.defense)} average) are a better foundation than risky passing.`,metrics};
  return {name:'Balanced',reason:'Your squad has a mixed skill set. A moderate line and press avoid depending on one specialist strength.',metrics};
}
export function assistantAdvice(s){
  const c=E.club(s,s.userClubId),roster=E.squad(s,c.id),m=s.activeMatch,side=m?.teams.indexOf(c.id),context=matchContext(s),advice=[];
  const add=(id,name,reason,tradeoff,action=null,important=false)=>advice.push({id,title:name,reason,tradeoff,action,important,context});
  const fitRoster=roster.filter(p=>!p.injury&&!p.suspension),injured=roster.filter(p=>p.injury),tired=fitRoster.filter(p=>(m?.fitness[p.id]??p.fitness)<70);
  if(injured.length)add('injuries','Protect your available players',`${injured.map(p=>`${p.name} (${p.injury} weeks)`).join(', ')} cannot play. Keep reserves for their positions.`,'Avoid selling cover until your injured players return.',null,true);
  if(tired.length)add('fatigue','Recovery matters',`${tired.map(p=>`${p.name}: ${Math.round(m?.fitness[p.id]??p.fitness)}% fitness`).join(', ')}. Rest or rotate them when possible.`,'Rest improves fitness but gives up a week of attribute development.',null,true);
  if(!m){
    const selection=suggestSelection(s),valid=!selection.lineup.includes(null);
    if(valid){const different=JSON.stringify(c.lineup)!==JSON.stringify(selection.lineup)||JSON.stringify(c.bench)!==JSON.stringify(selection.bench);
      add('selection',different?'A fresher starting XI':'Your XI is ready', 'This selection balances actual ability, natural/secondary position, current fitness, and the last five recorded match performances. The bench includes a keeper when available.', 'Rotation may leave a stronger but tired player out. Changing starters does not change your formation or roles.', different?{type:'lineup',...selection}:null,different&&c.lineup.some(id=>!id||E.player(s,id).injury||E.player(s,id).fitness<70));
    }else add('selection-missing','Not enough eligible starters','Your available squad cannot fill eleven places with a goalkeeper. Resolve injuries or squad depth before kickoff.','A smaller roster leaves little margin for injuries.',null,true);
    const style=suitableStyle(selection.lineup.filter(Boolean).map(id=>E.player(s,id))),preset=TACTICAL_STYLES[style.name];
    add('style',`${style.name} fits this squad`,style.reason,preset.weaknesses,styleName(c.tactics)!==style.name?{type:'tactics',style:style.name,settings:{...preset.settings}}:null,c.tactics.line==='High'&&style.metrics.pace<62);
    const next=E.nextFixture(s),opponent=next?E.club(s,next.home===c.id?next.away:next.home):null;
    if(opponent){
      const ot=opponent.tactics;
      if(['High','Very High'].includes(ot.line)&&style.metrics.frontPace>=70&&c.tactics.passing!=='More Direct')add('opposition-style','Attack space behind their usual line',`${opponent.name} usually use a ${ot.line.toLowerCase()} line. Your suggested forwards average ${Math.round(style.metrics.frontPace)} pace and acceleration; more direct passing can target that space.`,'Lower completion and less control; their manager may change the observed setup.',{type:'tactics',settings:{passing:'More Direct',win:'Counter'}},true);
      if(['4-2-3-1','3-5-2','4-1-4-1'].includes(ot.formation)&&c.tactics.formation==='4-3-3')add('prematch-shape','Review central numbers',`Their usual ${ot.formation} has more midfield slots than your 4-3-3. A 4-2-3-1 can provide another central support option.`,'Existing starters remain selected; check their new position fit. This sacrifices a central forward.',{type:'tactics',settings:{formation:'4-2-3-1'}},true);
    }
    const creator=selection.lineup.filter(Boolean).map(id=>E.player(s,id)).filter(p=>rolesFor(p).includes('Playmaker')&&p.passing+p.vision+p.decisions>=210&&p.role!=='Playmaker').sort((a,b)=>b.passing+b.vision+b.decisions-a.passing-a.vision-a.decisions)[0];
    if(creator)add('prematch-role',`Use ${creator.name} as a passing outlet`,`${creator.name} has passing ${creator.passing}, vision ${creator.vision}, and decisions ${creator.decisions}. A supporting playmaker role can connect your midfield.`,'More progressive passes bring more turnover risk; protect this player with supporting teammates.',{type:'roles',playerId:creator.id,role:'Playmaker',duty:'Support'},false);
    const slots=E.FORMATIONS[c.tactics.formation],needs=Object.keys(E.ROLES).map(pos=>{const ps=fitRoster.filter(p=>p.position===pos).sort((a,b)=>E.ability(b)-E.ability(a)),needed=slots.filter(x=>x===pos).length;return {pos,available:ps.length,needed,rating:ps.length?ps.slice(0,Math.max(1,needed)).reduce((n,p)=>n+E.ability(p),0)/Math.min(ps.length,Math.max(1,needed)):0};}).sort((a,b)=>(a.available>=a.needed)-(b.available>=b.needed)||a.rating-b.rating);
    const weakest=needs[0];add('depth',`Review your ${weakest.pos} cover`,`${weakest.available} available ${weakest.pos} players for ${weakest.needed} starting slots; their likely starters average ${Math.round(weakest.rating)} calculated ability.`,'A depth signing is less urgent than a missing starter. Keep enough cash for wages.',null,weakest.available<weakest.needed||weakest.rating<58);
    const r=s.league.transferRules,targets=s.players.filter(p=>p.clubId!==c.id&&p.position===weakest.pos&&!p.injury).filter(p=>{const seller=E.squad(s,p.clubId);return seller.length>r.minSquad&&seller.filter(x=>x.position===p.position).length>(p.position==='GK'?r.minKeepers:r.minOutfieldPerGroup)&&E.marketPrice(s,p)+E.negotiationWage(s,p)*r.wageReserveWeeks<=c.balance;}).map(p=>({p,known:s.scouted.includes(p.id),estimate:s.scouted.includes(p.id)?Math.round(E.ability(p)):Math.floor(E.ability(p)/10)*10})).sort((a,b)=>b.estimate-a.estimate||E.marketPrice(s,a.p)-E.marketPrice(s,b.p)).slice(0,3);
    if(targets.length&&roster.length<r.maxSquad)add('targets',r.window==='preseason'&&s.round>0?'Targets for the next window':'Targets to investigate',(r.window==='preseason'&&s.round>0?'The transfer window is closed; scout ahead. ':'')+targets.map(({p,known,estimate})=>`${p.name} (${E.club(s,p.clubId).name}, ${p.primaryPosition}, ${known?`ability ${estimate}`:`estimated ${estimate}–${Math.min(99,estimate+9)}`}): asking ${formatCash(E.marketPrice(s,p))}, suggested wage ${formatCash(E.negotiationWage(s,p))}/week`).join(' · '),'These fit your fee-plus-wage-reserve budget, not a guarantee of agreement. Unscouted estimates stay broad; scouting is an extra cost. Scout manually for an exact report. No money is spent by this advice.');
    else add('no-targets','Keep your budget in view','No available target for the weakest group fits the current fee and wage-reserve rules, or your squad is at its size limit.','Training, rotation, or a manual sale may be better than forcing a transfer.');
  }else if(!m.done){
    const ids=m.lineups[side].filter(Boolean),current=ids.map(id=>E.player(s,id)),chasing=m.score[side]<m.score[1-side]&&m.minute>=65;
    const candidateScore=id=>{const p=E.player(s,id),stats=m.playerStats?.[id],booked=m.cards.yellow[id]>0;return (m.knocks.includes(id)?150:0)+Math.max(0,75-m.fitness[id])*2+(booked&&['High','Very High'].includes(m.tactics[side].pressing)?28:0)+(m.minute>=55&&stats?.rating<6?35:0)+(chasing&&p.position==='FWD'?18:0);};
    const out=ids.slice(1).filter(id=>candidateScore(id)>=18).sort((a,b)=>candidateScore(b)-candidateScore(a))[0];
    if(out&&m.subs[side]<5){const outgoing=E.player(s,out),slot=POSITION_SLOTS[m.tactics[side].formation][m.lineups[side].indexOf(out)],incoming=m.bench[side].map(id=>E.player(s,id)).filter(p=>!p.injury&&!p.suspension&&(p.position===outgoing.position||positionFit(p,slot)>=.88)).sort((a,b)=>E.ability(b)*(m.fitness[b.id]/100)*positionFit(b,slot)+(chasing?b.pace*.08:0)-E.ability(a)*(m.fitness[a.id]/100)*positionFit(a,slot)-(chasing?a.pace*.08:0))[0];
      const reason=m.knocks.includes(out)?'A knock is reducing effectiveness':m.fitness[out]<70?'Fatigue is reducing their contribution':m.cards.yellow[out]?'A booking makes intense pressure risky':m.playerStats[out]?.rating<6?'Their recorded performance is below 6.0':'Fresh attacking runs may help while chasing the game';
      if(incoming)add('substitution',`Fresh legs for ${outgoing.name}`,`OUT: ${outgoing.name}, ${Math.round(m.fitness[out])}% fitness, rating ${(m.playerStats[out]?.rating??6.5).toFixed(1)}. IN: ${incoming.name}, ${Math.round(m.fitness[incoming.id])}% fitness, ability ${Math.round(E.ability(incoming))}, ${incoming.primaryPosition}. ${reason}. Incoming role: ${incoming.role}, ${incoming.duty}.`, 'Uses one of five substitutions. The outgoing player cannot return.',{type:'substitution',outId:out,inId:incoming.id,side},true);
      else add('no-sub','No natural replacement on the bench',`${outgoing.name} needs support, but the bench has no eligible replacement for ${slot}.`,'Lower pressing can preserve the players you have, at the cost of territory.',null,true);
    }
    const diff=m.score[side]-m.score[1-side],t=m.tactics[side],opp=m.tactics[1-side],pos=E.possession(m)[side],averageFit=ids.slice(1).reduce((n,id)=>n+m.fitness[id],0)/10;
    const defenders=current.filter(p=>p.position==='DEF');
    if(['High','Very High'].includes(t.line)&&(mean(defenders,'pace')<65||opp.passing==='Direct'))add('line','Protect the space behind you',mean(defenders,'pace')<65?`Your selected defenders average ${Math.round(mean(defenders,'pace'))} pace. A deeper line would reduce their exposure.`:'The opponent is using direct passing against your high line. Drop deeper to protect that space.','A deeper line concedes territory and reduces midfield control.',{type:'tactics',settings:{line:'Deep'}},true);
    if(['High','Very High'].includes(t.pressing)&&averageFit<70)add('pressing','Save your remaining energy',`Your outfield XI averages ${Math.round(averageFit)}% fitness. Reduce pressing for the remaining ${90-m.minute} minutes.`,'Less pressing means fewer early regains and more time on the ball for opponents.',{type:'tactics',settings:{pressing:'Standard',tempo:'Normal'}},true);
    if(diff>0&&m.minute>=72&&t.mentality!=='Cautious')add('protect','Protect your lead',`You lead by ${diff} with ${90-m.minute} minutes left. A cautious mentality reduces attacking risk.`,'It invites more pressure and reduces your chance of extending the lead.',{type:'tactics',settings:{mentality:'Cautious'}},true);
    if(diff<0&&m.minute>=60&&t.mentality!=='Attacking')add('chase','Give yourself a chance to respond',`You trail by ${-diff} with ${90-m.minute} minutes left. Attacking mentality commits more players forward.`,'You will leave more room for counters; a comeback is not guaranteed.',{type:'tactics',settings:{mentality:'Attacking',tempo:'Quick'}},true);
    if(m.minute>=25&&pos<42&&mean(current.filter(p=>p.position!=='GK'),'passing')>=65&&t.passing!=='Short'&&m.minute<75)add('control','Find an extra passing option',`Possession is ${pos}% and your team has the passing ability to keep shorter connections. Switch to short passing and a patient tempo.`,'Patient buildup sacrifices quick chances; it is less useful when chasing a late goal.',{type:'tactics',settings:{passing:'Short',tempo:'Patient'}},true);
    if(m.minute>=30&&m.xg[side]<.4&&m.shots[side]<m.shots[1-side]&&t.width!=='Wide')add('chances','Give your attack more space',`${m.shots[side]} shots and ${m.xg[side].toFixed(2)} xG suggest limited chances. A wider shape may create room.`,'Spreading out can weaken central passing support.',{type:'tactics',settings:{width:'Wide'}},true);
    extraMatchAdvice(s,m,side,add);
    const booked=m.cards?.yellow?ids.filter(id=>(m.cards.yellow[id]||0)>0):[];
    if(booked.length>=1&&['High','Very High'].includes(t.pressing))add('discipline','Reduce risky pressure',`${booked.map(id=>E.player(s,id).name).join(', ')} ${booked.length===1?'has':'have'} a yellow card. Your booked players are more cautious; lower the press to reduce further team bookings.`,'You give up some territory.',{type:'tactics',settings:{pressing:'Standard'}},true);
    if(!advice.length)add('steady','Keep a clear head',`At ${m.minute} minutes, the score is ${m.score[side]}–${m.score[1-side]}, possession ${pos}%, and xG ${m.xg[side].toFixed(2)}–${m.xg[1-side].toFixed(2)}. No urgent change stands out.`,'Watch for fatigue and new tactical changes; one statistic alone does not decide a match.');
  }else {const report=postMatchReport(s,m);add('report','Post-match analysis',`${report.worked} ${report.didNotWork} ${report.keyPlayer}`,report.improvement);add('fulltime','Review, then move on',`The match finished ${m.score[0]}–${m.score[1]}. Press Continue to settle your matchweek.`,'Changes now apply only after returning to club management.');}
  const fixture=m?{home:m.teams[0],away:m.teams[1]}:E.nextFixture(s);if(fixture){const opponent=E.club(s,fixture.home===c.id?fixture.away:fixture.home),row=E.standings(s).find(r=>r.id===opponent.id),knownT=m?m.tactics[1-side]:opponent.tactics;
    add('opponent','Opponent preview',opponentPreview(s,opponent,fixture.home===c.id?0:1)+` ${m?'Observed':'Usual'} shape ${knownT.formation}, ${styleName(knownT)} approach, ${knownT.line.toLowerCase()} defensive line.`,'Use observed tactics and recent results as clues, not certainty. No unscouted potential or exact opponent player attributes are revealed.');}
  return advice;
}
const formatCash=n=>`£${Math.round(n).toLocaleString('en-GB')}`;
export function proactiveAdvice(s){if(s.difficulty==='Hard')return [];const advice=assistantAdvice(s);return s.difficulty==='Easy'?advice.slice(0,2):advice.filter(a=>a.important).slice(0,2);}
export function recommendationPlan(s,rec){
  if(!rec.action)throw Error('This is information only; there is nothing to apply.');
  if(JSON.stringify(rec.context)!==JSON.stringify(matchContext(s)))throw Error('The match or formation changed. Ask the assistant again for current advice.');
  const c=E.club(s,s.userClubId),m=s.activeMatch,a=rec.action,changes=[];
  if(a.type==='lineup'){
    if(m)throw Error('Use substitutions during a match.');const candidate={...c,lineup:[...a.lineup],bench:[...a.bench],captain:a.captain,setPiece:a.setPiece};const error=E.validateLineup(s,candidate);if(error)throw Error(error);
    const slots=E.FORMATIONS[c.tactics.formation];a.lineup.forEach((id,i)=>{if(c.lineup[i]!==id)changes.push(`${slots[i]} slot ${i+1}: ${E.player(s,c.lineup[i])?.name||'Empty'} → ${E.player(s,id).name}`);});
    if(JSON.stringify(c.bench)!==JSON.stringify(a.bench))changes.push(`Bench: ${c.bench.map(id=>E.player(s,id).name).join(', ')||'Empty'} → ${a.bench.map(id=>E.player(s,id).name).join(', ')}`);
    if(c.captain!==a.captain)changes.push(`Captain: ${E.player(s,c.captain)?.name||'None'} → ${E.player(s,a.captain).name}`);
    for(const [key,id]of Object.entries(c.takers))if(!a.lineup.includes(id))changes.push(`${key} taker: ${E.player(s,id)?.name||'None'} → ${E.player(s,a.setPiece).name}`);
    if(c.setPiece!==a.setPiece)changes.push(`Set-piece taker: ${E.player(s,c.setPiece)?.name||'None'} → ${E.player(s,a.setPiece).name}`);
  }else if(a.type==='tactics'){
    if(m?.done)throw Error('The match has ended.');const t=m?m.tactics[m.teams.indexOf(c.id)]:c.tactics;
    for(const [key,value]of Object.entries(a.settings)){if(key==='formation'?!E.FORMATIONS[value]:!E.OPTIONS[key]?.includes(value))throw Error('Invalid recommended setting.');if(t[key]!==value)changes.push(`${key[0].toUpperCase()+key.slice(1)}: ${t[key]} → ${value}${key==='formation'?' (existing XI retained; review new position fit)':''}`);}
  }else if(a.type==='roles'){
    const p=E.player(s,a.playerId);if(!p||!rolesFor(p).includes(a.role)||!roleDefinition(a.role).duties.includes(a.duty))throw Error('Invalid role recommendation.');
    if(m&&(m.done||!m.lineups[a.side].includes(p.id)))throw Error('Player is no longer active.');
    const role=m?m.roles[p.id]:p.role,duty=m?m.duties[p.id]:p.duty;
    if(role!==a.role)changes.push(`${p.name} role: ${role} → ${a.role}`);if(duty!==a.duty)changes.push(`${p.name} duty: ${duty} → ${a.duty}`);
  }else if(a.type==='substitution'){
    if(!m||m.done||m.subs[a.side]>=5||!m.lineups[a.side].includes(a.outId)||!m.bench[a.side].includes(a.inId)||m.teams[a.side]!==c.id)throw Error('This substitution is no longer available.');
    changes.push(`Player off: ${E.player(s,a.outId).name}; player on: ${E.player(s,a.inId).name}`);
    if(m.captains[a.side]===a.outId)changes.push(`Match captain: ${E.player(s,a.outId).name} → ${E.player(s,a.inId).name}`);
    for(const [key,id]of Object.entries(m.takers[a.side]))if(id===a.outId)changes.push(`${key} taker: ${E.player(s,id).name} → ${E.player(s,a.inId).name}`);
    if(m.setPieces[a.side]===a.outId)changes.push(`Match set-piece taker: ${E.player(s,a.outId).name} → ${E.player(s,a.inId).name}`);
    changes.push(`Substitutions used: ${m.subs[a.side]} → ${m.subs[a.side]+1}`);
  }else throw Error('Unsupported recommendation.');
  if(!changes.length)throw Error('These settings are already in place. Ask for updated advice.');return changes;
}
export function applyRecommendation(s,rec){const changes=recommendationPlan(s,rec),a=rec.action,c=E.club(s,s.userClubId),m=s.activeMatch;
  if(a.type==='lineup'){c.lineup=[...a.lineup];c.bench=[...a.bench];c.captain=a.captain;c.setPiece=a.setPiece;for(const key of Object.keys(c.takers))if(!c.lineup.includes(c.takers[key]))c.takers[key]=c.setPiece;}
  else if(a.type==='tactics'){for(const [key,val]of Object.entries(a.settings)){if(m){const side=m.teams.indexOf(c.id);if(m.tactics[side][key]!==val)E.changeMatchTactic(m,side,key,val);}c.tactics[key]=val;}}
  else if(a.type==='roles'){if(m)E.changeMatchRole(s,m,a.side,a.playerId,a.role,a.duty);else {const p=E.player(s,a.playerId);p.role=a.role;p.duty=a.duty;}}
  else E.substitute(s,m,a.side,a.outId,a.inId);
  s.assistant.appliedCount++;return changes;
}

export function preMatchBriefing(s){const advice=assistantAdvice(s),keys=['opponent','selection','style','opposition-style','prematch-shape','fatigue','injuries','prematch-role','depth'];return keys.map(id=>advice.find(a=>a.id===id)).filter(Boolean).slice(0,5);}
export function liveRecommendations(s){const m=s.activeMatch;if(!m||m.done)return [];return assistantAdvice(s).filter(a=>a.action&&a.important&&!m.assistantLive.ignored.includes(`${Math.floor(m.minute/12)}:${a.id}`)).slice(0,3);}
export function ignoreRecommendation(s,id){const m=s.activeMatch;if(m)m.assistantLive.ignored.push(`${Math.floor(m.minute/12)}:${id}`);}
