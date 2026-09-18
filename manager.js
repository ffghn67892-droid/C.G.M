// Renderer shell: keeps the selected game, shell UI, and periodic refresh separate from game rules.
function renderCurrentGame(updateNavigation=true){
 renderUniversalGame(state.activeGame);if(updateNavigation)renderNavigation();
}
function renderManaged(){
 synchronizeScheduledGames();renderNavigation();clearQuestSummary();
 if(state.activeGame==='kards')kardsRules();
 $('#resetScheduleInfo').textContent=state.activeGame==='overview'?'한국 시간(KST)':catalogEnabled(state.activeGame)?[...new Set(catalogRules(data()).map(ruleScheduleText))].join(' · ')||'한국 시간(KST)':scheduleLabel(state.activeGame);
 let toolbar=$('#gameToolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.id='gameToolbar';$('.page-heading').appendChild(toolbar);}toolbar.innerHTML='';
 if(state.activeGame==='overview'){renderOverview();save();return true;}
 const id=state.activeGame,p=data().profile;
 if(!p.registeredAt){$('#questList').innerHTML='<div class="setup-empty"><h3>최초 설정</h3><p>현재 진행도와 이미 받은 보상을 등록하세요.</p><button id="beginSetup">설정 시작</button></div>';$('#beginSetup').addEventListener('click',()=>isCustomGame(id)?openCustomSetup(id):openSetup(id));save();return true;}
 toolbar.innerHTML=`<button id="gameSettings">상세 설정</button><button id="gameMute">${p.mutedUntil>Date.now()?'오늘 알람 꺼짐':'오늘의 알람 끄기'}</button><button id="gameAlarmStop">알람 중지</button>`;
 $('#gameSettings').addEventListener('click',()=>openSettings(id));$('#gameMute').addEventListener('click',()=>muteGame(id));$('#gameAlarmStop').addEventListener('click',()=>{acknowledge(id);save();toast('알람을 중지했습니다.');});
 if(id==='kards'||catalogEnabled(id)){const button=document.createElement('button');button.id='editKardsRules';button.textContent='퀘스트·보상 규칙';button.addEventListener('click',()=>openCatalogEditor(id));toolbar.appendChild(button);}
 renderCurrentGame(false);save();return true;
}
function refreshAllGames(force=false){
 if(synchronizeScheduledGames(force))refreshViewPending=true;
 if(refreshViewPending&&(!$('#managerDialog')||$('#managerDialog').hidden)){refreshViewPending=false;renderAll();}
 playAlarm();
}
function refreshActiveQuests(){return refreshAllGames();}
function updateResourceTimers(){updateCatalogClocks();}
function attachRendererShell(){
 setInterval(()=>{refreshAllGames();updateResourceTimers();},1000);
 window.addEventListener('focus',()=>refreshAllGames(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAllGames(true);});
 window.deckroom?.onResume(()=>refreshAllGames(true));window.deckroom?.setTray(!!state.tray);
 document.addEventListener('keydown',e=>{const modal=$('#managerDialog');if(!modal||modal.hidden)return;if(e.key==='Escape')closeDialog();if(e.key==='Tab'){const elements=[...modal.querySelectorAll('*')].filter(x=>['BUTTON','INPUT','SELECT','TEXTAREA'].includes(x.tagName.toUpperCase())&&!x.hasAttribute('disabled')&&!x.closest('[hidden]'));const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
}
// Legacy filename, but this is now the only renderer bootstrap and its dependency boundary.
const RENDERER_DEPENDENCIES=Object.freeze(['migrateStore','freshGame','renderManaged','attachRendererShell','renderNavigation','syncGame','renderUniversalGame','synchronizeScheduledGames']);
function bootRenderer(){
 const missing=RENDERER_DEPENDENCIES.filter(name=>typeof globalThis[name]!=='function');
 if(missing.length)throw Error(`렌더러 의존성을 불러오지 못했습니다: ${missing.join(', ')}`);
 migrateStore();
 for(const[id]of GAMES)state.games[id] ||= freshGame();
 attachRendererShell();
 renderAll();
}
bootRenderer();
