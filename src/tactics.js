import {styleName} from './styles.js';
import {GROUPS} from './database.js';
import {roleBehavior} from './roles.js';
import {directLevel,lineLevel,pressLevel,tempoLevel} from './tactical-settings.js';
export const POSITION_SLOTS={
 '4-3-3':['GK','LB','CB','CB','RB','DM','CM','CM','LW','ST','RW'],
 '4-4-2':['GK','LB','CB','CB','RB','LW','CM','CM','RW','ST','ST'],
 '3-5-2':['GK','CB','CB','CB','LB','CM','DM','CM','RB','ST','ST'],
 '4-2-3-1':['GK','LB','CB','CB','RB','DM','DM','LW','AM','RW','ST'],
 '4-1-4-1':['GK','LB','CB','CB','RB','DM','LW','CM','CM','RW','ST'],
 '5-3-2':['GK','LB','CB','CB','CB','RB','DM','CM','CM','ST','ST'],
 '4-3-1-2':['GK','LB','CB','CB','RB','CM','DM','CM','AM','ST','ST']
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function positionFit(p,pos){return p.primaryPosition===pos?1:p.secondaryPositions?.includes(pos)?.96:GROUPS[p.primaryPosition]===GROUPS[pos]?.88:['LW','RW'].includes(pos)&&p.position==='MID'?.83:['LB','RB'].includes(pos)&&p.position==='MID'?.79:p.secondaryPositions?.some(x=>GROUPS[x]===GROUPS[pos])?.83:.67;}
export function contribution(p,pos,m){const fit=m.fitness[p.id]??p.fitness;const form=p.form?.length?p.form.reduce((a,b)=>a+b,0)/p.form.length:6.5;return (.66+fit*.0034)*(.9+p.morale*.0013)*clamp(1+(form-6.5)*.018,.94,1.06)*positionFit(p,pos)*(m.knocks.includes(p.id)?.55:1)*(m.cards.yellow[p.id]?.97:1);}
const weighted=(p,fields)=>fields.reduce((v,[k,w])=>v+(p[k]??(k==='workRate'?p.teamwork:k==='jumping'?p.aerial:k==='goalkeeperPositioning'?p.positioning:p.kicking))*w,0);
export function calculateStrengths(s,m,side){
 const t=m.tactics[side],slots=POSITION_SLOTS[t.formation],players=m.lineups[side].map(id=>s.players.find(p=>p.id===id)),total={},weights={};
 const add=(key,value,w)=>{total[key]=(total[key]||0)+value*w;weights[key]=(weights[key]||0)+w;};
 players.forEach((p,i)=>{if(!p)return;const pos=slots[i],g=GROUPS[pos],b=roleBehavior(m.roles?.[p.id]??p.role,m.duties?.[p.id]??p.duty),f=contribution(p,pos,m),w=g==='DEF'?1.15:g==='MID'?1.4:1;
 const pass=weighted(p,[['passing',.35],['vision',.2],['decisions',.25],['firstTouch',.2]]),def=weighted(p,[['tackling',.23],['positioning',.25],['decisions',.18],['marking',.14],['defending',.2]]),speed=(p.pace*.55+p.acceleration*.45),power=(p.heading*.4+p.strength*.35+(p.jumping??p.aerial)*.25);
 if(g==='GK'){add('goalkeeping',weighted(p,[['keeping',.3],['reflexes',.3],['handling',.15],['goalkeeperPositioning',.25]])*f,1);add('sweep',b.sweep*f,1);add('distribution',weighted(p,[['distribution',.5],['passing',.2],['decisions',.3]])*f*b.distribution,1);return;}
 add('risk',b.risk,w);add('buildup',pass*f*b.buildup,g==='DEF'?1.3:g==='MID'?1:.4);add('creation',weighted(p,[['passing',.18],['vision',.23],['decisions',.18],['dribbling',.13],['agility',.08],['acceleration',.07],['technique',.13]])*f*b.creation,g==='FWD'?1.3:g==='MID'?1:.25);
 add('finishing',(p.finishing*.58+p.composure*.3+p.technique*.12)*f*b.finishing,g==='FWD'?1.6:g==='MID'?.55:.12);
 add('midfield',pass*f*b.midfield,w);add('width',(p.crossing*.45+p.dribbling*.2+p.pace*.15+p.technique*.2)*f*b.width*b.cross,['LB','RB','LW','RW'].includes(pos)?1.7:.2);
 add('pressing',((p.workRate??p.teamwork)*.3+p.stamina*.25+p.tackling*.15+p.decisions*.2+p.acceleration*.1)*f*b.press,g==='DEF'?.7:1.2);
 add('transitionAttack',speed*f*b.transitionAttack,g==='FWD'?1.6:g==='MID'?1:.2);add('transitionDefense',(speed*.5+def*.5)*f*b.transitionDefense,g==='DEF'?1.5:g==='MID'?1:.25);
 add('aerial',power*f*b.aerial,g==='FWD'?1.5:g==='DEF'?1:.5);add('organization',def*f*b.organization,g==='DEF'?1.6:g==='MID'?.7:.15);add('setPieces',(p.technique*.4+p.passing*.3+p.finishing*.3)*f,g==='MID'||g==='FWD'?1:.3);
 add('pace',speed*f,1);add('defensePace',speed*f,g==='DEF'?1:0);add('frontPace',speed*f,g==='FWD'?1:0);add('stamina',p.stamina*f,1);
 });
 const r=Object.fromEntries(Object.keys(total).map(k=>[k,total[k]/Math.max(.01,weights[k]) ]));
 for(const k of ['buildup','creation','finishing','midfield','width','pressing','transitionAttack','transitionDefense','aerial','organization','goalkeeping','distribution','setPieces','pace','defensePace','frontPace','stamina'])r[k]??=35;
 const n=players.filter(Boolean).length/11;for(const k of ['buildup','creation','midfield','pressing','organization','transitionDefense'])r[k]*=n;
 const c=s.clubs.find(c=>c.id===m.teams[side]),familiarity=c.familiarity?.formations?.[t.formation]??45;
 const roleFam=players.filter(Boolean).reduce((sum,p)=>sum+(p.familiarity?.[m.roles?.[p.id]??p.role]??45),0)/Math.max(1,players.filter(Boolean).length);
 const known=Object.entries(t).filter(([k])=>k!=='formation').reduce((v,[k,val])=>v+(c.familiarity?.instructions?.[`${k}:${val}`]??45),0)/Math.max(1,Object.keys(t).length-1);
 const styleFamiliarity=c.familiarity?.styles?.[styleName(t)]??45;
 const familiarityFactor=.94+.06*(familiarity+roleFam+known+styleFamiliarity)/400;
 r.organization*=familiarityFactor*(1-(m.disruption?.[side]||0));
 const d=directLevel(t),line=lineLevel(t),press=pressLevel(t),tempo=tempoLevel(t);
 r.midfield*=1-d*.045-tempo*.025+(t.width==='Narrow'?.035:t.width==='Wide'?-.035:0)+line*.035;
 r.buildup*=1+(d<0?.055:0)+(t.buildup==='Play Out Of Defense'?.04:t.buildup==='Direct From Defense'?-.08:0);
 if(t.freedom==='Expressive'){r.creation*=1.05;r.organization*=.97;}if(t.freedom==='Disciplined'){r.organization*=1.035;r.creation*=.97;}
 if(t.mentality==='Attacking'){r.creation*=1.12;r.organization*=.92;r.transitionDefense*=.92;}if(t.mentality==='Cautious'){r.creation*=.86;r.organization*=1.1;r.transitionAttack*=.97;}
 if(t.width==='Wide')r.width*=1.08; if(t.overlapLeft==='On'||t.overlapRight==='On'){r.width*=1.06;r.transitionDefense*=.95;}
 if(t.defensiveWidth==='Narrow')r.organization*=1.035;if(t.tackling==='Stay On Feet')r.organization*=1.015;
 r.pressing*=(.73+press*.21)*(1+line*.04);r.organization*=line<0?1.045:1.01;
 if(side===0){r.creation*=1.035;r.midfield*=1.025;r.organization*=1.015;}
 const captain=players.find(p=>p?.id===m.captains[side]);if(captain)r.organization*=1+(captain.teamwork+captain.decisions+captain.morale-180)/6000;
 // Public aliases retained for AI decisions and older integrations.
 r.attack=r.creation*.55+r.finishing*.45;if(d>0)r.attack*=clamp(.92+r.aerial/700,.96,1.08);
 r.defense=r.organization;r.control=r.midfield;r.gk=r.goalkeeping;
 return r;
}
export function tacticalWorkload(p,t,role,duty){const b=roleBehavior(role??p.role,duty??p.duty);return (p.position==='GK'?.045:.16+(100-p.stamina)*.0016)*(1+pressLevel(t)*.15)*(1+tempoLevel(t)*.09)*(t.loss==='Counter-Press'?1.12:1)*(t.mentality==='Attacking'?1.08:1)*b.workload;}
export function buildFamiliarity(c,players,m,side){c.familiarity??={formations:{},instructions:{}};const t=m.tactics[side];c.familiarity.styles??={};const style=styleName(t);c.familiarity.styles[style]=Math.min(100,(c.familiarity.styles[style]??45)+3);c.familiarity.formations[t.formation]=Math.min(100,(c.familiarity.formations[t.formation]??45)+3);for(const [k,v]of Object.entries(t))if(k!=='formation'){const key=`${k}:${v}`;c.familiarity.instructions[key]=Math.min(100,(c.familiarity.instructions[key]??45)+2);}for(const p of players){if(!(m.minutes[p.id]>0))continue;p.familiarity??={};const role=m.roles[p.id]??p.role;p.familiarity[role]=Math.min(100,(p.familiarity[role]??45)+3);}}
