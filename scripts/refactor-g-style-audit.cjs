const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),before=path.join(root,'.refactor-checkpoints/G-before/files'),out=path.join(root,'.refactor-audit/G');fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'style-profile'));app.disableHardwareAcceleration();
const corpus=fs.readdirSync(root).filter(f=>/\.(js|html)$/.test(f)).map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
app.whenReady().then(async()=>{const win=new BrowserWindow({show:false,width:1180,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}}),run=s=>win.webContents.executeJavaScript(s);
 try{
  // CSSOM parses selectors and nested media rules; retain uncertain/global rules.
  for(const name of ['styles.css','manager.css'])fs.copyFileSync(path.join(before,name),path.join(root,name));await win.loadFile(path.join(root,'index.html'));
  const pruned=await run(`(()=>{const corpus=${JSON.stringify(corpus)},removed=[];
   function split(s){let depth=0,start=0,out=[];for(let i=0;i<s.length;i++){if(s[i]==='('||s[i]==='[')depth++;if(s[i]===')'||s[i]===']')depth--;if(s[i]===','&&!depth){out.push(s.slice(start,i));start=i+1;}}out.push(s.slice(start));return out;}
   function keep(s){return [...s.matchAll(/[.#]([a-zA-Z_][\\w-]*)/g)].every(m=>corpus.includes(m[1]));}
   function clean(rules){return [...rules].map(r=>{if(r.type===1){const selectors=split(r.selectorText).filter(s=>{if(keep(s))return true;removed.push(s);return false;});return selectors.length?selectors.join(', ')+' { '+r.style.cssText+' }':'';}if(r.cssRules&&r.type!==7){const body=clean(r.cssRules);return body?r.cssText.slice(0,r.cssText.indexOf('{')+1)+'\\n'+body+'\\n}':'';}return r.cssText;}).filter(Boolean).join('\\n');}
   return {files:[...document.styleSheets].filter(s=>s.href?.startsWith('file:')).map(s=>({name:s.href.split('/').pop(),css:clean(s.cssRules)})),removed};})()`);
  for(const f of pruned.files)fs.writeFileSync(path.join(root,f.name),f.css+'\n');fs.writeFileSync(path.join(out,'removed-selectors.json'),JSON.stringify(pruned.removed,null,2));
  async function snapshots(base){await win.loadFile(path.join(base,'index.html'));await run('document.fonts.ready.then(()=>true)');await run("resetAllGames();for(const id of CATALOG_PRESETS)createCustomGame(GAMES.find(x=>x[0]===id)[1],presetCatalog(id),id);createCustomGame('KARDS',defaultKardsRules(),'kards');state.activeGame='overview';renderAll()");const result={};
   const capture=async()=>{await run('document.fonts.ready.then(()=>true)');return run(`(()=>{const roots=[document.querySelector('#gameSwitcher'),document.querySelector('.page-content'),document.querySelector('#managerDialog')].filter(Boolean);return roots.flatMap(root=>[root,...root.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>{const c=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,classes:e.className,box:[b.x,b.y,b.width,b.height].map(n=>Math.round(n*100)/100),style:['display','position','color','backgroundColor','fontFamily','fontSize','fontWeight','padding','margin','border','gap','gridTemplateColumns','lineHeight','opacity','overflow','boxShadow'].map(k=>c[k])};}));})()`);};
   for(const id of ['overview','kards',...(await run('CATALOG_PRESETS'))]){await run(`closeDialog();state.activeGame=${JSON.stringify(id)};renderAll()`);result[id]=await capture();}
   for(const type of ['quest','claim','goal','resource','pass','counter']){await run(`closeDialog();state.activeGame='overview';renderAll();openDialog('유형 확인','<div id="auditEditor"></div>');mountRuleEditor([newUniversalRule(${JSON.stringify(type)})],document.querySelector('#auditEditor'),true);true`);result['editor-'+type]=await capture();}
   await run("closeDialog();state.activeGame='mtga';catalogAction('mtga','daily-win','progress',{amount:3});renderAll()");result['completed-goal']=await capture();return result;
  }
  const a=await snapshots(before),b=await snapshots(root);const differences=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));fs.writeFileSync(path.join(out,'style-comparison.json'),JSON.stringify({cases:Object.keys(a),removedSelectors:pruned.removed.length,differences},null,2));
  if(differences.length){fs.writeFileSync(path.join(out,'before-layout.json'),JSON.stringify(a));fs.writeFileSync(path.join(out,'after-layout.json'),JSON.stringify(b));}
  assert.deepEqual(differences,[]);console.log(`G_STYLE_PASS ${Object.keys(a).length} views unchanged; ${pruned.removed.length} obsolete selectors removed`);app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});

