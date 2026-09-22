> 2026-09-22 항목 순서 변경·새 게임 마법사 재설계 완료: ▲▼ 이동, 편집 초안 유지 및 렌더링 후 포커스 복원, 생성 3단계 스타일 통일. 기본 검사 79/79와 격리 Chromium의 저장·취소·실행취소·키보드·생성 흐름 검증 통과. 범위와 한계는 [GPT_ITEM_ORDER_AND_NEW_GAME_REPORT.md](GPT_ITEM_ORDER_AND_NEW_GAME_REPORT.md)를 따른다.

> 2026-09-20 할 일 추적기 개편(Stage L1) 완료: Track 1 엔진/데이터와 Track 2 화면/입력을 통합했다. 실제 브라우저에서 새 게임 생성→규칙 추가→카드 클릭→되돌리기→새로고침 후 저장 유지까지 확인했고, 현재 `npm.cmd test`는 33/33 통과한다. 정확한 범위와 검증 한계는 [GPT_TRACK2_STATUS.md](GPT_TRACK2_STATUS.md)를 따른다.

# DECKROOM 인수인계

> 2026-09-22 완료 카드 상시 표시 Track2 완료: 완료 카드는 수량·체크를 유지하며 실제 액션 한계에서만 비활성화한다. 개인 목표 달성 게이지는 계속 증가 가능하다. Claude 배지 변경 `4e7cfc0`을 유지하고 기본 검사 79/79 및 실제 엔진 웹 클릭 흐름을 확인했다. 상세는 [GPT_CARD_VISIBILITY_REPORT.md](GPT_CARD_VISIBILITY_REPORT.md). 아래 카드 표시가 대기 중이라는 설명은 이전 시점 기록이다.

> 2026-09-22 설정 다이얼로그 재설계 완료: 설정 5개 섹션, 마법사 단계 표시, 상세 헤더 및 버튼 역할 구분을 적용했다. 기능 로직 변경 없이 기본 검사 77/77 통과, 격리된 Chromium 웹 화면에서 기존 설정 동작과 최소 크기 배치를 확인했다. 상세는 [GPT_SETTINGS_REDESIGN_REPORT.md](GPT_SETTINGS_REDESIGN_REPORT.md). 카드 상시 표시·배지 개편은 별도 작업이다.

> 2026-09-21 Stage A Track2 구현·해당 범위 검증 완료: 외부 JSON 내보내기(Windows 저장/취소 및 웹 다운로드), 일정 저장 API 연결, 변환 안내. Track1 `44ee683`과 실제 API 연결 확인. 기본 테스트 55/55, 별도 신규 테스트 15/15 통과. 신규 두 테스트의 기본 명령 등록은 공용 패키지 담당자에게 인계한다. 상세 계약·검증 한계·복구는 [GPT_STAGE_A_TRACK2_REPORT.md](GPT_STAGE_A_TRACK2_REPORT.md). 아래 L1 및 이전 단계의 검사 수는 당시 기록이며 Stage A 전체 완료를 뜻하지 않는다.

> 후속 회귀 수정 완료(2026-09-19): dateKey 이관·초기 구매 지출·편집 일정 표시·단계 캐시·경계 중복 계산을 수정했다. 결과/복구: [REGRESSION_FIXES.md](docs/history/REGRESSION_FIXES.md), 당시 제외 검사 74개 대응: [REGRESSION_TEST_COVERAGE.md](REGRESSION_TEST_COVERAGE.md).

> AI 작업 친화적 구조 개편 완료(2026-09-19, Stage H1~H5): git 저장소 도입, package.json 배포 목록 동기화, 문서 아카이브·배너 단일화, 테스트 스위트 정리(제외 파일 10개 삭제·통과 검사 10개 이관), 전체 소스 19개 파일 Prettier 재포맷. 상세는 아래 "AI 작업 친화적 구조 개편 완료 상태" 절을 따른다.

현재 상태: **2026-09-20 A~E8·F·G, H1~H5 및 할 일 추적기 개편 L1 완료**. 이전 문서의 승인 대기는 당시 기록이며 현재 상태가 아니다.

## 제품과 코드

임의 게임에 슬롯형·게이지형 규칙을 조합하여 남은 할 일을 관리하는 Electron 앱이다. 기본 게임과 사용자 게임은 같은 카탈로그·엔진·편집기·압축 카드 화면을 사용한다. 최초 설정에서는 게임 기본 리셋 일정과 선택적인 패스 정보만 입력한다.

- 최상위 설계: [UNIVERSAL_RULE_SYSTEM.md](UNIVERSAL_RULE_SYSTEM.md)
- 현행 구조·실행 흐름: [ARCHITECTURE.md](ARCHITECTURE.md)
- 최종 정리·검증·복구: [REFACTOR_STAGE_G.md](REFACTOR_STAGE_G.md)
- 성능 측정: [REFACTOR_STAGE_F.md](docs/history/REFACTOR_STAGE_F.md)
- 게임 이관 결과: [REFACTOR_STAGE_E.md](docs/history/REFACTOR_STAGE_E.md)
- 과거 인수인계 기록: [HANDOFF_HISTORY.md](docs/history/HANDOFF_HISTORY.md). 이전 파일 구조·검증 명령·미완료 표시는 현재 구조보다 우선하지 않는다.
- 과거 리팩터링 단계 문서·최초 계획서 전체 색인: [docs/history/README.md](docs/history/README.md)

## 현재 작업 원칙

작업 시작 시 이 문서와 IMPLEMENTATION_PLAN.md 10절, AGENTS.md를 확인한다.

1. 검증은 변경 기능과 직접 영향을 받는 범위로 제한한다. 문서만 수정하면 앱 검사는 실행하지 않는다.
2. 기본 `npm.cmd test`는 39개(핵심 29 + Stage H4 이관 10)다. `tests/` 안의 모든 파일이 실행 대상이며 별도로 제외된 파일은 없다. 비치명적·중복 검사를 생략하는 원칙은 유지한다. 공통 보상·저장·갱신 변경에는 현재 핵심 검사를 실행하며, 보상 금액·상태·중복 지급·실패 복구를 우선한다.
3. 화면 변경은 영향받는 화면과 필요한 창 크기만 확인한다. 검사 통과 후 새 변경·실패·미해결 우려 없이 반복하거나 확대하지 않는다.
4. 사용자가 다시 요청할 때까지 설치 관련 파일·배포 빌드·설치본 검증은 제외한다. package.json 배포 파일 목록은 소스 구성과 동기화했다(2026-09-19, AI 작업 친화적 구조 개편 H2). 다만 `npm run dist` 실행이나 설치본 자체는 아직 검증하지 않았다.
5. 완료된 A~G, H1~H5를 재시작하지 않는다. 새로운 단계 작업을 별도로 제안하면 기존 사용자 원칙대로 범위·검증·복구 지점을 제시하고 승인받는다.
6. 이후 단계부터는 `.refactor-checkpoints/` 수동 스냅샷 대신 git 커밋으로 체크포인트를 대체한다. 기존 체크포인트 폴더는 삭제하지 않고 `.gitignore`로만 제외한다.

## AI 작업 친화적 구조 개편 완료 상태 (Stage H1~H5, 2026-09-19)

- **H1 (git 도입)**: `.git` 저장소 초기화, `.refactor-audit/`·`.refactor-checkpoints/`·`qa/`를 `.gitignore`에 추가한 뒤 베이스라인 커밋. origin은 사용자의 GitHub 저장소(`ffghn67892-droid/C.G.M`)로 연결했으나 아직 push하지 않았다.
- **H2 (메타데이터 정합성)**: `package.json`의 `build.files`에서 이미 삭제된 `park-quests.js`·`game-extras.js`·`mission-updates.js`를 제거하고, 누락되어 있던 `game-data.js`·`catalog-engine.js`·`catalog-presets.js`·`catalog-view.js`·`catalog-editor.js`·`refresh-scheduler.js`·`legacy-migrations.js`를 추가해 `index.html` 로드 순서와 일치시켰다.
- **H3 (문서 정리)**: 완료된 이력 문서 11개를 `docs/history/`로 이동하고 색인(`docs/history/README.md`)을 추가했다. README·AGENTS·ARCHITECTURE·HANDOFF 4곳에 복붙되어 있던 동일 상태 배너를 이 문서 한 곳으로 단일화했다. 60개 상호 링크를 모두 검증했다.
- **H4 (테스트 정리)**: `tests/` 12개 파일 중 `npm.cmd test`에서 제외됐던 10개(74개 선언)를 실제로 실행해 확인한 뒤 삭제했다. 그중 지금도 그대로 통과하던 10개 선언은 `tests/catalog-additional.test.cjs`로 옮겼다. 나머지는 2단계 설정 미리보기·게임별 전용 DOM·제거된 `passAwards()` 등 이미 존재하지 않는 대상을 참조하고 있었고, 그 요구사항(보상 금액·멱등성·중복 지급 방지)은 현재 E1~E8/F/회귀 스위트가 현재 API로 이미 검증하고 있어 재작성하지 않았다. 결정 경위는 REGRESSION_TEST_COVERAGE.md에 기록했다. `npm.cmd test`는 이제 39개 전부 통과하며 `tests/` 안에 "제외 파일" 개념이 없다.
- **H5 (Prettier 재포맷)**: 루트 `*.js` 19개 파일(핵심 로직 파일은 줄당 최대 1,482자, 평균 200~320바이트/줄이었다) 전체를 Prettier로 재포맷했다. 그룹(데이터→엔진→UI 연결→Electron 메인)마다 `node --check`와 `npm.cmd test` 39개 통과를 확인하고 별도 커밋했다. 로직·변수명·파일 분할은 건드리지 않았다. 마지막에 `npm.cmd run dev:web`으로 브라우저에서 메인 화면과 KARDS 최초 설정→규칙 편집기→생성 흐름을 육안 확인했고 콘솔 오류가 없었다.
- 개편 전 커밋(`Baseline snapshot before AI-friendly reorg`)이 남아 있어 필요시 파일 단위로 이전 상태와 diff·복원이 가능하다.

## G 완료 상태

미사용 게임별 화면·옛 설정 폼·모달과 CSS 선택자 591개를 제거했다. 정적 데이터는 game-data.js, 카탈로그 이전 저장 호환은 legacy-migrations.js로 분리했다. game-extras.js·mission-updates.js·park-quests.js는 제거되었다. 자세한 파일 역할은 ARCHITECTURE.md를 따른다.

직접 로드하는 로컬 HTML/JS/CSS 합계는 327,700 → 192,148바이트로 41.4% 줄었다. 이는 소스 크기이며 저장 크기나 실행 성능 개선률은 아니다.

G 당시 핵심 23개 검사 통과, Electron 17개 상태의 배치·계산 스타일 동일, 9게임 합성 이전 저장의 이관·재로딩 결과 동일을 확인했다. 전 상태·전 해상도 및 실사용 프로필은 검증하지 않았다.

## 데이터와 복구

저장 키는 `deckroom-quests`, 저장 스키마는 v2다. `ruleCatalog`·`ruleProgress`·보상 `ledger`를 유지한다. 저장 실패는 마지막 확정 상태로 복구한다. 카탈로그 이전 저장 정규화에는 일부 옛 데이터 접근 코드가 남아 있으므로 화면에서 호출되지 않는다는 이유만으로 삭제하지 않는다.

G 직전 소스 사본은 `.refactor-checkpoints/G-before/files/`, 목록과 해시는 `manifest.json`에 있다. 변경·삭제 파일을 복원하면 코드 롤백이 가능하며 사용자 진행도 삭제는 필요 없다. G 스타일 비교 도구는 현재 CSS를 G-before 기준으로 덮어쓰므로 후속 변경 뒤 재실행하지 않는다.

## 실행

의존성이 준비된 프로젝트에서 `npm.cmd start`로 소스 앱, `npm.cmd test`로 현재 핵심 검사를 실행한다. Electron 메인·preload·IPC 설정은 G에서 변경하지 않았다.
