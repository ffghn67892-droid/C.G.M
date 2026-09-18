// One-shot, reviewed AST extraction. Requires the Node-bundled Acorn parser.
const fs=require('node:fs'),vm=require('node:vm');
const parser={exports:{}};vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{module:parser,exports:parser.exports});const acorn=parser.exports;
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
const original=Object.fromEntries(['app.js','park-quests.js','mission-updates.js','setup.js','game-config.js','overview.js'].map(p=>[p,read(p)]));
const nodes=p=>acorn.parse(original[p],{ecmaVersion:'latest'}).body;
const functions=p=>nodes(p).filter(n=>n.type==='FunctionDeclaration');
const extract=(p,n)=>original[p].slice(n.start,n.end);
const keepApp=new Set(['restoreCommittedState','save','data','toast','setQuestSummary','clearQuestSummary']);
const migrationNames=new Set(['ensureSnapCreditData','ensureMightData','ensureMtgaData','ensureKardsData','ensureMasterDuelData','ensureDuelLinksData','ensurePokemonPocketData','syncPokemonPocket','syncDuelLinks','nextMasterDuelQuest','normalizeMasterDuelQuestLabels','addMasterDuelQuests','syncMasterDuelQuests','syncKardsMissions','ensureDailyQueue','syncRetainedDaily','completeDailyQuest','syncDailyQueue','ensureShadowverseData','syncGameProgress']);
const constants=nodes('app.js').filter(n=>n.type==='VariableDeclaration'&&n.start<original['app.js'].indexOf('const $ =')&&!['REFRESH_HOURS','SEASON_QUESTS'].includes(n.declarations[0].id.name));
const rewardHelpers=functions('app.js').filter(n=>['mtgaWinGold','mtgaWinGoldThrough','mtgaDailyWinXp'].includes(n.id.name));
write('game-data.js','// Default game names and preset data. No state mutation or UI handlers.\n'+[...constants,...rewardHelpers].sort((a,b)=>a.start-b.start).map(n=>extract('app.js',n)).join('\n')+'\n'+nodes('park-quests.js').filter(n=>n.type==='VariableDeclaration').map(n=>extract('park-quests.js',n)).join('\n')+'\n');
let app=nodes('app.js').filter(n=>n.type==='VariableDeclaration'&&n.start>=original['app.js'].indexOf('const $ =')&&!['mightWeekIndex','pendingMissionId','pendingDailyQuest','pendingShadowverseQuest'].includes(n.declarations[0].id.name)||n.type==='TryStatement'||n.type==='ForOfStatement'||n.type==='FunctionDeclaration'&&keepApp.has(n.id.name)).map(n=>extract('app.js',n)).join('\n');
app=app.replace('structuredClone(SEASON_QUESTS)','[]');write('app.js','// Shared state, synchronous persistence and small UI utilities.\n'+app+'\nfunction renderAll(){return renderManaged();}\n');
const migration=functions('app.js').filter(n=>migrationNames.has(n.id.name)).map(n=>extract('app.js',n));
for(const[p,name]of [['park-quests.js','ensureParkData'],['mission-updates.js','syncSnapMissions'],['game-config.js','syncLegacyGame']])migration.push(extract(p,functions(p).find(n=>n.id.name===name)));
write('legacy-migrations.js','// Retained solely to normalize pre-catalog saves (plus the KARDS storage adapter).\n// Do not remove these helpers based on UI reachability alone.\n'+migration.join('\n\n')+'\n');
const keepSetup=new Set(['openDialog','closeDialog','field','values','mountRuleEditor','openCatalogEditor','cloneCatalog','createCustomGame','openCustomSetup']);
write('setup.js',functions('setup.js').filter(n=>keepSetup.has(n.id.name)).map(n=>extract('setup.js',n)).join('\n')+'\nfunction openSetup(id){return isCustomGame(id)?openCustomSetup(id):openPresetSetup(id);}\n');
const removeConfig=new Set(['newRuleMission','ruleClaimCount','runKardsAction','completeRule','updateKardsCatalog','chestPeriod','passAwards','eventAwards','syncLegacyGame']);
write('game-config.js',nodes('game-config.js').filter(n=>n.type!=='FunctionDeclaration'||!removeConfig.has(n.id.name)).map(n=>extract('game-config.js',n)).join('\n')+'\n');
write('overview.js',functions('overview.js').filter(n=>!['gameStatus','openSettings'].includes(n.id.name)).map(n=>extract('overview.js',n)).join('\n')+`\nfunction gameStatus(id){const g=state.games[id],p=g.profile;if(!p?.registeredAt)return {color:'setup',label:'설정 필요'};if(p.mutedUntil>Date.now())return {color:'done',label:'✓'};return universalStatus(g);}\nfunction openSettings(id){return openUniversalSettings(id);}\n`);
// Files fully superseded; their required data/migration functions were extracted above.
for(const p of ['game-extras.js','mission-updates.js','park-quests.js'])fs.unlinkSync(p);
const removed=Object.fromEntries(Object.keys(original).map(p=>[p,functions(p).filter(n=>!((p==='app.js'&&(keepApp.has(n.id.name)||migrationNames.has(n.id.name)||rewardHelpers.some(h=>h.id.name===n.id.name)))||p==='setup.js'&&keepSetup.has(n.id.name)||p==='game-config.js'&&!removeConfig.has(n.id.name)||p==='overview.js'&&!['gameStatus','openSettings'].includes(n.id.name)||p==='park-quests.js'&&n.id.name==='ensureParkData'||p==='mission-updates.js'&&n.id.name==='syncSnapMissions')).map(n=>n.id.name)]));
fs.mkdirSync('.refactor-audit/G',{recursive:true});const retained=new Set([...fs.readdirSync('.').filter(p=>p.endsWith('.js')).map(read).join('\n').matchAll(/function\s+(\w+)\s*\(/g)].map(m=>m[1]));for(const p of Object.keys(removed))removed[p]=removed[p].filter(n=>!retained.has(n));write('.refactor-audit/G/removed-functions.json',JSON.stringify(removed,null,2));
