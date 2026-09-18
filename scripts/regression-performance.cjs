const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.refactor-audit/regression-fixes');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'performance-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1180,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const run=s=>win.webContents.executeJavaScript(s),result={before:[],after:[]};
 try{
  for(let round=0;round<3;round++)for(const version of round%2?['after','before']:['before','after']){
   await win.loadFile(path.join(root,version==='before'?'.refactor-checkpoints/regression-fixes-before/files':'','index.html'));
   await run("resetAllGames();createCustomGame('측정',presetCatalog('might-magic'));renderAll();true");await run('document.fonts.ready.then(()=>true)');
   const measurement=await run(`(async()=>{const g=data(),r=catalogRules(g).find(r=>r.type==='pass'),samples=[],frames=[];let count=0;
    for(let i=0;i<30;i++){const at=performance.now();g['stepPage-'+r.id]=i%2;renderAll();document.querySelector('#questList').getBoundingClientRect();const sync=performance.now()-at;await new Promise(resolve=>setTimeout(resolve,0));if(i>=6){samples.push(sync);frames.push(performance.now()-at);}}
    const start=performance.now();for(let i=0;i<100;i++)count=catalogSteps(r).length;return {samples,frames,stepsPerCallMs:(performance.now()-start)/100,count};})()`);
   result[version].push(measurement);
  }
  await win.loadFile(path.join(root,'index.html'));await run("resetAllGames();for(const id of ['kards',...CATALOG_PRESETS])createCustomGame(GAMES.find(x=>x[0]===id)[1],presetCatalog(id),id);true");result.headers=[];
  for(const id of ['overview','kards','mtga','hearthstone','might-magic','shadowverse','master-duel','snap','duel-links','pokemon-pocket']){
   await run(`state.activeGame=${JSON.stringify(id)};renderAll();true`);const h=await run("({width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,text:document.querySelector('#resetScheduleInfo').textContent})");assert.ok(h.width<=h.viewport,id+' horizontal overflow');result.headers.push({id,...h});
  }
  await run("state.activeGame='mtga';const rules=structuredClone(data().ruleCatalog);rules[0].schedule.time='10:00';updateCatalog('mtga',rules);renderAll();true");assert.match(await run("document.querySelector('#resetScheduleInfo').textContent"),/10:00/);
  const quantile=(xs,q)=>[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*q)];result.summary={};
  for(const version of ['before','after']){const groups=result[version],samples=groups.flatMap(x=>x.samples),frames=groups.flatMap(x=>x.frames);result.summary[version]={samples:samples.length,renderMedianMs:quantile(samples,.5),renderP95Ms:quantile(samples,.95),eventTurnMedianMs:quantile(frames,.5),stepsPerCallMs:quantile(groups.map(x=>x.stepsPerCallMs),.5)};}
  result.summary.extraRenderCostPercent=(result.summary.before.renderMedianMs/result.summary.after.renderMedianMs-1)*100;
  fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.summary,null,2));console.log('HEADERS_PASS 10 views, edited MTGA header');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});
