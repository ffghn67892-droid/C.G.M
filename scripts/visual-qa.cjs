// Isolated Electron render/integration QA: never opens the user's saved profile.
const {app,BrowserWindow}=require('electron');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');app.setPath('userData',path.join(root,'.qa-profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{const win=new BrowserWindow({show:false,width:1440,height:960,webPreferences:{contextIsolation:true,nodeIntegration:false}});const errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level===3&&!message.includes('ERR_INTERNET_DISCONNECTED')&&!message.includes('ERR_NAME_NOT_RESOLVED'))errors.push(message);});
try{await win.loadFile(path.join(root,'index.html'));await win.webContents.executeJavaScript(`localStorage.clear();location.reload()`);await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
 fs.mkdirSync(path.join(root,'qa'),{recursive:true});
 const run=code=>win.webContents.executeJavaScript(code);
 await run(`for(const [id]of GAMES){openSetup(id);const v=values();if(id==='master-duel')v.masterTypes=[0,1,2,3,4,5,6,7,8];if(id==='mtga'){v.daily=1;v.completedRewards='500,750';v.dailyWins=4;v.weeklyWins=7;}if(id==='shadowverse'){v.parkWeekly=[0,1,3];v.parkDaily=[0];}v.paid=[1];state.games[id]=makeInitial(id,v);}closeDialog();renderAll();`);
 const results=[];
 async function checkGameNames(){
  const names=await run(`Array.from(document.querySelectorAll('.game-tab>span:nth-child(2),.overview-card h3')).map(el=>({text:el.textContent,nowrap:getComputedStyle(el).whiteSpace==='nowrap',width:el.clientWidth,contentWidth:el.scrollWidth}))`);
  for(const name of names){assert.ok(name.nowrap,`game name wraps: ${name.text}`);assert.ok(name.contentWidth<=name.width+1,`game name clipped: ${name.text} (${name.contentWidth}/${name.width})`);}
 }
 async function checkKardsSlots(){
  await run(`state.activeGame='kards';renderAll();`);
  for(let n=0;n<=3;n++){
   await run(`data().kards.missions=Array.from({length:${n}},()=>({id:crypto.randomUUID(),label:'일일 퀘스트',reward:50}));renderAll();`);
   const slots=await run(`Array.from(document.querySelectorAll('.kards-list>.quest-row')).map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}))`);
   assert.equal(slots.length,3);assert.equal(new Set(slots.map(x=>x.width)).size,1);assert.equal(new Set(slots.map(x=>x.height)).size,1);
   if(n>0){assert.equal(await run(`document.querySelectorAll('[data-kards-complete]').length`),n*2);assert.equal(await run(`document.querySelectorAll('.kards-check').length`),0);}
   assert.equal(await run(`document.querySelector('.kards-earned').open`),false);
   await run(`document.querySelector('.kards-earned summary').click()`);
   assert.equal(await run(`document.querySelector('.kards-earned').open`),true);
  }
 }
 for(const [width,height]of [[1440,960],[1180,760]]){win.setContentSize(width,height);await checkKardsSlots();for(const id of ['overview','kards','mtga','shadowverse','snap','might-magic','master-duel','duel-links','hearthstone','pokemon-pocket']){await run(`state.activeGame='${id}';renderAll();window.scrollTo(0,0);`);await new Promise(r=>setTimeout(r,120));const metrics=await run(`({width:innerWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.mtga-top-grid>.mtga-card')].map(x=>({x:x.getBoundingClientRect().x,y:x.getBoundingClientRect().y,width:x.getBoundingClientRect().width}))})`);assert.ok(metrics.bodyWidth<=metrics.clientWidth,`${id}: overflow ${metrics.bodyWidth}/${metrics.clientWidth}`);if(id==='mtga')assert.equal(new Set(metrics.cards.map(x=>x.y)).size,1);await checkGameNames();results.push({id,width,height,...metrics});fs.writeFileSync(path.join(root,'qa',`${id}-${width}.png`),(await win.webContents.capturePage()).toPNG());}}
 await run(`openSettings('master-duel')`);await new Promise(r=>setTimeout(r,150));fs.writeFileSync(path.join(root,'qa','settings-1180.png'),(await win.webContents.capturePage()).toPNG());
 await run(`closeDialog();resetGame('kards');openSetup('kards')`);await new Promise(r=>setTimeout(r,150));fs.writeFileSync(path.join(root,'qa','setup-1180.png'),(await win.webContents.capturePage()).toPNG());
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(root,'qa','layout-results.json'),JSON.stringify(results,null,2));console.log('VISUAL_QA_PASS',results.length,'screens; no horizontal overflow; MTGA horizontal row verified');app.exit(0);
}catch(error){console.error(error);app.exit(1);}});
