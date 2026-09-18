const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.refactor-audit','D');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1180,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false}}),errors=[];
 win.webContents.on('console-message',(_e,level,message)=>{if(level===3&&!message.includes('ERR_'))errors.push(message);});
 const run=code=>win.webContents.executeJavaScript(code);
 const paint=()=>new Promise(resolve=>setTimeout(resolve,200));
 try{
  await win.loadFile(path.join(root,'index.html'));
  await run("resetGame('kards');state.activeGame='kards';openSetup('kards');");
  await paint();
  await win.webContents.capturePage().then(img=>fs.writeFileSync(path.join(out,'setup.png'),img.toPNG()));
  assert.equal(await run("document.querySelector('.manager-dialog').scrollWidth<=document.querySelector('.manager-dialog').clientWidth+1"),true);
  await run("document.querySelector('[data-rule-field=label]').value='일일 퀘스트';document.querySelector('#previewSetup').click();document.querySelector('#commitSetup').click();document.querySelector('[data-kards-complete=\"60\"]').click();");
  assert.equal(await run("totals('kards').gold"),60);
  await paint();
  await win.webContents.capturePage().then(img=>fs.writeFileSync(path.join(out,'kards.png'),img.toPNG()));
  assert.equal(await run('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),true);
  await run("document.querySelector('#editKardsRules').click();document.querySelector('[data-add-rule=quest]').click();document.querySelector('[data-rule-field=label]').value='주간 연습';document.querySelector('[data-rule-field=kind]').value='weekly';document.querySelector('#saveRuleCatalog').click();");
  assert.equal(await run("kardsRules().some(r=>r.label==='주간 연습'&&r.schedule.kind==='weekly')"),true);
  await win.reload();if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  assert.equal(await run("totals('kards').gold"),60);
  assert.equal(await run("kardsRules().some(r=>r.label==='주간 연습')"),true);
  assert.deepEqual(errors,[]);console.log('KARDS_CATALOG_QA_PASS setup, editing, reward, reload, minimum width');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});
