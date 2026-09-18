const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.refactor-audit','D-universal');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1180,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const run=code=>win.webContents.executeJavaScript(code),paint=()=>new Promise(r=>setTimeout(r,800));
 const shot=async name=>{await win.webContents.capturePage();await paint();fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  await win.loadFile(path.join(root,'index.html'));await run("state.activeGame='overview';renderAll();document.querySelector('#addCustomGame').click();document.querySelector('#customGameName').value='내 카드 게임';document.querySelector('[data-new-empty=quest]').click();");await shot('create');
  console.log(await run("JSON.stringify({hidden:document.querySelector('#managerDialog').hidden,display:getComputedStyle(document.querySelector('#managerDialog')).display,rect:document.querySelector('#managerDialog').getBoundingClientRect().toJSON()})"));
  assert.equal(await run("document.querySelector('.manager-dialog').scrollWidth<=document.querySelector('.manager-dialog').clientWidth+1"),true);
  await run("document.querySelector('#createCustomGame').click();document.querySelector('[data-rule-complete]').click()");
  assert.equal(await run('totals(state.activeGame).gold'),50);await shot('custom-game');
  assert.equal(await run('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),true);
  const id=await run('state.activeGame');await win.reload();if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));
  assert.equal(await run('state.activeGame'),id);assert.equal(await run('totals(state.activeGame).gold'),50);
  await run("document.querySelector('#editKardsRules').click();document.querySelector('#copyRule').click();document.querySelector('#saveRuleCatalog').click()");
  assert.equal(await run('data().ruleCatalog.length'),2);
  await run("state.activeGame='overview';renderAll()");await shot('overview');
  assert.equal(await run('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),true);
  console.log('UNIVERSAL_CATALOG_QA_PASS create, complete, reload, clone, overview, minimum width');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});
