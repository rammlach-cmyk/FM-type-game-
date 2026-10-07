// Position-specific behavior. Multipliers represent movement and responsibility, not rating boosts.
const role=(description,behavior={},duties=['Defend','Support','Attack'])=>({description,behavior,duties});
export const PLAYER_ROLES={
 'Goalkeeper':role('Protects the goal and distributes conservatively.',{distribution:.94},['Defend']),
 'Sweeper Keeper':role('Offers a passing outlet and covers space behind the line.',{distribution:1.13,sweep:1.2,workload:1.1},['Defend','Support']),
 'Central Defender':role('Holds position and contests tackles and aerial balls.',{organization:1.06},['Defend']),
 'Ball Playing Defender':role('Progresses passes from defense with more risk.',{buildup:1.15,risk:1.12,organization:.97},['Defend','Support']),
 'No-Nonsense Defender':role('Clears danger early rather than building patiently.',{buildup:.85,aerial:1.08,organization:1.08},['Defend']),
 'Full Back':role('Provides wide support with measured forward runs.',{width:1.08,organization:1.03},['Defend','Support','Attack']),
 'Wing Back':role('Overlaps and crosses, leaving more space in transition.',{width:1.23,cross:1.2,transitionDefense:.88,workload:1.18},['Defend','Support','Attack']),
 'Inverted Full Back':role('Moves inside to support central buildup.',{buildup:1.14,midfield:1.12,width:.8},['Defend','Support']),
 'Defensive Midfielder':role('Screens the defense and recycles possession.',{organization:1.1,transitionDefense:1.1},['Defend','Support']),
 'Anchor':role('Stays behind the ball to protect central space.',{organization:1.2,transitionDefense:1.2,creation:.85,press:.85},['Defend']),
 'Deep Lying Playmaker':role('Sets passing patterns from deeper positions.',{buildup:1.15,creation:1.1,risk:1.08},['Defend','Support']),
 'Ball Winning Midfielder':role('Hunts possession, sometimes leaving the midfield shape.',{press:1.2,workload:1.17,organization:.92},['Defend','Support']),
 'Central Midfielder':role('Connects the defense and attack.',{midfield:1.06}),
 'Box-to-Box Midfielder':role('Runs between both boxes and joins late attacks.',{creation:1.08,transitionAttack:1.13,workload:1.22,organization:.94},['Support']),
 'Playmaker':role('Seeks progressive passes and gives teammates support.',{creation:1.16,buildup:1.12,risk:1.1},['Support','Attack']),
 'Mezzala':role('Moves into wide half spaces to combine and create.',{width:1.13,creation:1.13,organization:.9},['Support','Attack']),
 'Attacking Midfielder':role('Finds space between the lines.',{creation:1.1,finishing:1.06},['Support','Attack']),
 'Advanced Playmaker':role('Creates chances between midfield and attack.',{creation:1.22,buildup:1.08,finishing:.92,risk:1.13},['Support','Attack']),
 'Shadow Striker':role('Makes aggressive late runs into the box.',{finishing:1.2,transitionAttack:1.16,midfield:.9,workload:1.13},['Attack']),
 'Winger':role('Stays wide and supplies crosses.',{width:1.25,cross:1.22,finishing:.9},['Support','Attack']),
 'Inverted Winger':role('Cuts inside to combine with central attackers.',{creation:1.16,width:.93,finishing:1.06},['Support','Attack']),
 'Inside Forward':role('Attacks the box from a wide starting point.',{finishing:1.2,creation:1.06,width:.85,transitionDefense:.9},['Support','Attack']),
 'Advanced Forward':role('Runs behind defenders and leads the attack.',{finishing:1.12,transitionAttack:1.2},['Attack']),
 'Poacher':role('Stays close to goal and contributes less to buildup.',{finishing:1.25,buildup:.76,press:.8,creation:.86},['Attack']),
 'Target Forward':role('Wins aerial balls and brings teammates into play.',{aerial:1.25,buildup:1.08,transitionAttack:.88},['Support','Attack']),
 'Deep Lying Forward':role('Drops to link play, leaving fewer runs behind.',{buildup:1.18,creation:1.16,finishing:.88},['Support','Attack']),
 'Pressing Forward':role('Closes down defenders and leads pressure.',{press:1.25,workload:1.22,finishing:.95},['Defend','Support','Attack']),
 'False Nine':role('Drops into midfield to pull defenders out of position.',{midfield:1.18,creation:1.18,buildup:1.13,finishing:.8},['Support'])
};
export const POSITION_ROLES={GK:['Goalkeeper','Sweeper Keeper'],CB:['Central Defender','Ball Playing Defender','No-Nonsense Defender'],LB:['Full Back','Wing Back','Inverted Full Back'],RB:['Full Back','Wing Back','Inverted Full Back'],DM:['Defensive Midfielder','Anchor','Deep Lying Playmaker','Ball Winning Midfielder'],CM:['Central Midfielder','Box-to-Box Midfielder','Playmaker','Ball Winning Midfielder','Mezzala'],AM:['Attacking Midfielder','Advanced Playmaker','Shadow Striker'],LW:['Winger','Inverted Winger','Inside Forward'],RW:['Winger','Inverted Winger','Inside Forward'],ST:['Advanced Forward','Poacher','Target Forward','Deep Lying Forward','Pressing Forward','False Nine']};
export const LEGACY_ROLES={Keeper:'Goalkeeper',Sweeper:'Sweeper Keeper',Defender:'Central Defender','Ball player':'Ball Playing Defender','Wing back':'Wing Back',Runner:'Box-to-Box Midfielder',Creator:'Deep Lying Forward',Target:'Target Forward'};
export function roleDefinition(name){return PLAYER_ROLES[LEGACY_ROLES[name]||name]||PLAYER_ROLES['Central Midfielder'];}
export function rolesFor(p){return POSITION_ROLES[p.primaryPosition]||['Central Midfielder'];}
export function defaultRole(p){return rolesFor(p)[0];}
export function roleBehavior(name,duty='Support'){
 const b={buildup:1,creation:1,finishing:1,midfield:1,width:1,cross:1,press:1,transitionAttack:1,transitionDefense:1,aerial:1,organization:1,distribution:1,sweep:1,risk:1,workload:1,...roleDefinition(name).behavior};
 if(duty==='Attack'){b.finishing*=1.08;b.creation*=1.05;b.transitionDefense*=.9;b.organization*=.94;b.workload*=1.08;}
 if(duty==='Defend'){b.organization*=1.08;b.transitionDefense*=1.08;b.finishing*=.88;b.creation*=.94;}
 return b;
}
