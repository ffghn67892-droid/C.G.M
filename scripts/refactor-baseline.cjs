// Audit tooling only. Does not load or modify a real user profile or application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.refactor-audit/A');
const files = ['schedules.js','park-quests.js','app.js','reward-ledger.js','pass-data.js','game-config.js','game-extras.js','setup.js','mission-updates.js','overview.js','alerts.js','manager.js'];
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));
fs.mkdirSync(out, {recursive: true});
const mode = process.argv[2];
if (mode === 'test') {
  if (fs.existsSync(path.join(out,'test-result.json'))) throw Error('A-stage test run already exists; preserve it.');
  let offset = 0, line = 1;
  const mapping = files.map(file => {
    const text = fs.readFileSync(path.join(root,file),'utf8');
    const entry = {file,startOffset:offset,endOffset:offset+text.length,startLine:line,endLine:line+text.split('\n').length-1,bytes:Buffer.byteLength(text),sha256:crypto.createHash('sha256').update(text).digest('hex')};
    offset += text.length+1; line += text.split('\n').length;
    return entry;
  });
  fs.writeFileSync(path.join(out,'renderer-bundle.js'),files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'));
  write('source-map.json',mapping);
  const tests = fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.cjs')).sort().map(f=>path.join('tests',f));
  const args = ['--require',path.join(__dirname,'refactor-coverage-hook.cjs'),'--test','--experimental-test-coverage','--test-coverage-include=**/renderer-bundle.js','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=lcov',`--test-reporter-destination=${path.join(out,'coverage.lcov')}`,...tests];
  const start = Date.now();
  const result = spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,NODE_V8_COVERAGE:path.join(out,'v8')}});
  fs.writeFileSync(path.join(out,'tests.log'),(result.stdout||'')+(result.stderr||''));
  write('test-result.json',{node:process.version,at:new Date().toISOString(),durationMs:Date.now()-start,args,status:result.status,error:result.error?.message});
  console.log(result.stdout); if(result.stderr)console.error(result.stderr);
  process.exitCode = result.status ?? 1;
} else if (mode === 'coverage') {
  const mapping = JSON.parse(fs.readFileSync(path.join(out,'source-map.json'),'utf8'));
  const raw = fs.readdirSync(path.join(out,'v8')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(fs.readFileSync(path.join(out,'v8',f),'utf8')).result);
  const bundles = raw.filter(s=>s.url.replaceAll('\\','/').endsWith('/.refactor-audit/A/renderer-bundle.js'));
  if(!bundles.length)throw Error('No labelled VM coverage captured.');
  // Functions are identified by immutable source offsets, unioned across every VM context.
  // Do not call observed V8 blocks an AST branch coverage percentage.
  const functions = new Map();
  for(const script of bundles)for(const fn of script.functions){
    const range=fn.ranges[0];
    if(range.startOffset===0&&range.endOffset===mapping.at(-1).endOffset)continue;
    const key=`${range.startOffset}:${range.endOffset}`;
    const item=functions.get(key)||{name:fn.functionName||'(anonymous)',start:range.startOffset,end:range.endOffset,executed:false};
    item.executed ||= range.count>0; functions.set(key,item);
  }
  const rows = mapping.map(m=>{
    const items=[...functions.values()].filter(f=>f.start>=m.startOffset&&f.start<m.endOffset);
    const source=fs.readFileSync(path.join(root,m.file),'utf8');
    return {file:m.file,kind:m.file==='pass-data.js'?'generated-data':'renderer-runtime',bytes:m.bytes,functions:items.length,executedFunctions:items.filter(f=>f.executed).length,unexecuted:items.filter(f=>!f.executed).map(f=>({name:f.name,line:source.slice(0,f.start-m.startOffset).split('\n').length}))};
  });
  const lcov=fs.readFileSync(path.join(out,'coverage.lcov'),'utf8');
  const records=lcov.split('end_of_record').filter(x=>/SF:.*renderer-bundle\.js/.test(x));
  if(records.length!==1)throw Error(`Expected one labelled LCOV record, got ${records.length}`);
  const da=[...records[0].matchAll(/^DA:(\d+),(\d+)/gm)].map(m=>({line:Number(m[1]),count:Number(m[2])}));
  const branches=[...records[0].matchAll(/^BRDA:(\d+),[^,]+,[^,]+,([^\r\n]+)/gm)].map(m=>({line:Number(m[1]),count:Number(m[2])||0}));
  for(const row of rows){const m=mapping.find(x=>x.file===row.file),lines=da.filter(x=>x.line>=m.startLine&&x.line<=m.endLine),blocks=branches.filter(x=>x.line>=m.startLine&&x.line<=m.endLine);row.reportedLines=lines.length;row.coveredLines=lines.filter(x=>x.count>0).length;row.v8Branches=blocks.length;row.coveredV8Branches=blocks.filter(x=>x.count>0).length;}
  const summary={vmScripts:bundles.length,method:'Native Node/V8 LCOV lines mapped by exact bundle line offsets; function execution union by source offsets. Not semantic branch coverage.',unmeasured:['desktop-main.js','electron-main.js','preload.js'],rows};
  write('coverage-summary.json',summary);
  console.log(JSON.stringify(summary,null,2));
} else if (mode === 'probes') {
  const {start}=require('../tests/harness.cjs');
  const a=start();a.select('kards');const savedBefore=a.saved();
  a.run(`globalThis.auditOriginalSetItem=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='deckroom-quests')throw new Error('AUDIT_INJECTED_WRITE_FAILURE');return auditOriginalSetItem(key,value);}`);
  let failure;
  try{a.click('[data-kards-complete="50"]');}catch(e){failure=e.message;}
  const afterFailure={error:failure,memoryDone:a.run('data().kards.missions[0].done'),memoryGold:a.run("totals('kards').gold||0"),storedUnchanged:a.saved()===savedBefore};
  a.run('localStorage.setItem=auditOriginalSetItem');
  a.click('[data-kards-complete="50"]');
  const retry={memoryGold:a.run("totals('kards').gold||0"),storedUnchanged:a.saved()===savedBefore};
  const reopened=start(savedBefore);reopened.select('kards');
  const reload={gold:reopened.run("totals('kards').gold||0"),done:!!reopened.run('data().kards.missions[0].done')};
  const b=start();b.select('snap');
  b.run('data().weeklyCount=5;data().weeklyCreditClaims=[]');
  const beforeRender=b.run("JSON.stringify(totals('snap'))");b.run('renderAll()');
  const afterRender=b.run("JSON.stringify(totals('snap'))");
  const report={storageFailure:{afterFailure,retry,reload},renderAwards:{fixture:'Snap weeklyCount=5, no claimed thresholds; synthetic state',before:JSON.parse(beforeRender),after:JSON.parse(afterRender)}};
  write('failure-probes.json',report);console.log(JSON.stringify(report,null,2));
} else if (mode === 'integrity') {
  const checkpoint=path.join(root,'.refactor-checkpoints/A-before');
  const manifest=JSON.parse(fs.readFileSync(path.join(checkpoint,'manifest.json'),'utf8').replace(/^\uFEFF/,''));
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
  const drill=path.join(out,'restore-drill');
  let copied=0;
  for(const item of manifest.files){
    const relative=item.path.replaceAll('\\','/');
    const source=path.resolve(checkpoint,'files',relative),target=path.resolve(drill,relative);
    if(!source.startsWith(path.resolve(checkpoint,'files')+path.sep)||!target.startsWith(drill+path.sep))throw Error('Unsafe checkpoint path');
    if(hash(source)!==item.sha256)throw Error('Checkpoint hash mismatch: '+relative);
    if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}
    if(hash(target)!==item.sha256)throw Error('Restore drill mismatch: '+relative);
    copied++;
  }
  const changed=manifest.files.filter(f=>!fs.existsSync(path.join(root,f.path))||hash(path.join(root,f.path))!==f.sha256).map(f=>f.path);
  const protectedFiles=manifest.files.filter(f=>!f.path.includes('\\')&&!f.path.includes('/')&&(/\.(js|css|html)$/.test(f.path)||/^package(-lock)?\.json$/.test(f.path)));
  const protectedChanges=protectedFiles.filter(f=>changed.includes(f.path));
  if(protectedChanges.length)throw Error('App/config unexpectedly changed: '+protectedChanges.map(f=>f.path).join(','));
  const report={checkpointFiles:manifest.files.length,restoredAndVerified:copied,applicationAndPackageFilesUnchanged:protectedFiles.length,changedBaselineFiles:changed};
  write('integrity.json',report);console.log(JSON.stringify(report,null,2));
} else throw Error('Usage: node scripts/refactor-baseline.cjs test|coverage|probes|integrity');
