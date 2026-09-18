const test=require('node:test'),assert=require('node:assert/strict'),{start}=require('./harness.cjs');
test('unrelated games use the same rules with isolated progress and rewards across reload',()=>{
 const a=start();a.run("globalThis.rules=cloneCatalog(defaultKardsRules());globalThis.first=createCustomGame('게임 A',rules);globalThis.second=createCustomGame('게임 B',cloneCatalog(rules));renderAll()");
 a.run("const r=state.games[first].ruleCatalog[0];completeCatalogRule(first,r.id,ruleProgress(state.games[first],r).missions[0].id,r.rewards[1].id,rulePeriod(r))");
 assert.equal(a.run('totals(first).gold'),60);assert.equal(a.run('totals(second).gold||0'),0);assert.equal(a.run("totals('kards').gold||0"),0);
 const id=a.run('first'),b=start(a.saved());assert.equal(b.run(`totals('${id}').gold`),60);b.select(id);assert.ok(b.document.querySelector('.kards-row.done'));
});
test('empty game and arbitrary rule IDs are valid; all preset rules can be removed',()=>{
 const a=start();a.run("globalThis.id=createCustomGame('빈 게임',[]);renderAll()");assert.match(a.document.querySelector('#questList').textContent,/추가/);
 a.run("updateCatalog('kards',[]);state.activeGame='kards';renderAll()");assert.equal(a.run('kardsRules().length'),0);
 a.run("updateCatalog(id,[newCatalogRule('claim')]);state.activeGame=id;renderAll()");a.click('[data-rule-complete]');assert.equal(a.run('totals(id).gold'),50);
});
test('custom game creator and shared editor work without code or builtin rule IDs',()=>{
 const a=start();a.select('overview');a.click('#addCustomGame');a.document.querySelector('#customGameName').value='새 관리';a.click('[data-new-empty="quest"]');a.click('#createCustomGame');
 assert.equal(a.run('state.customGames.length'),1);a.click('[data-rule-complete]');assert.equal(a.run('totals(state.activeGame).gold'),50);
 a.click('#editKardsRules');a.click('#removeRule');a.click('#saveRuleCatalog');assert.equal(a.run('data().ruleCatalog.length'),0);
});
test('failed game creation and completion roll back and can retry exactly once',()=>{
 const a=start();a.run("globalThis.write=localStorage.setItem;localStorage.setItem=()=>{throw Error('full')}");assert.throws(()=>a.run("createCustomGame('실패',[])"));assert.equal(a.run('(state.customGames||[]).length'),0);
 a.run("localStorage.setItem=write;globalThis.id=createCustomGame('성공',[newCatalogRule()]);renderAll();localStorage.setItem=()=>{throw Error('full')}");a.click('[data-rule-complete]');assert.equal(a.run('totals(id).gold||0'),0);
 a.run('localStorage.setItem=write');a.click('[data-rule-complete]');assert.equal(a.run('totals(id).gold'),50);
});
test('custom reset, daily rollover and global reset include custom games',()=>{
 const a=start();a.run("globalThis.id=createCustomGame('누적',[newCatalogRule()]);renderAll()");a.click('[data-rule-complete]');a.nextDay();a.run('refreshAllGames()');assert.equal(a.run('data().ruleProgress[data().ruleCatalog[0].id].missions.some(m=>m.done)'),false);
 assert.equal(a.run('totals(id).gold'),50);a.run('resetGame(id);renderAll()');assert.equal(a.run('data().profile.registeredAt'),null);a.click('#beginSetup');assert.ok(a.document.querySelector('#customGameName'));
 a.run('closeDialog();resetAllGames();renderAll()');assert.equal(a.run('state.games[id].profile.registeredAt'),null);
});
