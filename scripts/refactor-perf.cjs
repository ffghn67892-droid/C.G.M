// Isolated source-renderer performance baseline; no installer or real profile access.
const {app,BrowserWindow}=require('electron');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.refactor-audit/A');
app.setPath('userData',path.join(out,'perf-profile'));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1180,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,preload:path.join(root,'preload.js')}});
 try{
  await win.loadFile(path.join(root,'index.html'));
  const result=await win.webContents.executeJavaScript(`(()=>{
   const OriginalDate=Date,fixed=OriginalDate.parse('2026-09-18T12:30:00+09:00');
   window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
   for(const[id]of GAMES){state.activeGame=id;openSetup(id);state.games[id]=makeInitial(id,values());closeDialog();}
   const base=JSON.stringify(state.games);
   const results=[];
   const operations={
    idleSync:()=>refreshActiveQuests(),
    openOverview:()=>{state.activeGame='overview';renderAll();},
    switchToMtga:()=>document.querySelector('[data-game="mtga"]').click(),
    completeKards:()=>document.querySelector('[data-kards-complete="50"]').click()
   };
   for(const rowsPerGame of [20,1000]){
    state.games=JSON.parse(base);
    for(const[id]of GAMES){const g=state.games[id];g.ledger={};for(let n=0;n<rowsPerGame;n++){const key='audit/'+n;g.ledger[key]={id:id+'/'+key,source:'synthetic',rewards:{gold:50},at:'2026-09-17T00:00:00.000Z',initial:false,version:1};}rewardOwner(id).rewardTotals={gold:rowsPerGame*50};}
    state.activeGame='kards';renderAll();refreshActiveQuests();
    const stable=JSON.stringify(state.games);refreshActiveQuests();
    if(JSON.stringify(state.games)!==stable)throw new Error('Idle fixture is not stable after initialization');
    const fixture=JSON.stringify(state.games),fixtureCharacters=fixture.length;
    const restore=()=>{state.games=JSON.parse(fixture);state.activeGame='kards';renderAll();};
    for(const[name,operation]of Object.entries(operations)){
     for(let i=0;i<3;i++){restore();operation();}
     const samples=[];
     for(let i=0;i<15;i++){restore();const begin=performance.now();operation();samples.push(performance.now()-begin);}
     restore();
     const counts={save:0,syncGame:0,totals:0,stringify:0,questListHtml:0,gameSwitcherHtml:0,otherHtml:0};
     const originals={save,syncGame,totals,stringify:JSON.stringify};
     const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
     save=function(...args){counts.save++;return originals.save(...args);};
     syncGame=function(...args){counts.syncGame++;return originals.syncGame(...args);};
     totals=function(...args){counts.totals++;return originals.totals(...args);};
     JSON.stringify=function(...args){counts.stringify++;return originals.stringify(...args);};
     Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){counts[this.id==='questList'?'questListHtml':this.id==='gameSwitcher'?'gameSwitcherHtml':'otherHtml']++;return html.set.call(this,value);}});
     try{operation();}finally{save=originals.save;syncGame=originals.syncGame;totals=originals.totals;JSON.stringify=originals.stringify;Object.defineProperty(Element.prototype,'innerHTML',html);}
     const ordered=[...samples].sort((a,b)=>a-b);
     results.push({rowsPerGame,totalLedgerRows:rowsPerGame*GAMES.length,fixtureCharacters,name,samplesMs:samples,medianMs:ordered[7],minMs:ordered[0],maxMs:ordered.at(-1),counts});
    }
   }
   return {clock:'2026-09-18T12:30:00+09:00',viewport:{width:innerWidth,height:innerHeight},bridge:typeof window.deckroom?.onResume,nodeRequire:typeof require,method:'Three warmups, 15 samples; fixture restoration and operation-count instrumentation outside timed samples. Synchronous renderer JS only; no paint/compositor latency. Interval callbacks cannot interleave with this synchronous batch.',results};
  })()`);
  const report={at:new Date().toISOString(),versions:process.versions,cpu:os.cpus()[0]?.model,platform:process.platform,hardwareAcceleration:false,...result};
  fs.writeFileSync(path.join(out,'performance-steady.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({bridge:result.bridge,nodeRequire:result.nodeRequire,results:result.results.map(({samplesMs,...row})=>row)},null,2));
  app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});
