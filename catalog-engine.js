// Rules contain data only. This module never branches on a game name.
const CATALOG_TYPES={quest:'퀘스트',claim:'정기 수령',goal:'특정 목표',resource:'충전 자원',pass:'패스',counter:'기록'};
function setCatalogBonus(g,active){const adapter=catalogAdapter(g),was=adapter.bonus();g.profile.pass.active=!!active;adapter.setBonus?.(!!active);if(active&&!was)for(const r of catalogRules(g)){const p=ruleProgress(g,r),period=rulePeriod(r);if(r.type==='quest'&&r.paidOnly&&!p.missions.length&&!p.completed.length)catalogSpawn(r,p,r.spawnCount);if(r.type==='quest'&&r.passExtra&&p.bonusPeriod!==period){catalogSpawn(r,p,r.passExtra);p.bonusPeriod=period;}}}
function catalogEnabled(id){return isCustomGame(id)||state.games[id]?.catalogVersion===1;}
function validateCatalog(rules){
 if(!Array.isArray(rules)||rules.length>100)throw Error('규칙은 0~100개로 설정하세요.');
 const ids=new Set(),validId=id=>typeof id==='string'&&/^[\w-]+$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
 const num=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 const bundle=b=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.entries(b).every(([k,v])=>k.trim()&&!['__proto__','constructor','prototype'].includes(k)&&num(v,0,1e9));
 for(const r of rules){
  if(!validId(r.id)||ids.has(r.id))throw Error('규칙 ID가 중복되거나 올바르지 않습니다.');ids.add(r.id);
  if(!CATALOG_TYPES[r.type]||!r.label?.trim())throw Error('유형과 이름을 확인하세요.');
  const s=r.schedule,time=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if(!s||!['daily','weekly','intervalDays','slots','monthly','once'].includes(s.kind)||!time(s.time))throw Error('갱신 주기와 시각을 확인하세요.');
  if(s.kind==='weekly'&&!num(s.weekday,0,6))throw Error('요일을 확인하세요.');
  if(s.kind==='intervalDays'&&(!num(s.days,1,3650)||!/^\d{4}-\d{2}-\d{2}$/.test(s.anchor)||!Number.isFinite(Date.parse(s.anchor))||new Date(s.anchor).toISOString().slice(0,10)!==s.anchor))throw Error('주기와 기준 날짜를 확인하세요.');
  if(s.kind==='slots'&&(!s.times?.length||s.times.length>24||s.times.some(t=>!time(t))||new Set(s.times).size!==s.times.length))throw Error('하루의 갱신 시각을 확인하세요.');
  if(!num(r.spawnCount,1,100)||!num(r.capacity,1,10000)||r.capacity<r.spawnCount||!num(r.passExtra,0,100))throw Error('생성 수와 상한을 확인하세요.');
  if(!Array.isArray(r.rewards)||r.rewards.length>100)throw Error('보상 목록을 확인하세요.');const rewards=new Set();
  for(const x of r.rewards){if(!validId(x.id)||rewards.has(x.id)||!x.label?.trim()||!bundle(x.resources))throw Error('보상 이름·재화·수량을 확인하세요.');rewards.add(x.id);}
  if(['quest','claim'].includes(r.type)&&!r.rewards.length)throw Error('보상을 하나 이상 추가하세요. 보상이 미정이면 수량 없이 기록할 수 있습니다.');
  if(r.type==='quest'){const qids=new Set();if(!r.quests?.length||r.quests.length>100)throw Error('퀘스트 목록을 확인하세요.');for(const q of r.quests){if(!validId(q.id)||qids.has(q.id)||!q.label?.trim()||!q.rewardIds?.length||q.rewardIds.some(x=>!rewards.has(x))||!num(q.points||0,0,10000))throw Error('퀘스트 내용·보상·포인트를 확인하세요.');qids.add(q.id);}if(r.unique&&r.capacity>r.quests.length)throw Error('중복 없는 퀘스트의 상한은 종류 수 이하여야 합니다.');}
  if(['goal','pass','counter'].includes(r.type)&&!num(r.target,1,1000000))throw Error('목표 상한을 확인하세요.');
  if((r.steps||[]).length>10000||r.repeat&&Math.ceil((r.target-r.repeat.from+1)/r.repeat.every)>10000)throw Error('구간 보상은 최대 10000개입니다.');const steps=new Set();for(const x of r.steps||[]){if(!num(x.at,1,r.target||100000)||steps.has(x.at)||!bundle(x.free||{})||!bundle(x.paid||{}))throw Error('구간 보상의 도달값·수량을 확인하세요.');steps.add(x.at);}
  if(r.repeat&&(!num(r.repeat.from,1,r.target)||!num(r.repeat.every,1,r.target)||!bundle(r.repeat.free||{})||!bundle(r.repeat.paid||{})))throw Error('반복 보상을 확인하세요.');
  if(r.type==='resource'&&(!num(r.intervalMinutes,1,525600)||!num(r.recoverAmount,1,r.capacity)||!bundle(r.consumeRewards||{})))throw Error('자원 회복 간격·수량을 확인하세요.');
  if(r.monthlyLimit!==undefined&&!num(r.monthlyLimit,1,1000))throw Error('월간 수령 상한을 확인하세요.');
  if(r.completionLimit!==undefined&&!num(r.completionLimit,1,r.capacity))throw Error('완료 목표 수를 확인하세요.');
  for(const key of ['start','end'])if(r[key]&&!Number.isFinite(Date.parse(r[key])))throw Error('시작·종료일을 확인하세요.');
  if(r.start&&r.end&&Date.parse(r.start)>=Date.parse(r.end))throw Error('종료일은 시작일 이후여야 합니다.');
  if(r.expense&&(!r.expense.currency?.trim()||!num(r.expense.amount,1,1e9)))throw Error('구매 재화와 수량을 확인하세요.');
 }
 const edges=new Map(rules.map(r=>[r.id,[]]));
 for(const r of rules){for(const l of r.links||[]){if(!ids.has(l.target)||!['complete','progress','consume'].includes(l.event)||!['one','points','amount','date'].includes(l.value))throw Error('연동 대상과 방식을 확인하세요.');if(!['goal','pass','counter'].includes(rules.find(x=>x.id===l.target).type))throw Error('연동 대상은 목표·패스·기록이어야 합니다.');edges.get(r.id).push(l.target);}if(new Set((r.links||[]).map(l=>l.target+'/'+l.event)).size!==(r.links||[]).length)throw Error('같은 연동이 중복되었습니다.');for(const id of [r.stopAt,...(r.requires||[])].filter(Boolean))if(!ids.has(id))throw Error('조건 대상이 없거나 삭제되었습니다.');}
 const active=new Set(),done=new Set();function visit(id){if(active.has(id))throw Error('순환 연동은 사용할 수 없습니다.');if(done.has(id))return;active.add(id);for(const n of edges.get(id))visit(n);active.delete(id);done.add(id);}ids.forEach(visit);return rules;
}
function catalogPeriod(r,now=new Date()){
 const s=r.schedule;if(s.kind==='once')return 0;
 if(s.kind==='monthly'){const d=new Date(now.getTime()+9*HOUR_MS);return d.getUTCFullYear()*12+d.getUTCMonth();}
 if(s.kind==='slots'){const times=[...s.times].sort(),day=periodAt(0,0,now),minutes=new Date(now.getTime()+9*HOUR_MS).getUTCHours()*60+now.getUTCMinutes();let i=times.findLastIndex(t=>{const[h,m]=t.split(':').map(Number);return h*60+m<=minutes;});return i<0?(day-1)*times.length+times.length-1:day*times.length+i;}
 const [h,m]=s.time.split(':').map(Number),day=periodAt(h,m,now);if(s.kind==='daily')return day;if(s.kind==='weekly')return day-((day+4-s.weekday)%7+7)%7;
 const anchor=Math.floor(Date.parse(s.anchor)/DAY_MS);return anchor+Math.floor((day-anchor)/s.days)*s.days;
}
function catalogScheduleText(r){const s=r.schedule;return s.kind==='once'?'기간 내 유지':s.kind==='monthly'?'매월 1일 KST':s.kind==='slots'?s.times.join(' / ')+' KST':`${s.kind==='daily'?'매일':s.kind==='weekly'?['일','월','화','수','목','금','토'][s.weekday]+'요일':s.days+'일마다'} ${s.time} KST`;}
function catalogActive(g,r,now=new Date()){return r.enabled!==false&&(!r.start||now.getTime()>=Date.parse(r.start))&&(!r.end||now.getTime()<Date.parse(r.end))&&(!r.paidOnly||(g.profile.pass.active&&(!g.profile.pass.end||now.getTime()<Date.parse(g.profile.pass.end))));}
function catalogDone(g,r){const p=ruleProgress(g,r);if(r.type==='quest')return p.missions?.filter(m=>m.done).length>=(r.completionLimit||r.capacity);if(r.type==='claim')return (p.claimed||0)>=ruleClaimLimit(g,r)||(r.monthlyLimit&&(p.monthCount||0)>=r.monthlyLimit);return (p.value||0)>=(r.target||r.capacity);}
function catalogBlocked(g,r){return (r.stopAt&&catalogDone(g,catalogRules(g).find(x=>x.id===r.stopAt)))||(r.requires||[]).some(id=>!catalogDone(g,catalogRules(g).find(x=>x.id===id)));}
function catalogMission(r,index=0){const q=r.quests[index%r.quests.length];return {id:crypto.randomUUID(),label:q.label,templateId:q.id,points:q.points||0,done:false,rewardChoices:structuredClone(r.rewards.filter(x=>q.rewardIds.includes(x.id)))};}
function catalogSpawn(r,p,count){p.missions ||= [];for(let i=0;i<Math.min(count,r.capacity);i++){if(p.missions.length>=r.capacity)break;const index=r.unique?r.quests.findIndex(q=>!p.missions.some(m=>m.templateId===q.id)):((p.seed||0)%r.quests.length);if(index<0)break;p.missions.push(catalogMission(r,index));p.seed=(p.seed||0)+1;}}
function syncUniversalCatalog(g,now=new Date()){
 for(const r of catalogRules(g)){
  const p=ruleProgress(g,r),period=rulePeriod(r,now);p.missions ||= [];p.completed ||= [];
  if(r.type==='resource'){if(p.value===undefined)p.value=r.capacity;if(p.clock===undefined)p.clock=now.getTime();if(p.value<r.capacity){const slots=Math.max(0,Math.floor((now.getTime()-p.clock)/(r.intervalMinutes*60000)));if(slots){p.value=Math.min(r.capacity,p.value+slots*r.recoverAmount);p.clock+=slots*r.intervalMinutes*60000;}}continue;}
  const old=p.period??p.resetPeriod,fresh=old===undefined,elapsed=fresh?1:Math.max(0,Math.floor((period-old)/ruleInterval(r)));
  if(fresh||elapsed){
   if(r.type==='quest'){
    if(!fresh){p.missions=r.replace?[]:p.missions.filter(m=>!m.done);p.completed=[];}
    if(catalogActive(g,r,now))catalogSpawn(r,p,elapsed*(r.spawnCount+(catalogAdapter(g).bonus()?r.passExtra:0)));
   }else if(r.type==='claim')p.claimed=0;
   else {p.value=0;p.claims=[];p.dates=[];}
   p.period=period;p.resetPeriod=period;p.resetSchedule='kst-v1';p.generalDate=String(period);
  }
  const month=catalogPeriod({schedule:{kind:'monthly'}},now);if(p.month!==month){p.month=month;p.monthCount=0;}
  if(g.profile.pass.end&&now.getTime()>=Date.parse(g.profile.pass.end)){g.profile.pass.active=false;catalogAdapter(g).setBonus?.(false);}
  catalogAdapter(g).flush?.(r,p);
 }
 return g;
}
const catalogStepCache=new WeakMap();
function catalogSteps(r){const signature=JSON.stringify([r.target,r.steps,r.repeat]);const cached=catalogStepCache.get(r);if(cached?.signature===signature)return cached.rows;const rows=[...(r.steps||[])],used=new Set(rows.map(x=>x.at));if(r.repeat)for(let n=r.repeat.from;n<=r.target;n+=r.repeat.every)if(!used.has(n))rows.push({...r.repeat,at:n});rows.sort((a,b)=>a.at-b.at);catalogStepCache.set(r,{signature,rows});return rows;}
function catalogAwardSteps(gameId,r,p,initial=false){p.claims ||= [];const claimed=new Set(p.claims);for(const step of catalogSteps(r)){if(step.at>p.value)break;for(const track of ['free','paid']){if(track==='paid'&&(!state.games[gameId].profile.pass.active||!Object.keys(step.paid||{}).length))continue;const key=step.at+'/'+track;if(claimed.has(key))continue;award(gameId,`rule/${r.id}/${p.period}/step/${key}`,step[track]||{},r.label,initial);p.claims.push(key);claimed.add(key);}}}
function catalogProgress(gameId,r,amount,initial=false){const g=state.games[gameId],p=ruleProgress(g,r),previous=p.value||0;if(!catalogActive(g,r)||catalogBlocked(g,r))return false;p.value=Math.min(r.target,previous+amount);catalogAwardSteps(gameId,r,p,initial);if(r.type==='pass')g.profile.pass.level=p.value;if(r.profileXp)g.profile.pass.xp=p.value;if(p.value>previous){if(!initial)activity(gameId);catalogEmit(gameId,r,'progress',{amount:p.value-previous},initial);}return p.value>previous;}
function catalogEmit(gameId,r,event,detail={},initial=false){for(const l of r.links||[]){if(l.event!==event)continue;const g=state.games[gameId],target=catalogRules(g).find(x=>x.id===l.target),p=ruleProgress(g,target);if(l.value==='date'){p.dates ||= [];const date=kstDateKey();if(p.dates.includes(date))continue;p.dates.push(date);}catalogProgress(gameId,target,l.value==='points'?(detail.points||0):l.value==='amount'?(detail.amount||1):1,initial);}}
function recordCatalogExpense(g,r){if(r.expense)g.profile.currencySpending.push({item:r.label,amount:r.expense.amount,currency:r.expense.currency,at:new Date().toISOString()});}
function catalogAction(gameId,ruleId,action,options={}){
 return runCatalogAction(gameId,g=>{
  syncCatalog(g);const r=catalogRules(g).find(x=>x.id===ruleId);if(!r||!catalogActive(g,r)||catalogBlocked(g,r)||(options.period!==undefined&&rulePeriod(r)!==options.period))return false;const p=ruleProgress(g,r);
  if(action==='complete'){
   if(!['quest','claim'].includes(r.type))return false;
   const m=r.type==='quest'?p.missions.find(x=>x.id===options.mission):null;
   if(r.type==='quest'&&(!m||m.done||(r.completionLimit&&p.missions.filter(x=>x.done).length>=r.completionLimit)))return false;
   if(r.type==='claim'&&catalogDone(g,r))return false;
   const reward=(m?missionRewards(r,m):r.rewards).find(x=>x.id===options.reward);if(!reward)return false;
   const count=p.claimed||0;if(!award(gameId,catalogAdapter(g).key(r,m,rulePeriod(r),count),reward.resources,r.label,!!options.initial))return false;
   recordCatalogExpense(g,r);
   if(m){m.done=true;m.rewardReceived=structuredClone(reward.resources);p.completed.push(m.id);if(r.removeCompleted)p.missions=p.missions.filter(x=>x!==m);}else{p.claimed=count+1;p.monthCount=(p.monthCount||0)+1;}
   catalogAdapter(g).flush?.(r,p);catalogEmit(gameId,r,'complete',{points:m?.points||0},!!options.initial);return true;
  }
  if(action==='progress'){
   if(!['goal','pass','counter'].includes(r.type)||!Number.isSafeInteger(options.amount)||options.amount<0||options.amount>r.target)return false;
   if(r.event){let changed=false;for(const target of catalogRules(g).filter(x=>x.event===r.event))changed=catalogProgress(gameId,target,options.amount)||changed;return changed;}
   return catalogProgress(gameId,r,options.amount);
  }
  if(action==='consume'){
   if(r.type!=='resource'||p.value<1)return false;if(p.value===r.capacity)p.clock=Date.now();p.value--;p.consumed=(p.consumed||0)+1;award(gameId,`rule/${r.id}/consume/${p.consumed}`,r.consumeRewards||{},r.label);catalogEmit(gameId,r,'consume');return true;
  }
  if(action==='spawn'){if(r.type!=='quest'||p.missions.length>=r.capacity)return false;catalogSpawn(r,p,options.amount||r.spawnCount);return true;}
  if(action==='remove'){if(r.type!=='quest')return false;const i=p.missions.findLastIndex(x=>!x.done);if(i<0)return false;p.missions.splice(i,1);return true;}
  if(action==='choose'){if(r.type!=='quest')return false;const m=p.missions.find(x=>x.id===options.mission),i=r.quests.findIndex(x=>x.id===options.template);if(!m||m.done||i<0||(r.unique&&p.missions.some(x=>x!==m&&x.templateId===options.template)))return false;const fresh=catalogMission(r,i);Object.assign(m,fresh,{id:m.id});return true;}
  return false;
 });
}
function universalStatus(g){let red=false,yellow=false,remaining=false;for(const r of catalogRules(g)){if(!catalogActive(g,r)||catalogBlocked(g,r)||r.attention==='none')continue;const p=ruleProgress(g,r);const n=r.type==='quest'?p.missions.filter(m=>!m.done).length:r.type==='resource'?p.value:catalogDone(g,r)?0:1;if(!n)continue;if(r.type==='quest'&&r.completionLimit&&catalogDone(g,r))continue;remaining=true;red ||= r.attention==='urgent'||(r.type==='resource'&&n>=r.capacity)||(r.type==='quest'&&!r.replace&&n>=r.capacity);yellow ||= r.attention==='warning'||(r.type==='quest'&&!r.replace&&n>=Math.ceil(r.capacity*2/3));}return {color:red?'urgent':yellow?'warning':remaining?'pending':'done',label:remaining?'!':'✓'};}
