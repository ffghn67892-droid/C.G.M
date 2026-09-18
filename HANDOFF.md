# DECKROOM 인수인계

> 후속 회귀 수정 완료(2026-09-19): dateKey 이관·초기 구매 지출·편집 일정 표시·단계 캐시·경계 중복 계산을 수정했다. 결과/복구: [REGRESSION_FIXES.md](docs/history/REGRESSION_FIXES.md), 당시 제외 검사 74개 대응: [REGRESSION_TEST_COVERAGE.md](REGRESSION_TEST_COVERAGE.md).

> AI 작업 친화적 구조 개편 완료(2026-09-19, Stage H1~H4 진행 중): git 저장소 도입, 문서 아카이브·배너 단일화, package.json 배포 목록 동기화, 테스트 스위트 정리(제외 파일 10개 삭제·통과 검사 10개 이관, 폐기 사유는 REGRESSION_TEST_COVERAGE.md). 현재 `npm.cmd test`는 39개(핵심 29 + 이관 10) 전부 통과.

현재 상태: **2026-09-19 A~E8·F·G 리팩터링 완료**. 사용자는 G 작업까지 승인했다. 이전 문서의 승인 대기는 당시 기록이며 현재 상태가 아니다.

## 제품과 코드

임의 게임에 범용 규칙을 조합하여 관리하는 Electron 앱이다. 기본 9게임도 사용자 게임과 같은 카탈로그·엔진·편집기·화면을 사용한다. 최초 설정에서 규칙과 초기 진행도·기수령 보상을 입력할 수 있다.

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
5. 완료된 A~G를 재시작하지 않는다. 새로운 단계 작업을 별도로 제안하면 기존 사용자 원칙대로 범위·검증·복구 지점을 제시하고 승인받는다.

## G 완료 상태

미사용 게임별 화면·옛 설정 폼·모달과 CSS 선택자 591개를 제거했다. 정적 데이터는 game-data.js, 카탈로그 이전 저장 호환은 legacy-migrations.js로 분리했다. game-extras.js·mission-updates.js·park-quests.js는 제거되었다. 자세한 파일 역할은 ARCHITECTURE.md를 따른다.

직접 로드하는 로컬 HTML/JS/CSS 합계는 327,700 → 192,148바이트로 41.4% 줄었다. 이는 소스 크기이며 저장 크기나 실행 성능 개선률은 아니다.

G 당시 핵심 23개 검사 통과, Electron 17개 상태의 배치·계산 스타일 동일, 9게임 합성 이전 저장의 이관·재로딩 결과 동일을 확인했다. 전 상태·전 해상도 및 실사용 프로필은 검증하지 않았다.

## 데이터와 복구

저장 키는 `deckroom-quests`, 저장 스키마는 v2다. `ruleCatalog`·`ruleProgress`·보상 `ledger`를 유지한다. 저장 실패는 마지막 확정 상태로 복구한다. 카탈로그 이전 저장 정규화에는 일부 옛 데이터 접근 코드가 남아 있으므로 화면에서 호출되지 않는다는 이유만으로 삭제하지 않는다.

G 직전 소스 사본은 `.refactor-checkpoints/G-before/files/`, 목록과 해시는 `manifest.json`에 있다. 변경·삭제 파일을 복원하면 코드 롤백이 가능하며 사용자 진행도 삭제는 필요 없다. G 스타일 비교 도구는 현재 CSS를 G-before 기준으로 덮어쓰므로 후속 변경 뒤 재실행하지 않는다.

## 실행

의존성이 준비된 프로젝트에서 `npm.cmd start`로 소스 앱, `npm.cmd test`로 현재 핵심 검사를 실행한다. Electron 메인·preload·IPC 설정은 G에서 변경하지 않았다.
