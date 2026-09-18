# 이력 문서 색인

여기 문서들은 완료되어 더 이상 갱신되지 않는 과거 기록이다. 현재 상태·구조·검증 정책은 루트의 [HANDOFF.md](../../HANDOFF.md), [ARCHITECTURE.md](../../ARCHITECTURE.md), [AGENTS.md](../../AGENTS.md), [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md), [REGRESSION_TEST_COVERAGE.md](../../REGRESSION_TEST_COVERAGE.md), [REFACTOR_STAGE_G.md](../../REFACTOR_STAGE_G.md)를 따른다.

| 문서 | 내용 |
|---|---|
| [REFACTORING_PROPOSAL.md](REFACTORING_PROPOSAL.md) | 최초 리팩터링 제안서. 문제 진단표와 A~E1 착수 전 계획. |
| [REFACTOR_BASELINE.md](REFACTOR_BASELINE.md) | A단계: 리팩터링 착수 전 기준선(테스트·커버리지·성능·복구 지점). |
| [REFACTOR_STAGE_B.md](REFACTOR_STAGE_B.md) | B단계: 하네스 중복 제거, 렌더링/동기화 경계 정리. |
| [REFACTOR_STAGE_C.md](REFACTOR_STAGE_C.md) | C단계: `save()` 커밋/롤백 계약, `commitStateChange()` 도입. |
| [REFACTOR_STAGE_D.md](REFACTOR_STAGE_D.md) | D단계: KARDS 전용 규칙 카탈로그 최초 구현. |
| [REFACTOR_STAGE_D_UNIVERSAL.md](REFACTOR_STAGE_D_UNIVERSAL.md) | D 보완: 게임 전용 설계를 범용 엔진으로 전환. |
| [REFACTOR_STAGE_E.md](REFACTOR_STAGE_E.md) | E1~E8단계: 9개 프리셋 게임을 범용 엔진으로 이관한 결과. |
| [REFACTOR_STAGE_F.md](REFACTOR_STAGE_F.md) | F단계: 성능/중복 제거(갱신 스케줄러, 원장 캐시). |
| [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) | 2026-09-17 기능 확장 적용 보고서(게임별 보상 데이터·검증 결과). |
| [REGRESSION_FIXES.md](REGRESSION_FIXES.md) | 2026-09-19 회귀 수정 기록(dateKey 이관, 초기 구매 지출 등). |
| [HANDOFF_HISTORY.md](HANDOFF_HISTORY.md) | 과거 인수인계 상태 배너 전체 아카이브(D~F 단계, 최초 사양 포함). |

`REFACTOR_STAGE_G.md`는 가장 최근 완료 단계 기록이라 루트에 남아 있다. `REGRESSION_TEST_COVERAGE.md`는 폐기된 74개 테스트를 현재 29개 핵심 테스트와 대조한 살아있는 참고 자료라 루트에 남아 있다.
