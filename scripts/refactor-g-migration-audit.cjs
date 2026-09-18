// Compare legacy-save imports against G's checkpoint in separate VM processes.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),before=path.join(root,'.refactor-checkpoints/G-before/files'),out=path.join(root,'.refactor-audit/G');
if(process.argv[2]){
 const {start}=require(path.join(process.argv[3],'tests/harness.cjs'));
 if(process.argv[2]==='fixture'){
  const a=start();a.run("for(const [id]of GAMES){const g=state.games[id];delete g.catalogVersion;delete g.ruleCatalog;delete g.ruleProgress;award(id,'legacy-audit',{gold:123},'기존 기록',true);}state.games.mtga.mtga.dailyWins=4;state.games.mtga.mtga.weeklyWins=5;save()");process.stdout.write(a.saved());
 }else{
  const a=start(fs.readFileSync(path.join(out,'legacy-fixture.json'),'utf8'));
  const snapshot="JSON.stringify(GAMES.map(([id])=>{syncGame(id);const g=state.games[id];return {id,totals:totals(id),rules:g.ruleCatalog,progress:g.ruleProgress};}),(k,v)=>['id','clock'].includes(k)&&typeof v==='string'&&v.length>30?'generated-id':v)";
  const first=a.run(snapshot);a.run('save()');const b=start(a.saved());assert.equal(b.run(snapshot),first,'repeat import must not issue rewards or reset progress');process.stdout.write(first);
 }
}else{
 function child(mode,base){const p=spawnSync(process.execPath,[__filename,mode,base],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(p.status,0,p.stderr);return p.stdout;}
 fs.writeFileSync(path.join(out,'legacy-fixture.json'),child('fixture',before));
 const a=JSON.parse(child('import',before)),b=JSON.parse(child('import',root));assert.deepEqual(b,a);
 fs.writeFileSync(path.join(out,'migration-comparison.json'),JSON.stringify({games:a.map(x=>x.id),equal:true,reloadIdempotent:true},null,2));console.log('G_MIGRATION_PASS 9 legacy game imports and reloads match checkpoint');
}
