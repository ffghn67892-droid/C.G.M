# DECKROOM 현재 코드 구조

> 현재 상태는 [HANDOFF.md](HANDOFF.md)를 참고하십시오.

2026-09-19 · A~G 리팩터링 완료 기준. 과거 제안서의 게임별 폴더 분할보다 범용 규칙 시스템을 우선한다.

## 실행 경계

`electron-main.js` → `desktop-main.js`는 창·트레이·알림·절전 복귀를 관리한다. `preload.js`가 제한된 API를 연결한다. contextIsolation 및 sandbox를 켜고 nodeIntegration을 끈다. 게임 규칙과 localStorage는 렌더러에서 실행된다. G에서는 이 프로세스 경계와 IPC를 변경하지 않았다.

렌더러는 `index.html`에 명시된 순서로 일반 스크립트를 읽고 `manager.js`의 `bootRenderer()`로 한 번 초기화한다. 파일 분할은 책임 구분이며 ES 모듈이나 번들러 전환은 아니다. 공유 전역 함수에 대한 의존성은 남아 있다.

## 파일별 책임

| 파일 | 책임 |
|---|---|
| game-data.js / pass-data.js | 게임 이름·임무 목록·보상표 등 정적 데이터 |
| schedules.js | KST 기간과 갱신 시각 계산 |
| catalog-presets.js | 기본 게임을 범용 규칙으로 선언, 이전 진행도를 카탈로그로 이관 |
| catalog-engine.js | 규칙 검증, 퀘스트·수령·목표·충전 자원·패스·카운터의 상태 변경과 연동 |
| game-config.js | 카탈로그 접근 어댑터·호환 함수, KARDS 프리셋과 공통 보조 데이터 |
| catalog-view.js | 범용 규칙 화면, 진행도·보상·카운트다운 표시 |
| catalog-editor.js | 같은 규칙 형식의 최초 설정·편집·초기 진행도 입력 |
| setup.js | 공통 대화상자, 게임 생성과 편집기 연결 |
| app.js | 공유 상태, 동기 저장, 실패 복구, 작은 UI 도우미 |
| reward-ledger.js | v2 저장 구조, 보상 원장·합계 캐시, 등록·초기화 |
| legacy-migrations.js | 카탈로그 이전 저장의 정규화·기간 갱신, KARDS 저장 호환 |
| refresh-scheduler.js | 다음 갱신 경계 계산, 변경 감지, 지연 화면 갱신 |
| overview.js / alerts.js | 전체 게임 요약·탐색, 수행 가능 조건에 따른 알림 |
| manager.js | 화면 연결과 초기화, 타이머·포커스·절전 복귀 이벤트 |
| styles.css / manager.css | 현재 셸·범용 화면·편집기 스타일 |

## 변경 흐름

사용자 입력은 게임 ID·규칙 ID·동작·보상 선택을 `catalogAction()`에 전달한다. 규칙과 기간을 검증하고 진행도·원장을 변경한 뒤 `save()`로 확정한다. 저장 실패는 마지막 확정 상태로 복구한다. localStorage는 동기식이며 저장 중 await로 다른 클릭이 끼어드는 구조는 아니다. 중복 클릭과 지난 기간의 입력은 별도로 거절한다.

일상 갱신은 `syncCatalog()`를 사용한다. 카탈로그 이전 저장은 `importCatalogGame()` → `syncLegacyGame()`을 거쳐 이관한다. 이 호환 경로에는 선택 게임을 임시 교체하고 finally로 복구하는 코드가 남아 있다. 현재 범용 엔진의 정상 실행 경로와 구분하며, 이관 지원을 폐기하기 전에는 제거하지 않는다.

저장 키 `deckroom-quests`와 스키마 v2를 유지한다. 게임별 `ruleCatalog`는 선언, `ruleProgress`는 진행도, `ledger`는 수령 기록이다. `catalogVersion`은 이관 여부를 나타낸다. 렌더링 진입 시 동기화·저장 확인이 아직 존재하므로 렌더러 전체가 순수 함수라는 의미는 아니다. 변경 없는 저장과 원장 재집계는 F의 캐시로 생략한다.

새 게임은 기존 게임 전용 렌더러를 추가하지 않고 카탈로그를 생성하거나 프리셋을 복사한다. 구간 보상은 goal/pass의 steps로 표현한다. 새로운 종류의 규칙이 필요할 때는 엔진·검증기·편집기·화면의 공통 유형을 함께 확장한다.

## 검증과 배포 경계

기본 검사는 `npm.cmd test` 39개다(핵심 29개 + Stage H4에서 이관한 10개). 변경 범위별 추가 검증 원칙은 IMPLEMENTATION_PLAN.md 10절을 따른다. G의 비교 자료와 한계는 REFACTOR_STAGE_G.md, 테스트 정리 경위는 REGRESSION_TEST_COVERAGE.md에 있다. `tests/` 디렉터리는 이제 실행하면 전부 통과하는 파일만 남아 있다("제외 파일" 개념 없음).

설치 작업은 사용자 요청으로 중단되어 있다. package.json의 배포 파일 목록은 현재 소스 구성과 동기화했다(2026-09-19). 다만 `npm run dist` 실행이나 설치본 자체를 검증하지는 않았으므로, 소스 실행 확인을 배포·설치본 검증으로 간주하면 안 된다.

`scripts/*.cjs`는 `package.json`에 연결되지 않은 별도 QA/감사 도구다. 필요할 때 `node scripts/<파일>`로 직접 실행한다:

| 스크립트 | 용도 |
|---|---|
| build-pass-data.cjs | `pass-source-extract.json`(엑셀 원본)에서 `pass-data.js` 재생성 |
| checkpoint.cjs | 단계 시작 전 소스 스냅샷을 `.refactor-checkpoints/`에 저장 |
| desktop-smoke.cjs | 격리 프로필로 Electron 데스크톱 기동 스모크 테스트 |
| verify-package.cjs | 빌드된 asar 내 파일이 `package.json`의 `build.files`와 일치하는지 검증 |
| refactor-baseline.cjs / refactor-coverage-hook.cjs | A단계 기준선(테스트·커버리지) 측정·계측 |
| refactor-perf.cjs / refactor-f-benchmark.cjs / refactor-f-runtime.cjs | 격리 렌더러·Electron 런타임 성능 측정(F단계) |
| refactor-g-cleanup.cjs / refactor-g-style-audit.cjs / refactor-g-migration-audit.cjs | 미사용 코드 추출, 스타일/CSS 감사, 이전 저장 이관 비교(G단계) |
| kards-catalog-qa.cjs / universal-catalog-qa.cjs / catalog-stages-qa.cjs | D·D보완·E1~E8 단계별 Electron 화면 QA(스크린샷·콘솔 오류 수집) |
| regression-performance.cjs | 회귀 수정 전후 응답시간 비교(REGRESSION_FIXES.md 근거 자료) |
