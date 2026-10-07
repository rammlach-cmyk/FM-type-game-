// Compile-time checks protect module boundaries without adding a browser runtime or bundler.
import type {Career, Match, MatchAdapter, PlayerMatchStats, ShotContext, Tactics} from './types.js';
import {advancePossessionMinute, shotXG} from './match.js';
import {INSTRUCTION_DEFAULTS} from './tactical-settings.js';
import {emptyStats, playerStats} from './statistics.js';
import {calculateStrengths} from './tactics.js';
export const defaultInstructions: Omit<Tactics,'formation'> = INSTRUCTION_DEFAULTS;
export const possessionStep:(career:Career,match:Match,adapter:MatchAdapter)=>void=advancePossessionMinute;
export const expectedGoals:(context:ShotContext)=>number=shotXG;
export const statisticsFactory:()=>Record<string,number[]>=emptyStats;
export const performanceFor:(match:Match,id:string)=>PlayerMatchStats=playerStats;
export const strengthsFor:(career:Career,match:Match,side:number)=>Record<string,number>=calculateStrengths;
