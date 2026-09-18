function openDialog(title,body){let el=$('#managerDialog');if(!el){el=document.createElement('div');el.id='managerDialog';el.className='difficulty-modal';$('body').appendChild(el);}el.innerHTML=`<div class="manager-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><div id="dialogContent">${body}</div><button id="closeManagerDialog">취소 / 닫기</button></div>`;el.hidden=false;$('#closeManagerDialog').addEventListener('click',closeDialog);const first=el.querySelector('input')||el.querySelector('button');first?.focus({preventScroll:true});el.querySelector('.manager-dialog').scrollTop=0;}
function closeDialog(){if($('#managerDialog'))$('#managerDialog').hidden=true;}
function field(key,label,value=0,max=99999,type='number'){return `<label>${label}<input data-field="${key}" type="${type}" value="${escapeHtml(value)}" ${type==='number'?`min="0" max="${max}" step="${['amount','initialCash'].includes(key)?'0.01':'1'}"`:''} /></label>`;}
function values(){const v={};$$('[data-field]').forEach(el=>{const numeric=el.getAttribute('type')==='number';const n=numeric?Number(el.value):el.value;if(numeric&&((!Number.isFinite(n)||(!['amount','initialCash'].includes(el.dataset.field)&&!Number.isInteger(n)))||n<0||n>Number(el.getAttribute('max'))))throw Error('입력 범위를 확인하세요.');v[el.dataset.field]=n;});$$('[data-mask]').forEach(el=>{v[el.dataset.mask] ||= [];if(el.checked)v[el.dataset.mask].push(Number(el.value));});return v;}
function mountRuleEditor(...args){return mountUniversalEditor(...args);}
function openCatalogEditor(gameId){
 const g=state.games[gameId];if(gameId==='kards')kardsRules(g);
 openDialog('규칙 구성',`<label class="check-field"><input type="checkbox" id="catalogBonusActive" ${g.profile.pass.active?'checked':''} />추가 공급 활성</label><div id="catalogMount"></div><button id="saveRuleCatalog">규칙 저장</button><p id="ruleSaveResult" role="status"></p>${isCustomGame(gameId)?'<button id="resetCustomGame">이 게임 초기화</button>':''}`);
 const read=mountRuleEditor(catalogRules(g),$('#catalogMount'));
 $('#saveRuleCatalog').addEventListener('click',()=>{try{updateCatalog(gameId,read(),{bonusActive:$('#catalogBonusActive').checked});}catch(e){$('#ruleSaveResult').textContent=e.message;return;}closeDialog();renderAll();});
 $('#resetCustomGame')?.addEventListener('click',()=>{openDialog('게임 초기화','<p>이 게임의 규칙, 진행도와 보상 기록을 삭제하고 최초 설정으로 돌아갑니다.</p><button id="confirmCustomReset">초기화</button>');$('#confirmCustomReset').addEventListener('click',()=>{try{resetGame(gameId);closeDialog();renderAll();openCustomSetup(gameId);}catch(e){toast(e.message);}});});
}
function cloneCatalog(rules){
 const events=new Map(rules.filter(r=>r.event).map(r=>[r.event,'event-'+crypto.randomUUID()]));const copy=structuredClone(rules),ruleIds=new Map(copy.map(r=>[r.id,'rule-'+crypto.randomUUID()]));
 for(const r of copy){r.id=ruleIds.get(r.id);r.source='user';if(r.event)r.event=events.get(r.event);delete r.controls;delete r.initialReceived;delete r.initialValue;delete r.initialCount;const ids=new Map();for(const x of r.rewards){const old=x.id;x.id='reward-'+crypto.randomUUID();ids.set(old,x.id);}for(const q of r.quests||[]){q.id='quest-'+crypto.randomUUID();q.rewardIds=q.rewardIds.map(id=>ids.get(id));}for(const l of r.links||[])l.target=ruleIds.get(l.target)||l.target;if(r.stopAt)r.stopAt=ruleIds.get(r.stopAt)||r.stopAt;r.requires=(r.requires||[]).map(id=>ruleIds.get(id)||id);}
 return copy;
}
function createCustomGame(name,rules,existingId,profileOptions={}){
 if(existingId&&(!isCustomGame(existingId)&&!CATALOG_PRESETS.includes(existingId)&&existingId!=='kards'||state.games[existingId].profile.registeredAt))throw Error('최초 설정 대상이 아닙니다.');name=name.trim();if(!name||name.length>60)throw Error('게임 이름은 1~60자로 입력하세요.');validateRuleCatalog(rules);
 const id=existingId||'game-'+crypto.randomUUID(),g=freshGame();g.ruleCatalog=structuredClone(rules);g.catalogVersion=1;g.profile.registeredAt=new Date().toISOString();
 if(profileOptions.registeredAt)g.profile.registeredAt=profileOptions.registeredAt;g.profile.pass.active=!!profileOptions.paid;g.profile.pass.end=g.ruleCatalog.find(r=>r.type==='pass')?.end||'';
 const before=structuredClone(state);try{state.games[id]=g;state.customGames ||= [];if(!GAMES.some(x=>x[0]===id)&&!state.customGames.some(x=>x[0]===id))state.customGames.push([id,name,'◇','lime']);else if(isCustomGame(id))state.customGames.find(x=>x[0]===id)[1]=name;
  catalogAdapter(g).setBonus?.(g.profile.pass.active);syncCatalog(g);initializeCatalogProgress(id);initializeCatalogRewards(id);
  state.activeGame=id;save();
 }catch(e){for(const key of Object.keys(state))delete state[key];Object.assign(state,before);throw e;}
 if(!GAMES.some(x=>x[0]===id))GAMES.push(state.customGames.find(x=>x[0]===id));else GAMES.find(x=>x[0]===id)[1]=name;
 return id;
}
function openCustomSetup(existingId){
 openDialog('게임 구성 만들기',`<div class="form-grid"><label>게임 이름<input id="customGameName" value="${escapeHtml(GAMES.find(x=>x[0]===existingId)?.[1]||'')}" /></label><label>시작 구성<select id="catalogPreset"><option value="empty">빈 구성</option><option value="preset">KARDS 기본 구성</option>${CATALOG_PRESETS.map(id=>`<option value="builtin:${id}">${escapeHtml(GAMES.find(x=>x[0]===id)[1])} 기본 구성</option>`).join('')}${GAMES.filter(([id])=>state.games[id]?.ruleCatalog?.length).map(([id,name])=>`<option value="${id}">${escapeHtml(name)}의 규칙 복사</option>`).join('')}</select></label></div><button id="loadCatalogPreset">구성 가져오기</button>${catalogProfileFields()}<div id="customCatalogMount"></div><button id="createCustomGame">구성 저장</button><p id="customGameError" role="status"></p>`);
 let read=mountRuleEditor([],$('#customCatalogMount'),true);
 $('#loadCatalogPreset').addEventListener('click',()=>{const choice=$('#catalogPreset').value;$('#customCatalogMount').innerHTML='';read=mountRuleEditor(choice==='empty'?[]:cloneCatalog(choice==='preset'?defaultKardsRules():choice.startsWith('builtin:')?presetCatalog(choice.slice(8)):catalogRules(state.games[choice])),$('#customCatalogMount'),true);});
 $('#createCustomGame').addEventListener('click',()=>{try{createCustomGame($('#customGameName').value,read(),existingId,readCatalogProfile());}catch(e){$('#customGameError').textContent=e.message;return;}closeDialog();renderAll();});
}
function openSetup(id){return isCustomGame(id)?openCustomSetup(id):openPresetSetup(id);}
