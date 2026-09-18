# G단계 — 미사용 코드·CSS 정리와 구조 문서

2026-09-19 완료. 사용자의 `G작업 승인` 및 계속 진행 지시 범위에서 수행했다. A~E8, F, G가 모두 완료되었다.

## 변경 결과

- 사용되지 않는 게임별 화면·완료 모달·옛 설정 폼·중복 액션 경로를 제거했다. 화면은 범용 카탈로그 렌더러로 연결한다.
- game-extras.js, mission-updates.js, park-quests.js를 제거했다. 필요한 정적 데이터는 game-data.js, 기존 저장 호환 함수는 legacy-migrations.js로 옮겼다.
- app.js는 공유 상태·저장·복구 중심으로 줄였다. setup.js는 공통 대화상자·범용 편집기 연결을 맡는다. index.html과 테스트 하네스의 로딩 목록도 갱신했다.
- 현재 코드에서 사용되지 않는 CSS 선택자 591개를 제거했다. CSSOM으로 규칙을 읽고 공통·불확실한 선택자와 애니메이션은 보존했다.
- ARCHITECTURE.md에 현행 파일 책임·실행 경로·Electron 경계·남은 호환 의존성을 기록했다. HANDOFF.md를 현재 상태 중심으로 다시 쓰고 과거 내용은 HANDOFF_HISTORY.md에 보존했다.

## 측정

index.html 및 그 파일이 직접 로드하는 로컬 JS/CSS의 UTF-8 파일 크기 합계는 **327,700 → 192,148바이트**, **135,552바이트(41.4%) 감소**했다. 문서·개발 스크립트·Electron 메인·node_modules·백업은 이 측정에 포함하지 않는다. CSSOM의 표기 정규화도 포함된다. 저장 데이터 크기나 실제 실행 속도가 같은 비율로 줄었다는 뜻은 아니다.

원자료: `.refactor-audit/G/source-metrics.json`.

## 검증

- JS 정리 후 `npm.cmd test` 핵심 **23개 통과**. 원래 74개보다 약 69% 적은 기본 검사 구성을 유지했다.
- 격리 Electron 1180×760 창에서 정리 전후 **17개 상태**의 요소 배치·계산 스타일이 일치했다. 메인·9게임·6유형 편집기·목표 진행 상태를 비교했다. 사용되지 않는 클래스를 가진 옛 DOM은 비교 대상이 아니다.
- KARDS 숫자 폭 차이는 동적 글꼴 로딩 시점 때문이었다. 각 화면에서 document.fonts.ready를 기다리도록 비교 도구를 수정한 뒤 일치를 확인했다. 검증 도구의 반환값 직렬화 문제도 수정했다.
- 카탈로그 이전 상태를 담은 9게임 합성 저장 fixture를 G 직전과 현재 코드에 각각 불러왔다. 규칙·진행도·누적 보상이 같고 재로딩으로 보상이 늘지 않았다. 임의 생성 ID는 비교에서 정규화했다.
- package.json, electron-main.js, desktop-main.js, preload.js는 G 직전과 바이트 단위로 동일하다.

자료: `.refactor-audit/G/style-comparison.json`, `migration-comparison.json`, `removed-selectors.json`.

비교 도구: `scripts/refactor-g-style-audit.cjs`, `scripts/refactor-g-migration-audit.cjs`. 스타일 도구는 G-before CSS를 현재 위치로 복사하여 정리하므로 **후속 CSS 수정 뒤 그대로 재실행하지 않는다**. cleanup 스크립트도 G 당시의 일회성 변환 기록이다.

시각 비교는 계산 스타일·기하 정보 기반이다. 모든 보상 상태·hover/focus·다른 창 크기·실사용 프로필을 망라하는 스크린샷 검사는 하지 않았다. 이관 fixture 역시 모든 과거 저장 조합을 증명하지 않는다. 이전 74개 전체 검사와 설치본·배포 빌드는 실행하지 않았다.

## 복구와 남은 경계

`.refactor-checkpoints/G-before/manifest.json` 및 `files/`에 변경 전 66개 파일을 보존했다. G에서 변경·삭제한 원본 파일을 같은 상대 경로로 복원하면 이전 로딩 경로로 돌아간다. 새 game-data.js·legacy-migrations.js는 복원된 index.html에서 로드되지 않는다. 필요하면 해당 두 파일과 G 전용 문서·검증 도구를 별도 제거한다. 진행도 초기화는 필요하지 않다. 실제 사용자 localStorage는 검증에 사용하지 않았다.

카탈로그 이전 저장의 호환 정규화, 공유 전역 함수, 일부 KARDS 어댑터는 의도적으로 남겼다. 사용 중인 호환 경로까지 미사용으로 간주하지 않았다.

사용자 지시로 설치 설정은 수정하지 않았다. **배포 파일 목록에는 삭제된 파일이 남아 있고 새 범용 모듈 일부가 빠져 있으므로, 설치 작업 재개 시 목록 동기화와 별도 검증이 필요하다.** 현재 완료 범위는 소스 코드 리팩터링이며 설치본 출시가 아니다.
