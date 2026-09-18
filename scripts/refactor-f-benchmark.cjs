const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');
function measure(modulePath){const {start}=require(modulePath),a=start();a.setTime('2026-09-11T12:10:00+09:00');
 a.run("for(const[id]of GAMES)for(let i=0;i<1000;i++)award(id,'benchmark/'+i,{gold:1,xp:2},'측정',true);save();refreshAllGames();state.activeGame='overview';renderAll()");
 a.run(`globalThis.metrics={writes:0,json:0,jsonChars:0,navigation:0,ledgerScans:0};
 const rawStringify=JSON.stringify;JSON.stringify=function(...args){const value=rawStringify(...args);metrics.json++;metrics.jsonChars+=value?.length||0;return value;};
 const rawValues=Object.values;Object.values=function(object){if(GAMES.some(([id])=>state.games[id].ledger===object))metrics.ledgerScans++;return rawValues(object);};
 const rawWrite=localStorage.setItem;localStorage.setItem=function(key,value){if(key==='deckroom-quests')metrics.writes++;return rawWrite(key,value);};
 const rawNav=renderNavigation;renderNavigation=function(...args){metrics.navigation++;return rawNav(...args);};`);
 const scenario=(fn)=>{a.run('for(const key in metrics)metrics[key]=0');const at=performance.now();fn();return {...JSON.parse(a.run('JSON.stringify(metrics)')),milliseconds:Math.round((performance.now()-at)*100)/100};};
 const result={idle60:scenario(()=>{for(let i=0;i<60;i++){a.advance(1000);a.run('refreshAllGames()');}}),overview10:scenario(()=>a.run('for(let i=0;i<10;i++)renderAll()'))};a.run("state.activeGame='mtga';renderAll()");result.rewardAndRender=scenario(()=>a.run("catalogAction('mtga','daily-win','progress',{amount:1});renderAll()"));return result;
}
if(process.argv[2]){console.log(JSON.stringify(measure(path.join(root,process.argv[2]==='before'?'.refactor-checkpoints/F-before/files/tests/harness.cjs':'tests/harness.cjs'))));process.exit(0);}
const {execFileSync}=require('node:child_process');
const run=mode=>JSON.parse(execFileSync(process.execPath,[__filename,mode],{encoding:'utf8'}));
const result={fixture:'9 games × 1000 ledger rows; in-process DOM harness, not Electron wall time',before:run('before'),after:run('after')};
const out=path.join(root,'.refactor-audit/F');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
