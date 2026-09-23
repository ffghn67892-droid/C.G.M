# 사이드바 게임 탭 드래그 완료 보고

2026-09-23 · GPT Track2 · GPT_TASK_BRIEF_GAME_TAB_DRAG.md 기준

## 변경

- overview.js의 등록 게임 탭에만 draggable을 적용했다. 메인·새 게임 만들기는 드래그/드롭 대상으로 등록하지 않는다.
- 탭의 위·아래 절반으로 삽입 위치를 계산하고 기존 moveGameOrder(id, beforeId)를 한 번 호출한다. 별도 save나 renderAll 호출 없이 renderNavigation만 갱신한다.
- 뒤쪽 삽입 위치를 찾을 때 드래그 중인 탭을 제외한다. 인접 탭 뒤에 놓아 beforeId가 자기 자신이 되면 기존 API가 맨 끝으로 보내는 문제를 예방한다.
- 외부 드래그와 자기 자신 위 드롭은 무시한다. 자식 요소 사이 이동은 탭 이탈로 취급하지 않는다. drop/dragend에서 시각 효과를 정리하며 취소 후에도 정상 클릭이 가능하다.
- styles.css에 기존 lime 색상의 inset 삽입선, 드래그 투명도, grab/grabbing 커서를 추가했다. 탭 크기와 활성 탭 테두리는 유지한다.
- game-config.js의 정렬·저장 로직은 변경하지 않았다.

## 검증

- npm.cmd run format 실행 및 npm.cmd test 83/83 통과. 기존 사이드바 순서 검사 4개 포함이며 테스트 수를 늘리지 않았다.
- 변경 코드 git diff --check 통과.
- 격리 Electron Chromium 웹 화면(1180×760)에서 마우스 누름/이동으로 네이티브 dragstart를 발생시킨 뒤, CDP dragIntercepted/dispatchDragEvent로 브라우저 드롭 경로를 검증했다. DOM 이벤트를 직접 dispatch하는 방식은 사용하지 않았다. 물리 마우스를 사람이 직접 조작한 검증은 아니다.
  - 등록 게임 3개를 위·아래·중간·인접 위치로 이동.
  - 위쪽 삽입선과 원본 반투명 표시를 캡처해 확인.
  - 첫 이동에서 moveGameOrder 호출 1회, activeGame 유지, 메인 콘텐츠 DOM 객체 동일성 확인.
  - 메인·새 게임 만들기는 draggable=false이며 그 위에 드롭해도 순서/저장 호출 횟수 불변.
  - 브라우저 dragCancel 후 순서 유지 및 dragging/drop-before/drop-after 잔여 없음.
  - 드래그 후 마우스 일반 클릭으로 게임 화면 전환 성공.
  - localStorage의 gameOrder 확인 및 페이지 reload 후 탭 순서·선택 유지.

로컬 재현 스크립트: qa/tab-drag-runtime.cjs. 웹 서버 4173에서 `electron.cmd qa/tab-drag-runtime.cjs` 실행. qa는 기존 git 제외 영역이며 커밋하지 않는다. 캡처는 qa/tab-drag-1790170103911/drag-before.png에 있다. 기본 83개와 별도의 런타임 검증이다.

## 한계 및 복구

설치본·배포·실사용 프로필·다른 브라우저·터치 입력·많은 탭의 자동 스크롤은 검증하지 않았다. Esc 물리 키 입력 대신 브라우저 dragCancel 경로를 확인했다. 저장 실패 정책은 기존 moveGameOrder/save에 위임한다.

복구는 이 커밋의 overview.js/styles.css 변경을 되돌리는 방식이다. 저장 데이터의 gameOrder 형식과 엔진은 변경하지 않았다. 기존 scripts/*.cjs 미커밋 변경은 커밋에서 제외하며 원격 push는 하지 않는다.
