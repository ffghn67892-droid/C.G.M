function muteGame(id) {
  if (isCustomGame(id)) {
    state.games[id].profile.mutedUntil = Date.now() + DAY_MS;
    acknowledge(id);
    save();
    renderAll();
    return;
  }
  const p = state.games[id].profile;
  const hour = RESET_SCHEDULES[id].daily ?? 0;
  p.mutedUntil = (periodAt(hour) + 1) * DAY_MS - (9 - hour) * HOUR_MS;
  acknowledge(id);
  save();
  renderAll();
}
function statusBadgeText(status) {
  return status.color === 'done' || status.color === 'setup' ? status.label : `!${status.count}`;
}
function renderNavigation() {
  $('body').classList.toggle('shadowverse-view', state.activeGame === 'shadowverse');
  const registered = GAMES.filter(([id]) => state.games[id]?.profile?.registeredAt);
  $('#gameSwitcher').innerHTML =
    `<button class="game-tab ${state.activeGame === 'overview' ? 'active' : ''}" data-game="overview" role="tab" aria-selected="${state.activeGame === 'overview'}"><span class="game-tab-mark lime">⌂</span><span>메인</span></button>` +
    registered.map(([id, name, mark, color]) => {
      const status = gameStatus(id);
      return `<button class="game-tab ${state.activeGame === id ? 'active' : ''}" data-game="${id}" role="tab" aria-selected="${state.activeGame === id}"><span class="game-tab-mark ${color}">${mark}</span><span>${escapeHtml(name)}</span><b class="status-dot ${status.color} ${status.color === 'done' ? '' : 'status-dot-count'}" aria-label="${status.color === 'urgent' ? '오늘 확인' : status.color === 'warning' ? '진행 권장' : status.color === 'pending' ? '진행 중' : status.label}">${statusBadgeText(status)}</b></button>`;
    }).join('') +
    `<button class="game-tab" id="newGameTab" type="button"><span class="game-tab-mark lime">+</span><span>새 게임 만들기</span></button>`;
  $$('.game-tab[data-game]').forEach(b =>
    b.addEventListener('click', () => {
      state.activeGame = b.dataset.game;
      save();
      renderAll();
    })
  );
  $('#newGameTab').addEventListener('click', () => openCustomSetup());
}
function spendingText(p) {
  const sum = {};
  for (const row of p.spending) sum[row.currency] = (sum[row.currency] || 0) + row.amount;
  return (
    Object.entries(sum)
      .map(([k, v]) => `${v.toLocaleString()} ${k}`)
      .join(' · ') || '0'
  );
}
function renderOverview() {
  const searchTerm = ($('#gameSearch')?.value || '').trim();
  const registered = GAMES.filter(([id]) => state.games[id]?.profile?.registeredAt);
  $('#questList').innerHTML =
    `<div class="overview-heading"><h2>메인</h2><input type="search" id="gameSearch" placeholder="게임 검색" aria-label="게임 검색" value="${escapeHtml(searchTerm)}" /><label><input type="checkbox" id="trayOption" ${state.tray ? 'checked' : ''} />닫을 때 트레이에 유지</label></div>${
      registered.length
        ? `<div class="overview-grid">${registered.map(
            ([id, name]) => {
              const p = state.games[id].profile,
                s = gameStatus(id);
              const days = periodAt(0) - periodAt(0, 0, new Date(p.registeredAt));
              return `<article class="overview-card" data-game-name="${escapeHtml(name.toLowerCase())}"><h3><span class="status-dot ${s.color} ${s.color === 'done' ? '' : 'status-dot-count'}">${statusBadgeText(s)}</span>${escapeHtml(name)}</h3><dl><dt>현금 지출</dt><dd>${spendingText(p)}</dd><dt>이용 일수</dt><dd>경과 ${days}일 · 활동 ${p.activityDays.length}일</dd><dt>패스</dt><dd>${p.pass.active ? '활성' : '미활성'} · Lv. ${p.pass.level}</dd><dt>종료</dt><dd>${p.pass.end ? escapeHtml(new Date(p.pass.end).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })) : '미지정'}</dd>${id === 'master-duel' && !state.games[id].masterDuel?.eventDeleted && Date.now() < Date.parse(DICE_END) ? '<dt>이벤트 종료</dt><dd>9월 21일 12:59 KST</dd>' : ''}</dl><div class="card-actions"><button data-open-game="${id}">게임 열기</button><button data-settings="${id}">상세 설정</button><button data-mute="${id}">${p.mutedUntil > Date.now() ? '오늘 알람 꺼짐' : '오늘의 알람 끄기'}</button></div></article>`;
            }
          ).join('')}</div>`
        : `<p class="muted overview-empty">등록된 게임이 없습니다. 위의 "게임 추가" 버튼이나 사이드바의 "새 게임 만들기"로 시작하세요.</p>`
    }<p class="muted" id="gameSearchEmpty" hidden>일치하는 게임이 없습니다.</p><p class="muted">트레이 유지 중에만 창을 닫아도 알림이 실행됩니다. 완전 종료하거나 PC를 끄면 알림이 멈춥니다.</p>`;
  const applyGameSearch = () => {
    const term = $('#gameSearch').value.trim().toLowerCase();
    let visible = 0;
    $$('.overview-card').forEach(card => {
      const match = !term || card.dataset.gameName.includes(term);
      card.hidden = !match;
      if (match) visible++;
    });
    $('#gameSearchEmpty').hidden = visible > 0 || !registered.length;
  };
  $('#gameSearch').addEventListener('input', applyGameSearch);
  if (searchTerm) applyGameSearch();
  $$('[data-open-game]').forEach(b =>
    b.addEventListener('click', () => {
      state.activeGame = b.dataset.openGame;
      renderAll();
    })
  );
  $$('[data-settings]').forEach(b =>
    b.addEventListener('click', () => openSettings(b.dataset.settings))
  );
  $$('[data-mute]').forEach(b => b.addEventListener('click', () => muteGame(b.dataset.mute)));
  $('#trayOption').addEventListener('change', () => {
    state.tray = $('#trayOption').checked;
    window.deckroom?.setTray(state.tray);
    save();
  });
  const add = document.createElement('button');
  add.id = 'addCustomGame';
  add.textContent = '게임 추가';
  add.addEventListener('click', () => openCustomSetup());
  $('.overview-heading').appendChild(add);
  const resetButton = document.createElement('button');
  resetButton.id = 'resetAllGames';
  resetButton.className = 'danger';
  resetButton.textContent = '게임 전체 초기화';
  $('.overview-heading').appendChild(resetButton);
  resetButton.addEventListener('click', () => {
    openDialog(
      '모든 게임 초기화',
      `<p>게임 ${GAMES.length}개의 진행도, 누적 보상, 패스, 지출, 활동일, 이벤트, 알림 및 게임 데이터 백업을 모두 삭제합니다. 각 게임은 최초 설정 상태로 돌아갑니다.</p><p>이 작업은 되돌릴 수 없습니다.</p><button id="confirmAllGamesReset" class="danger">모든 게임 데이터 삭제</button>`
    );
    $('#confirmAllGamesReset').addEventListener('click', () => {
      try {
        resetAllGames();
        closeDialog();
        renderAll();
        toast('모든 게임을 초기화했습니다.');
      } catch (error) {
        toast('초기화하지 못했습니다. 다시 시도하세요.');
      }
    });
  });
}
function gameStatus(id) {
  const g = state.games[id],
    p = g.profile;
  if (!p?.registeredAt) return { color: 'setup', label: '설정 필요' };
  if (p.mutedUntil > Date.now()) return { color: 'done', label: '✓' };
  return universalStatus(g);
}
function openSettings(id) {
  return openUniversalSettings(id);
}
