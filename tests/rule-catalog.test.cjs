const test=require('node:test'),assert=require('node:assert/strict'),{start}=require('./harness.cjs');
test('catalog schedules use KST weekly and anchored N-day boundaries',()=>{
 const a=start();
 a.run("globalThis.r=defaultKardsRules()[0];r.schedule={kind:'weekly',weekday:1,time:'05:30'}");
 const before=a.run("rulePeriod(r,new Date('2026-09-14T05:29:59.999+09:00'))");
 assert.equal(a.run("rulePeriod(r,new Date('2026-09-14T05:30:00+09:00'))"),before+7);
 a.run("r.schedule={kind:'intervalDays',days:3,anchor:'2026-09-10',time:'09:15'}");
 const n=a.run("rulePeriod(r,new Date('2026-09-13T09:14:59+09:00'))");
 assert.equal(a.run("rulePeriod(r,new Date('2026-09-13T09:15:00+09:00'))"),n+3);
});
test('custom quests generate up to capacity, select compound rewards and retain completion until reset',()=>{
 const a=start();a.run("const rules=structuredClone(kardsRules());const r=structuredClone(rules[0]);r.id='custom';r.source='user';r.spawnCount=2;r.capacity=4;r.passExtra=0;r.rewards=[{id:'both',label:'두 재화',resources:{gold:70,cards:2}}];r.quests=[{id:'q',label:'새 임무',rewardIds:['both']}];rules.push(r);updateKardsCatalog(rules);renderAll()");
 assert.equal(a.run('data().ruleProgress.custom.missions.length'),2);
 a.click('[data-rule-complete="custom"]');assert.equal(a.run("totals('kards').gold"),70);assert.equal(a.run("totals('kards').cards"),2);
 assert.equal(a.run('data().ruleProgress.custom.missions[0].done'),true);
 a.nextDay(3);a.run('refreshAllGames()');assert.equal(a.run('data().ruleProgress.custom.missions.length'),4);
 assert.equal(a.run('data().ruleProgress.custom.missions.some(m=>m.done)'),false);
 assert.equal(start(a.saved()).run("totals('kards').gold"),70);
});
test('editing rewards preserves existing quest choices and historical awards',()=>{
 const a=start();a.run("const rules=structuredClone(kardsRules());rules[0].rewards[0].resources.gold=90;rules[0].rewards[0].label='90 GOLD';updateKardsCatalog(rules);renderAll()");
 a.click('[data-kards-complete="50"]');assert.equal(a.run("totals('kards').gold"),50);
 a.nextDay();a.run('refreshAllGames()');a.click('[data-kards-complete="90"]');assert.equal(a.run("totals('kards').gold"),140);
});
test('claim schedule edit does not refund claimed quota; stale buttons and duplicates do not pay',()=>{
 const a=start();a.click('[data-kards-free-card="0"]');
 a.run("const rules=structuredClone(kardsRules());rules[1].schedule.time='23:50';updateKardsCatalog(rules);renderAll()");
 a.click('[data-kards-free-card="0"]');assert.equal(a.run("totals('kards').cards"),1);
 assert.equal(a.run("completeRule('daily',data().kards.missions[0].id,'gold50',-100)"),false);
});
test('catalog rejects invalid references, schedules and quantities without saving',()=>{
 const a=start(),before=a.saved();
 for(const edit of ["r[0].quests[0].rewardIds=['missing']","r[0].schedule.time='25:00'","r[0].spawnCount=4","r[0].rewards[0].resources.gold=-1","r.push(structuredClone(r[0]))"]){assert.throws(()=>a.run(`{const r=structuredClone(kardsRules());${edit};updateKardsCatalog(r);}`));assert.equal(a.saved(),before);}
});
test('first setup reads edited catalog, cancelling does not write, later editor can add rules',()=>{
 const a=start();a.run("resetGame('kards');openSetup('kards')");const before=a.saved();
 a.document.querySelector('[data-rule-field="time"]').value='10:30';a.click('#previewSetup');
 assert.equal(a.saved(),before);a.click('#commitSetup');assert.equal(a.run("kardsRules()[0].schedule.time"),'10:30');
 a.click('#editKardsRules');a.click('[data-add-rule="quest"]');a.document.querySelector('[data-rule-field="label"]').value='내 퀘스트';a.click('#saveRuleCatalog');
 assert.equal(a.run("kardsRules().some(r=>r.label==='내 퀘스트')"),true);
});
test('catalog completion and editing recover from failed write without losing retry',()=>{
 const a=start();const before=a.saved();a.run("globalThis.write=localStorage.setItem;localStorage.setItem=()=>{throw Error('no storage')}");
 a.click('[data-kards-complete="60"]');assert.equal(a.run("totals('kards').gold||0"),0);assert.equal(a.saved(),before);
 a.run('localStorage.setItem=write');a.click('[data-kards-complete="60"]');assert.equal(a.run("totals('kards').gold"),60);
});
test('initial compound rewards are recorded once without activity days',()=>{
 const a=start();a.run("resetGame('kards');openSetup('kards')");
 a.document.querySelector('[data-rule-field="resources0"]').value='골드:70, 카드:2';
 a.document.querySelector('[data-rule-field="received0"]').value='1';a.click('#previewSetup');a.click('#commitSetup');
 assert.equal(a.run("totals('kards').gold"),70);assert.equal(a.run("totals('kards').cards"),2);
 assert.equal(a.run('data().profile.activityDays.length'),0);assert.equal(a.run('data().kards.missions.filter(m=>m.done).length'),1);
 assert.equal(start(a.saved()).run("totals('kards').gold"),70);
});
test('initial preview cannot commit after the edited reset time passes',()=>{
 const a=start();a.run("resetGame('kards');openSetup('kards')");
 a.document.querySelector('[data-rule-field="time"]').value='00:00';a.click('#previewSetup');a.advance(61000);a.click('#commitSetup');
 assert.equal(a.run('data().profile.registeredAt'),null);
});
