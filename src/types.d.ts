/** Stable contracts for the serialized career and possession engine. Runtime stays plain ES modules. */
export type Side = 0 | 1;
export type Duty = 'Defend' | 'Support' | 'Attack';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export interface Player {
 id:string; name:string; clubId:string; primaryPosition:string; secondaryPositions:string[]; position:string;
 age:number; nationality:string; preferredFoot:string; overall:number; potential:number;
 passing:number; vision:number; decisions:number; firstTouch:number; dribbling:number; agility:number;
 pace:number; acceleration:number; finishing:number; composure:number; technique:number; crossing:number;
 tackling:number; positioning:number; marking:number; defending:number; strength:number; heading:number;
 jumping:number; stamina:number; workRate:number; teamwork:number; aggression:number; aerial:number;
 keeping:number; reflexes:number; handling:number; kicking:number; goalkeeperPositioning:number; distribution:number;
 fitness:number; morale:number; injury:number; suspension:number; wage:number; contract:number;
 role:string; duty:Duty; familiarity:Record<string,number>; form:number[];
 goals:number; assists:number; appearances:number; minutes:number; shots:number; yellowCards:number; redCards:number;
 development:number;
}
export interface Tactics {
 formation:string; mentality:string; width:string; passing:string; tempo:string; freedom:string;
 finalThird:string; buildup:string; overlapLeft:string; overlapRight:string; loss:string; win:string;
 distribution:string; line:string; pressing:string; defensiveWidth:string; tackling:string; offsideTrap:string;
}
export interface SetPieceTakers {penalty:string; freeKick:string; leftCorner:string; rightCorner:string; [key:string]:string}
export interface Club {
 id:string; name:string; short:string; color:string; balance:number; tactics:Tactics;
 lineup:(string|null)[]; bench:string[]; captain:string; setPiece:string; takers:SetPieceTakers;
 familiarity:{formations:Record<string,number>; instructions:Record<string,number>;styles:Record<string,number>};
}
export interface PlayerMatchStats {passes:number; completedPasses:number; tackles:number; interceptions:number; chancesCreated:number; shots:number; onTarget:number; xg:number; goals:number; assists:number; rating:number; [key:string]:number}
export interface ShotContext {type:string; distance:number; angle:number; pressure:number; source:string; lane:string;finishing?:number;delivery?:number}
export interface MatchEvent {minute:number; type:string; text:string; side?:number; playerId?:string; assistId?:string|null; xg?:number; goal?:boolean; onTarget?:boolean; passes?:number; completedPasses?:number; card?:string; context?:ShotContext; [key:string]:unknown}
export interface Possession {minute:number; side:number; phases:string[]; ending:string|null; source:string; lane?:string}
export interface Match {
 fixtureId:string; teams:string[]; rng:number; aiRng:number; aiChanges:number[];
 minute:number; phase:'first'|'halftime'|'second'|'fulltime'; done:boolean;
 score:number[]; shots:number[]; onTarget:number[]; xg:number[]; possessionTicks:number[];
 lineups:(string|null)[][]; bench:string[][]; used:string[][]; tactics:Tactics[];
 roles:Record<string,string>; duties:Record<string,Duty>; takers:SetPieceTakers[];
 captains:string[]; setPieces:string[]; disruption:number[]; subs:number[];
 fitness:Record<string,number>; minutes:Record<string,number>; goals:Record<string,number>; assists:Record<string,number>; playerShots:Record<string,number>;
 cards:{yellow:Record<string,number>;red:string[]}; knocks:string[]; injuries:{id:string;weeks:number}[];
 stats:Record<string,number[]>; playerStats:Record<string,PlayerMatchStats>; statsSinceMinute:number;
 possessions:Possession[]; events:MatchEvent[]; lastEvent:MatchEvent|null;
 assistantLive:{lastPromptMinute:number; ignored:string[]};
}
export interface AssistantProfile {name:string;nationality:string;tacticalKnowledge:number;playerEvaluation:number;motivating:number;judgingAbility:number}
export interface Career {version:number;seed:number;rng:number;difficulty:Difficulty;userClubId:string;season:number;round:number;players:Player[];clubs:Club[];activeMatch:Match|null;assistant:{profile:AssistantProfile;appliedCount:number;lastAsked:unknown}; [key:string]:unknown}
export interface MatchAdapter {random:(match:Match)=>number;event:(match:Match,type:string,text:string,extra?:Record<string,unknown>)=>void;player:(state:Career,id:string)=>Player;club:(state:Career,id:string)=>Club}
export interface Recommendation {id:string;title:string;reason:string;tradeoff:string;important:boolean;context:unknown;action:null|{type:'tactics';settings:Partial<Tactics>}|{type:'roles';side:number;playerId:string;role:string;duty:Duty}|{type:'substitution';side:number;outId:string;inId:string}|{type:'lineup';lineup:string[];bench:string[];captain:string;setPiece:string}}
