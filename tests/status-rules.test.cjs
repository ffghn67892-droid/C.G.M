const test=require('node:test');
const assert=require('node:assert/strict');
const {start}=require('./harness.cjs');

test('Snap passive weekly challenge does not warn when nothing is actionable',()=>{
 const a=start();a.select('snap');
 a.run("data().generalMissions=[];data().weeklyCount=0;award('snap',`free-credit/${snapSlot()}`,{credits:25});award('snap',`free-token/${dailyPeriod('snap')}`,{tokens:50});award('snap',`web/${dailyPeriod('snap')}`,{credits:100});renderAll()");
 assert.equal(a.run("gameStatus('snap').color"),'done');
 assert.equal(a.document.querySelector('[data-game="snap"] .status-dot').textContent,'✓');
 a.run("data().generalMissions=[{id:'pending',difficulty:'normal'}]");
 assert.equal(a.run("gameStatus('snap').color"),'pending');
 a.run("data().generalMissions=Array.from({length:6},(_,i)=>({id:String(i)}))");
 assert.equal(a.run("gameStatus('snap').color"),'urgent');
});

test('MTGA ignores weekly wins alone but keeps daily quest and win priorities',()=>{
 const a=start();a.select('mtga');
 a.run('data().mtga.dailyQueue.missions=[];data().mtga.dailyWins=15;data().mtga.weeklyWins=0;renderAll()');
 assert.equal(a.run("gameStatus('mtga').color"),'done');
 assert.equal(a.document.querySelector('[data-game="mtga"] .status-dot').textContent,'✓');
 a.run("data().mtga.dailyQueue.missions=[{id:'one'},{id:'two'}]");
 assert.equal(a.run("gameStatus('mtga').color"),'warning');
 a.run('data().mtga.dailyQueue.missions=[];data().mtga.dailyWins=14');
 assert.equal(a.run("gameStatus('mtga').color"),'urgent');
});

test('Direct Might and Hearthstone weekly quests still show yellow',()=>{
 const a=start();a.select('might-magic');
 a.run('data().might.dailyQueue.missions=[];data().might.loginClaimed=true;data().might.passActive=false;data().might.weekDone=[[0,1,2],[0,1,2],[0,1,2],[0,1,2]];data().might.weeklyDone=[0,1]');
 assert.equal(a.run("gameStatus('might-magic').color"),'warning');
 a.run('data().might.weeklyDone=[0,1,2]');
 assert.equal(a.run("gameStatus('might-magic').color"),'done');
 a.select('hearthstone');
 a.run("data().dailyQueue.missions=[];data().weeklyDone=[0,1];award('hearthstone',`brawl/${weeklyPeriod('hearthstone')}`,{'시즌 카드팩':1})");
 assert.equal(a.run("gameStatus('hearthstone').color"),'warning');
 a.run('data().weeklyDone=[0,1,2]');
 assert.equal(a.run("gameStatus('hearthstone').color"),'done');
});
