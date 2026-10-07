// Management difficulty changes policies, never player attributes or chance conversion.
export const DIFFICULTIES={
  Easy:{description:'Forgiving board targets, flexible transfer talks, and opponents that adapt occasionally. Your assistant offers frequent guidance.',boardOffset:2,boardBase:80,boardSlope:4,feeFactor:.9,wageFactor:1.05,lowerReputationWage:1.15,adaptEvery:25,adaptChance:.25,subFrom:72,subEvery:15,subFitness:70},
  Medium:{description:'Balanced board targets and negotiations. Competent opponents respond to the score and fatigue. Your assistant highlights important issues.',boardOffset:0,boardBase:75,boardSlope:4,feeFactor:1,wageFactor:1.1,lowerReputationWage:1.25,adaptEvery:15,adaptChance:.65,subFrom:58,subEvery:10,subFitness:80},
  Hard:{description:'Tighter board targets and tougher talks. Opponents react to your shape, match statistics, and tired players. Ask your assistant whenever you need help.',boardOffset:-2,boardBase:68,boardSlope:6,feeFactor:1.1,wageFactor:1.18,lowerReputationWage:1.35,adaptEvery:8,adaptChance:.95,subFrom:50,subEvery:5,subFitness:85}
};
export const difficultySettings=s=>DIFFICULTIES[s.difficulty||'Medium'];
export function boardTarget(s,c){const base=c.expectation==='Win the title'?1:c.expectation==='Top 3'?3:c.expectation==='Top 6'?6:c.expectation==='Top 8'?8:Math.max(1,s.clubs.length-2);return Math.max(1,Math.min(s.clubs.length,base+difficultySettings(s).boardOffset));}
export function boardGoal(s,c){const target=boardTarget(s,c);return target===1?'Win the title':`Finish in the top ${target}`;}
