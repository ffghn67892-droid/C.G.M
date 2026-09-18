const test=require('node:test'),assert=require('node:assert/strict'),{start}=require('./harness.cjs');
test('KARDS count controls persist 0–3 quests without granting rewards or activity',()=>{
 const a=start();a.select('kards');const before=a.run("JSON.stringify(totals('kards'))");
 for(let i=0;i<4;i++)a.click('[data-kards-count="minus"]');
 assert.equal(a.document.querySelectorAll('.kards-list .empty-slot').length,3);
 for(let n=1;n<=3;n++){a.click('[data-kards-count="plus"]');assert.equal(a.document.querySelectorAll('.kards-row').length,n);assert.equal(a.document.querySelectorAll('.kards-list .empty-slot').length,3-n);}
 a.click('[data-kards-count="plus"]');assert.equal(a.run('data().kards.missions.length'),3);
 assert.equal(a.run("JSON.stringify(totals('kards'))"),before);
 assert.equal(a.run('data().profile.activityDays.length'),0);
 const reopened=start(a.saved());assert.equal(reopened.document.querySelectorAll('.kards-row').length,3);
});
test('KARDS minus preserves completed quests and earned rewards until daily reset',()=>{
 const a=start();a.select('kards');a.click('[data-kards-count="plus"]');a.click('[data-kards-complete="50"]');
 a.click('[data-kards-count="minus"]');a.click('[data-kards-count="minus"]');
 assert.equal(a.run('data().kards.missions.length'),1);assert.equal(a.run('data().kards.missions[0].done'),true);
 assert.equal(a.run("totals('kards').gold"),50);assert.equal(a.document.querySelectorAll('.kards-list .empty-slot').length,2);
 a.click('[data-kards-count="plus"]');a.click('[data-kards-count="plus"]');a.click('[data-kards-count="plus"]');
 assert.equal(a.run('data().kards.missions.length'),3);
 a.nextDay();a.run('refreshActiveQuests()');assert.equal(a.run('data().kards.missions.filter(m=>m.done).length'),0);assert.equal(a.run("totals('kards').gold"),50);
});
test('KARDS reward list is collapsed by default and other games retain their summary',()=>{
 const a=start();a.select('kards');a.click('[data-kards-complete="50"]');
 const details=a.document.querySelector('.kards-earned');assert.ok(details);assert.equal(details.hasAttribute('open'),false);
 assert.match(details.textContent,/누적 획득 목록/);assert.match(details.textContent,/골드 50/);
 assert.equal(a.document.querySelector('#questSummary').hidden,true);
 a.select('mtga');assert.equal(a.document.querySelector('#questSummary').hidden,false);
});
test('KARDS reward buttons complete immediately with the chosen amount',()=>{
 const a=start();a.select('kards');
 assert.equal(a.document.querySelectorAll('[data-kards-complete]').length,2);
 assert.equal(a.document.querySelectorAll('.kards-check').length,0);
 a.click('[data-kards-complete="60"]');
 assert.equal(a.run("totals('kards').gold"),60);
 assert.equal(a.run('data().kards.missions[0].rewardGold'),60);
 assert.equal(a.document.querySelectorAll('[data-kards-complete]').length,0);
 assert.equal(a.document.querySelector('.kards-complete-state').textContent,'완료됨');
});
