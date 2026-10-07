import {passCompletion} from './statistics.js';
import {positionFit} from './tactics.js';
import {rolesFor} from './roles.js';
export function opponentPreview(s,opponent,side){
 const fixtures=s.fixtures.flat().filter(f=>f.result&&(f.home===opponent.id||f.away===opponent.id)).slice(-5);
 const stats=fixtures.map(f=>({f,side:f.home===opponent.id?0:1}));
 const gf=stats.reduce((n,{f,side})=>n+f.result.score[side],0),ga=stats.reduce((n,{f,side})=>n+f.result.score[1-side],0);
 const possession=stats.filter(({f})=>Array.isArray(f.result.possession));
 const observed=stats.filter(({f})=>f.result.stats&&f.result.statsSinceMinute===0);
 const cross=observed.reduce((n,{f,side})=>n+f.result.stats.crosses[side],0),counter=observed.reduce((n,{f,side})=>n+f.result.stats.counterAttacks[side],0);
 const ps=s.players.filter(p=>p.clubId===opponent.id),performers=ps.filter(p=>p.appearances>0&&p.form?.length).sort((a,b)=>b.form.reduce((n,x)=>n+x,0)/b.form.length-a.form.reduce((n,x)=>n+x,0)/a.form.length);
 const rated=ps.filter(p=>s.scouted.includes(p.id)).sort((a,b)=>b.overall-a.overall);
 let text=`${opponent.name}: ${side===0?'you are at home':'you are away'}. `;
 text+=fixtures.length?`Last ${fixtures.length} recorded matches: ${gf} goals scored, ${ga} conceded. `:'No recorded match sample yet. ';
 if(possession.length)text+=`Average possession ${Math.round(possession.reduce((n,{f,side})=>n+f.result.possession[side],0)/possession.length)}% (${possession.length} matches). `;
 if(observed.length)text+=`Observed attacks: ${cross} crosses and ${counter} counters across ${observed.length} complete event reports. `;
 if(observed.length){const concededLeft=observed.reduce((n,{f,side})=>n+(f.result.stats.leftChances?.[1-side]||0),0),concededRight=observed.reduce((n,{f,side})=>n+(f.result.stats.rightChances?.[1-side]||0),0),concededCenter=observed.reduce((n,{f,side})=>n+(f.result.stats.centralChances?.[1-side]||0),0),all=concededLeft+concededRight+concededCenter;if(all)text+=`Conceded shot origins: ${Math.round(concededLeft/all*100)}% down the attacking left, ${Math.round(concededRight/all*100)}% right, ${Math.round(concededCenter/all*100)}% central (${all} shots). `;}
 if(performers.length)text+=`Recent standout: ${performers[0].name}, ${performers[0].goals} goals; lowest recorded recent form: ${performers.at(-1).name}. `;
 else if(rated.length)text+=`Scouted strongest rating: ${rated[0].name} (${rated[0].overall}); lowest: ${rated.at(-1).name} (${rated.at(-1).overall}). `;
 else text+='Opponent player strengths are unscouted; scout for exact ratings. ';
 return text;
}
export function extraMatchAdvice(s,m,side,add){
 const t=m.tactics[side],opp=m.tactics[1-side],stats=m.stats; if(!stats||m.minute<24)return;
 const midfield=f=>f==='4-2-3-1'||f==='3-5-2'||f==='4-1-4-1'?5:f==='4-4-2'?4:3;
 if(midfield(opp.formation)>midfield(t.formation)&&m.possessionTicks[side]/Math.max(1,m.minute)<.44&&t.formation!=='4-2-3-1')add('overload','Add central passing support',`Their ${opp.formation} has more midfield slots than your ${t.formation}; possession is ${Math.round(100*m.possessionTicks[side]/m.minute)}%. Try 4-2-3-1 to create another central connection.`,'This reshapes existing players without an automatic substitution; review position fit and roles after changing shape.',{type:'tactics',settings:{formation:'4-2-3-1'}},true);
 if(stats.highTurnovers[1-side]>=3&&t.buildup==='Play Out Of Defense')add('buildup-pressure','Bypass their buildup pressure',`Their press has recorded ${stats.highTurnovers[1-side]} high turnovers. Direct buildup can bypass the first pressure line.`,'Longer passes lose control and depend on aerial support. This affects future possessions.',{type:'tactics',settings:{buildup:'Direct From Defense',distribution:'Long'}},true);
 const flank=stats.leftAttacks[1-side]+stats.rightAttacks[1-side],central=stats.centralAttacks[1-side];
 if(flank>central*2&&flank>=12&&t.defensiveWidth==='Narrow')add('flanks','Protect the wide channels',`The opponent has progressed ${flank} wide attacks versus ${central} centrally. Your narrow defensive shape is leaving the flanks open.`,'A standard defensive width gives up some central compactness.',{type:'tactics',settings:{defensiveWidth:'Standard',overlapLeft:'Off',overlapRight:'Off'}},true);
 const creator=m.lineups[side].filter(Boolean).map(id=>s.players.find(p=>p.id===id)).filter(p=>rolesFor(p).includes('Playmaker')||rolesFor(p).includes('Advanced Playmaker')).sort((a,b)=>b.passing+b.vision+b.decisions-a.passing-a.vision-a.decisions)[0];
 if(creator&&m.shots[side]<4&&m.minute>=35&&!['Playmaker','Advanced Playmaker'].includes(m.roles[creator.id]))add('creative-role',`Give ${creator.name} a creative role`,`${creator.name} has passing ${creator.passing}, vision ${creator.vision}, and decisions ${creator.decisions}. With only ${m.shots[side]} shots, use these attributes to create support.`,'A playmaker takes more passing risks and may offer less defensive coverage.',{type:'roles',side,playerId:creator.id,role:rolesFor(creator).includes('Playmaker')?'Playmaker':'Advanced Playmaker',duty:'Support'},true);
}
export function postMatchReport(s,m){
 if(!m)return null;const side=m.teams.indexOf(s.userClubId),other=1-side,known=m.statsSinceMinute===0,st=m.stats;
 const players=Object.entries(m.playerStats||{}).filter(([id])=>s.players.find(p=>p.id===id)?.clubId===s.userClubId).sort(([,a],[,b])=>b.rating-a.rating),best=players[0];
 const worked=known&&st.highTurnovers[side]>=3?`Your press forced ${st.highTurnovers[side]} high turnovers; chances from those regains generated ${(st.highTurnoverXg?.[side]||0).toFixed(2)} xG.`:m.xg[side]>=m.xg[other]?`Chance creation: ${m.shots[side]} shots produced ${m.xg[side].toFixed(2)} xG against ${m.xg[other].toFixed(2)}.`:`Finishing: ${m.score[side]} goals from ${m.xg[side].toFixed(2)} xG; the opponent created ${m.xg[other].toFixed(2)} xG.`;
 const issue=known&&st.highTurnovers[other]>=3?`Buildup was exposed to ${st.highTurnovers[other]} opposition high turnovers.`:known&&st.leftAttacks[other]+st.rightAttacks[other]>st.centralAttacks[other]*2?'The opponent progressed more often on the flanks than through the center.':m.xg[side]<1?'You generated less than 1.00 xG; review support and attacking roles.':m.xg[other]>1.6?'You conceded more than 1.60 xG; review defensive spacing and transition cover.':'The chance balance shows no single obvious weakness; review individual events before making sweeping changes.';
 const tacticalIssue=known&&st.counterXg?.[other]>.7?`Opponent counterattacks produced ${st.counterXg[other].toFixed(2)} xG against your ${m.tactics[side].line.toLowerCase()} line.`:issue;
 const improve=known&&st.highTurnovers[other]>=3?'Next match, consider a more direct buildup or an extra passing outlet.':m.xg[side]<1?'Next match, consider a supporting playmaker or more width; either gives up some defensive security.':m.xg[other]>1.6?'Next match, consider a supporting duty or regrouping to protect transition space.':'Keep the shape as a reference and compare the next opponent before changing it.';
 return {score:`${m.score[side]}–${m.score[other]}`,worked,didNotWork:issue,tacticalIssue,keyPlayer:best?`${s.players.find(p=>p.id===best[0])?.name||best[0]}: ${best[1].rating.toFixed(1)} match rating, ${best[1].goals} goals, ${best[1].chancesCreated} chances created.`:'Detailed player report unavailable for this older match.',improvement:improve,passing:known?`${passCompletion(m,side)}% pass completion.`:'New event statistics cover only the remaining minutes after migration.'};
}
export function roleSuitability(p,slot){return positionFit(p,slot)*(p.passing+p.decisions+p.teamwork)/3;}
