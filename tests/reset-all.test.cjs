const test=require('node:test'),assert=require('node:assert/strict'),{start}=require('./harness.cjs');
test('main reset button asks for confirmation and cancellation preserves every game',()=>{
 const a=start();a.run("award('mtga','example',{gold:750});state.activeGame='overview';renderAll()");
 const before=a.run('JSON.stringify(state)');
 a.click('#resetAllGames');assert.ok(a.document.querySelector('#confirmAllGamesReset'));
 assert.equal(a.run('JSON.stringify(state)'),before);
 a.click('#closeManagerDialog');assert.equal(a.run('JSON.stringify(state)'),before);
});
test('confirmed all-game reset clears rewards, progress, alerts and backups across restart',()=>{
 const a=start();a.run("for(const [id] of GAMES){award(id,'example',{gold:100});state.games[id].profile.pendingAlerts=['test'];state.games[id].profile.spending.push({amount:100,currency:'KRW'});}localStorage.setItem('deckroom-backup-v1',JSON.stringify(state));localStorage.setItem('deckroom-corrupt-backup','old');state.tray=true;state.activeGame='overview';renderAll()");
 a.click('#resetAllGames');a.click('#confirmAllGamesReset');
 assert.equal(a.run("GAMES.every(([id])=>JSON.stringify(state.games[id])===JSON.stringify(freshGame()))"),true);
 assert.equal(a.run('state.tray'),true);
 assert.equal(a.run("localStorage.getItem('deckroom-backup-v1')"),null);
 assert.equal(a.run("localStorage.getItem('deckroom-corrupt-backup')"),null);
 assert.equal(a.document.querySelectorAll('[data-register]').length,9);
 const reopened=start(a.saved());
 assert.equal(reopened.document.querySelectorAll('[data-register]').length,9);
 assert.equal(reopened.run('Object.values(state.games).some(g=>g.profile.pendingAlerts?.length)'),false);
});
