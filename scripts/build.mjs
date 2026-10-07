import {readFile,mkdir,cp,writeFile} from 'node:fs/promises';
import {validateDatabase,parsePlayerJSON} from '../src/database.js';
const read=async name=>JSON.parse(await readFile(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const [leagues,clubs,playersFile]=await Promise.all(['leagues','clubs','players'].map(read));
const errors=validateDatabase({leagues,clubs,players:parsePlayerJSON(JSON.stringify(playersFile))});
if(errors.length){console.error('Database validation failed:\n'+errors.slice(0,30).join('\n'));process.exit(1);}
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const path of ['index.html','src','data','assets'])await cp(new URL(path,root),new URL(path,dist),{recursive:true});
await writeFile(new URL('.nojekyll',dist),'');
console.log(`Built static website in dist/ (${clubs.length} clubs, ${(Array.isArray(playersFile)?playersFile:playersFile.players).length} players).`);
