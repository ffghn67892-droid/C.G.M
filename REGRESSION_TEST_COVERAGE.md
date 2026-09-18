# 축소된 테스트의 시나리오 대응표

2026-09-19. 제외 파일의 74개 test 선언을 직접 읽어 현재 기본 검사와 대조했다. `부분`은 원래 시나리오 전체가 보장된다는 뜻이 아니다. `공백`은 결함 확정이 아니라 기본 자동검사에서 해당 조합을 단언하지 않는다는 뜻이다. 테스트를 다시 모두 실행한 결과가 아니다. 옛 DOM/함수에 의존하는 검사는 그대로 재활성화하지 않고 요구사항을 현재 엔진으로 옮겨야 한다.

현재 기본 검사는 29개(기존23 + 이번6). 이번 복원: R1 MTGA 구형 완료 이관, R2 Might 구형 완료 이관, R3 초기 구매 지출·실패 복구, R4 편집 일정 안내, R5 단계 캐시·후불 지급, R6 갱신 경계 단일 계산.

## 이번 발견을 기존 테스트가 잡을 수 있었는가

- dateKey: daily-quests.test.cjs:111의 구형 MTGA 완료 변환 시나리오가 직접 해당한다. 다만 현재 하네스로 원본 그대로 실행하면 catalogVersion=1인 새 fixture와 삭제된 UI 때문에 정확한 회귀 탐지가 되지 않는다. pre-catalog fixture와 데이터 단언으로 이관했다면 잡혔다. 같은 Might 분기는 기존 명시 검사가 없어서 이번에 추가했다.
- 초기 구매 지출: 기존 초기 보상 검사는 재화·활동일을 검사했고 expense 기반 초기 지출은 없었다. 전체 옛 검사를 유지해도 직접 잡는다는 근거가 없다. 새 기능 테스트 누락이다.
- 편집 일정 안내: 기존 일정 검사는 기간 계산·편집 저장을 확인했지만 상단 표시와의 일치는 검사하지 않았다.
- 10000단계: 기존 반복 패스 검사는 보상 수량만 확인했고 시간·전개 횟수의 성능 예산은 없었다.
- 경계 계산2회: F의 정확성 검사는 있었지만 호출 횟수 단언은 없었다.

## 선언별 대응

| 기존 위치 | 기존 시나리오 | 현재 대응·누락 |
|---|---|---|
| [daily-quests.test.cjs:5](tests/daily-quests.test.cjs#L5) | MTGA completion chooses either reward, retains rows and blocks duplicate rewards | 부분 — 초기 750골드 기록은 검사하지만 일반 완료의 500/750 선택·모달 취소는 없음. |
| [daily-quests.test.cjs:31](tests/daily-quests.test.cjs#L31) | MTGA keeps daily quests, daily win rewards and weekly wins in one top row | 시각 검사로 대체 — G 화면 비교는 있으나 가로 1열 자동 단언은 기본 검사에 없음. |
| [daily-quests.test.cjs:54](tests/daily-quests.test.cjs#L54) | MTGA daily win bonus always shows three rewards and only lights completed wins | 공백 — 0/1/2/3승별 3칸 표시와 점등 순서 없음. |
| [daily-quests.test.cjs:74](tests/daily-quests.test.cjs#L74) | all three completions remain today and become only one new quest tomorrow | 공백 — 같은 날 3개 완료 유지 후 다음 날 정확히 1개 생성 조합 없음. |
| [daily-quests.test.cjs:87](tests/daily-quests.test.cjs#L87) | midnight during reward selection cancels stale completion | 대체 — 핵심 E1 stale period 완료 거절. 구형 모달 경로는 폐기. |
| [daily-quests.test.cjs:95](tests/daily-quests.test.cjs#L95) | retained rows expire at Hearthstone KST 01:00, including after an offline restart | 공백 — 하스스톤 완료 큐의 01:00 오프라인 재시작 경계 없음. |
| [daily-quests.test.cjs:111](tests/daily-quests.test.cjs#L111) | legacy MTGA storage keeps reward and wins when unifying the daily UI | 이번 복원 R1 — MTGA 구형 완료 플래그→큐 이관. 축소 전 직접 관련 시나리오. |
| [daily-quests.test.cjs:126](tests/daily-quests.test.cjs#L126) | `${id}: completion persists and clears at rollover` | 공백 — 하스스톤 일일 완료 수령 후 재시작·갱신 조합 없음. |
| [daily-quests.test.cjs:138](tests/daily-quests.test.cjs#L138) | KARDS retains completed reward and preserves the two-quest pass exception | 부분 — KARDS 초기 무료 카드 2장은 있으나 패스의 일일 퀘스트 2개 공급 조합 없음. |
| [daily-quests.test.cjs:158](tests/daily-quests.test.cjs#L158) | other game types keep their controls and all nine screens render | 시각 검사로 부분 대체 — 9게임 표시 확인; 각 게임 옛 컨트롤의 의미 단언은 없음. |
| [daily-quests.test.cjs:170](tests/daily-quests.test.cjs#L170) | Master Duel draws three distinct daily quests and pays 40 gems per completion | 부분 — 핵심 E5의 3→6→9·중복 거절. 실제 일일 완료 40젬은 직접 단언 없음. |
| [daily-quests.test.cjs:193](tests/daily-quests.test.cjs#L193) | Duel Links replenishes standard duelists and awards fixed weekly missions | 부분 — 핵심 E7의 회복 시계·주간 보석/골드 합계. 모든 개별 보상 UI는 없음. |
| [daily-quests.test.cjs:215](tests/daily-quests.test.cjs#L215) | all supplied daily and weekly boundaries are KST, including Sunday and Monday | 부분 — F 일정 유형별 다음 경계 검사. 모든 게임별 일/주 경계 조합은 없음. |
| [daily-quests.test.cjs:235](tests/daily-quests.test.cjs#L235) | MTGA 18:00 removes completed quests, resets daily wins, and Sunday resets weekly wins only once | 부분 — 핵심 E1 일일 승리 재지급·상한. 일요일 주간 리셋 전체 조합은 없음. |
| [daily-quests.test.cjs:253](tests/daily-quests.test.cjs#L253) | Pokemon daily missions clear at 15:00 and Shadowverse gets three at 05:00 | 부분 — 핵심 E8 포켓 일일 리셋. 섀도우버스 05:00 3개 생성은 없음. |
| [daily-quests.test.cjs:264](tests/daily-quests.test.cjs#L264) | Pokemon Pocket recovers pack and challenge resources and pays daily rewards after three missions | 부분 — 핵심 E8 독립 회복·3개 목표·팩 모래시계·무료 개봉. 챌린지 모래시계 수량 직접 단언 없음. |
| [daily-quests.test.cjs:283](tests/daily-quests.test.cjs#L283) | legacy time migration preserves completed queues and win totals until the next new boundary | 부분 — 구형 MTGA 누적 합계·승리 보존. 옛 기간 표식의 다음 경계 보존 조합은 없음. |
| [daily-quests.test.cjs:300](tests/daily-quests.test.cjs#L300) | Shadowverse records each of the four reward pairs and preserves totals on reload | 공백 — 섀도우버스 네 보상 쌍 각각 완료·재시작 없음. |
| [daily-quests.test.cjs:321](tests/daily-quests.test.cjs#L321) | Shadowverse cancel leaves quest untouched, rewards add together, and stale 05:00 selection is rejected | 부분 — 공통 stale period 거절은 있음. 섀도우버스 취소·05:00 보상 선택 조합은 없음. |
| [daily-quests.test.cjs:336](tests/daily-quests.test.cjs#L336) | park dailies award only one key each, persist and refresh at KST 05:00 | 부분 — 핵심 E4 일일 열쇠·주간 포인트 0. 파크 일일 재시작·05:00 리셋 없음. |
| [daily-quests.test.cjs:355](tests/daily-quests.test.cjs#L355) | park weekly thresholds pay once, cap at 100 and clear all remaining weekly quests | 대체 — 핵심 E4 100점 상한·구간 보상·남은 퀘스트 거절. |
| [daily-quests.test.cjs:383](tests/daily-quests.test.cjs#L383) | park weekly state resets Monday 05:00, retains cumulative rewards and can award next week again | 공백 — 파크 월요일 초기화 후 같은 보상의 재지급 없음. |
| [daily-quests.test.cjs:401](tests/daily-quests.test.cjs#L401) | adding park data preserves legacy Shadowverse balances and daily quests | 공백 — 구형 섀도우버스 잔액·일일 퀘스트 이관 단언 없음. G 합성 비교는 별도 일회 검사. |
| [manager.test.cjs:4](tests/manager.test.cjs#L4) | main overview exposes nine games, with independent registration and reset | 부분 — 전체/사용자 초기화는 있음. 특정 게임 초기화가 다른 등록 게임을 보존하는 독립 단언 없음. |
| [manager.test.cjs:5](tests/manager.test.cjs#L5) | all nine first-setup forms preview and commit without counting activity | 부분 — 범용 편집기와 초기 보상 입력 검사. 9게임 최초 설정 UI 각각의 저장은 없음. |
| [manager.test.cjs:6](tests/manager.test.cjs#L6) | MTGA setup includes selected quests and wins, persists XP after both rollovers | 부분 — 초기 MTGA 퀘스트·승리 합계와 일일 승리 리셋은 있음. 주간 리셋까지 연속 조합 없음. |
| [manager.test.cjs:7](tests/manager.test.cjs#L7) | pass workbook totals are 1005 Master Duel gems, 14100 Might gold and HS 20400 at 400 | 부분 — 마스터 듀얼 1005젬 및 HS 반복 50골드. Might 14100·HS 20400 전체 합계 없음. |
| [manager.test.cjs:8](tests/manager.test.cjs#L8) | Master Duel 33/50 grades and later paid unlock never repeat free rewards | 부분 — 초기 MD 1005젬 및 이번 R5 후불 트랙 공통 검사. MD 33/50 중간 레벨 금액 없음. |
| [manager.test.cjs:9](tests/manager.test.cjs#L9) | setup cancellation and edited-after-preview do not write rewards | 일부 폐기·공백 — 옛 미리보기/확정 UI 폐기. 현 편집 취소 무지급 대응 검사는 없음. |
| [manager.test.cjs:10](tests/manager.test.cjs#L10) | KARDS tier rewards and Wednesday boundary are idempotent | 공백 — KARDS 상자 티어별 보상과 수요일 리셋 재지급 없음. |
| [manager.test.cjs:11](tests/manager.test.cjs#L11) | KARDS, MTGA and Shadowverse render empty daily slots without creating quests | 시각 검사로 부분 대체 — 빈 슬롯 상태별 정확히 3개·무생성 단언 없음. |
| [manager.test.cjs:12](tests/manager.test.cjs#L12) | Snap each refresh issues fixed normal and hard missions and carries unfinished up to six | 부분 — 핵심 E6 및 slots 검사 발급2개. 16시간/다음날 누적6개·일반/어려움 고정 조합 없음. |
| [manager.test.cjs:13](tests/manager.test.cjs#L13) | Snap daily free credits 25 times three, tokens50, web100 and weekly credits aggregate separately | 부분 — 핵심 E6 초기 무료·임무·주간 합계. 하루 3회 크레딧 각각 수령/숨김/재등장 없음. |
| [manager.test.cjs:14](tests/manager.test.cjs#L14) | Might daily01 and login04:40 reset independently; weekly gold and chapters persist | 부분 — 핵심 E3 유료 조건·XP·일일 리셋. 04:40 로그인·주차 넘김 연속 조합 없음. |
| [manager.test.cjs:15](tests/manager.test.cjs#L15) | Duel Links deducts one per battle and preserves ongoing thirty-minute replenishment | 부분 — 핵심 E7 진행 중 회복 시계 보존. 10명 전부 소비 후 5시간 완충 조합 없음. |
| [manager.test.cjs:16](tests/manager.test.cjs#L16) | Pocket additional consumption preserves recovery start and timers retain focus | 부분 — 핵심 E8 독립 시계와 F 입력 유지. 포켓 초 표시 값·버튼 초점의 해당 조합 없음. |
| [manager.test.cjs:17](tests/manager.test.cjs#L17) | Master login max30 resets by KST month and never repeats today | 부분 — E5 월30회 상한과 safety 월초 리셋. 같은 날 중복 로그인과 620젬 총액 조합 없음. |
| [manager.test.cjs:18](tests/manager.test.cjs#L18) | dice milestone jumps pay once; deleting ended event preserves awards and tombstone | 부분 — E5 이벤트 종료 후 거절. 주회 전체 보상·삭제 tombstone 보존 없음. |
| [manager.test.cjs:19](tests/manager.test.cjs#L19) | activity records distinct KST dates and excludes synchronization | 공백 — 같은 날 활동1일/다음날2일·자동동기화 제외 연속 시나리오 없음. 초기 활동0은 유지. |
| [manager.test.cjs:20](tests/manager.test.cjs#L20) | alerts acknowledge identical events, mute expires at next reset and full quests use correct cap | 부분 — F 경계 교차의 full alert. acknowledge 동일 이벤트·mute 종료·게임별 색상 조합 없음. |
| [manager.test.cjs:21](tests/manager.test.cjs#L21) | settings previews incremental pass rewards and keeps cash spending separate | 부분 — 이번 R5 유료 소급 보상 중복 방지. 현금 지출과 보상 분리 UI 없음. 옛 미리보기 UI 폐기. |
| [additional-regressions.test.cjs:2](tests/additional-regressions.test.cjs#L2) | explicit clock synchronizes an inactive game without changing the selected tab | 공백 — 명시적 now로 비활성 게임 동기화 시 선택 탭·진행·합계 동시 보존 없음. |
| [additional-regressions.test.cjs:3](tests/additional-regressions.test.cjs#L3) | all five chest tiers retain rarity distinction and exact currency amounts | 공백 — KARDS 5티어 보상 희귀도·금액 표의 정확한 값 없음. |
| [additional-regressions.test.cjs:4](tests/additional-regressions.test.cjs#L4) | Hearthstone free and paid pack totals match workbook and weekly brawl never duplicates | 공백 — HS 무료16/유료22팩·난투 중복/다음 주 재수령 없음. |
| [additional-regressions.test.cjs:5](tests/additional-regressions.test.cjs#L5) | Might repeat pass rewards apply once per level past100 and never fabricate missing tables | 부분 — 핵심 E2의 HS 반복 보상. Might 100 이후 포일과 표 없는 게임 무지급 없음. |
| [additional-regressions.test.cjs:6](tests/additional-regressions.test.cjs#L6) | setup rejects stale preview crossing reset, with no reward mutation | 부분 — 일반 완료 stale period 거절. 최초 설정 창을 열어둔 채 경계 통과 시 저장 거절 없음. |
| [additional-regressions.test.cjs:7](tests/additional-regressions.test.cjs#L7) | muted Duel Links resumes at KST midnight; reset sounds track distinct events | 부분 — F 갱신 경계 알림. 듀얼링크스 mute 자정과 Snap 회차별 acknowledge 조합 없음. |
| [additional-regressions.test.cjs:8](tests/additional-regressions.test.cjs#L8) | MTGA weekly wins still advance after daily cap and maximum total does not repeat | 대체 — 일일 상한 이후 주간 진행은 safety paid activation/shared input 검사에 있음. |
| [additional-regressions.test.cjs:9](tests/additional-regressions.test.cjs#L9) | Might 01:00 and login04:40 periods change at exact millisecond | 부분 — F 기간 유형별 경계. Might 01:00/04:40 정확한 1ms 경계는 없음. |
| [rule-catalog.test.cjs:2](tests/rule-catalog.test.cjs#L2) | catalog schedules use KST weekly and anchored N-day boundaries | 부분 — F weekly/interval 경계 계산은 있으나 기존 05:30·09:15 전후의 동일 시나리오는 없음. |
| [rule-catalog.test.cjs:11](tests/rule-catalog.test.cjs#L11) | custom quests generate up to capacity, select compound rewards and retain completion until reset | 부분 — 공통 복합보상·갱신은 여러 검사에 분산. 사용자 capacity4/spawn2/3일 오프라인 조합 없음. |
| [rule-catalog.test.cjs:20](tests/rule-catalog.test.cjs#L20) | editing rewards preserves existing quest choices and historical awards | 공백 — 보상 편집 후 기존 퀘스트 선택값 보존·다음날 새 금액 적용 없음. |
| [rule-catalog.test.cjs:25](tests/rule-catalog.test.cjs#L25) | claim schedule edit does not refund claimed quota; stale buttons and duplicates do not pay | 부분 — stale 입력은 검사. 수령한 claim의 시각 편집 후 잔여 한도 보존은 없음. |
| [rule-catalog.test.cjs:31](tests/rule-catalog.test.cjs#L31) | catalog rejects invalid references, schedules and quantities without saving | 부분 — 참조·순환 오류 검사. 잘못된 시각·수량·보상 참조별 저장 불변은 없음. |
| [rule-catalog.test.cjs:35](tests/rule-catalog.test.cjs#L35) | first setup reads edited catalog, cancelling does not write, later editor can add rules | 부분 — 공통 편집기 추가·복사·삭제. 취소 무저장·최초 설정의 편집 시각 반영 UI 조합 없음. |
| [rule-catalog.test.cjs:42](tests/rule-catalog.test.cjs#L42) | catalog completion and editing recover from failed write without losing retry | 부분 — 보상 실패 복구·재시도 유지. 카탈로그 편집 저장 실패의 별도 경로 없음. |
| [rule-catalog.test.cjs:47](tests/rule-catalog.test.cjs#L47) | initial compound rewards are recorded once without activity days | 부분 — 초기 복합 보상/활동0·초기 카드2개. 구체 70골드+카드2·재시작 조합 없음. |
| [rule-catalog.test.cjs:55](tests/rule-catalog.test.cjs#L55) | initial preview cannot commit after the edited reset time passes | 공백 — 편집된 시각을 넘어선 최초 설정 확정 거절 없음. |
| [universal-catalog.test.cjs:2](tests/universal-catalog.test.cjs#L2) | unrelated games use the same rules with isolated progress and rewards across reload | 부분 — 프리셋 복사 게임의 연동 독립성은 있음. 동일한 두 사용자 게임의 완료·재시작 독립성 전체 조합 없음. |
| [universal-catalog.test.cjs:8](tests/universal-catalog.test.cjs#L8) | empty game and arbitrary rule IDs are valid; all preset rules can be removed | 공백 — 빈 카탈로그·모든 기본 규칙 삭제·임의 claim ID 수령 연속 조합 없음. |
| [universal-catalog.test.cjs:13](tests/universal-catalog.test.cjs#L13) | custom game creator and shared editor work without code or builtin rule IDs | 부분 — 현재 편집기 생성·복사·삭제는 검사. 새 퀘스트를 UI로 수령하는 조합 없음. |
| [universal-catalog.test.cjs:18](tests/universal-catalog.test.cjs#L18) | failed game creation and completion roll back and can retry exactly once | 대체 — 게임 생성 실패와 보상 실패·재시도 검사. 이번 R3는 초기 구매 생성 실패도 포함. |
| [universal-catalog.test.cjs:23](tests/universal-catalog.test.cjs#L23) | custom reset, daily rollover and global reset include custom games | 부분 — 사용자 게임 전체 초기화·재시작은 검사. 개별 초기화 후 재설정·일일 리셋 조합 없음. |
| [kards-controls.test.cjs:2](tests/kards-controls.test.cjs#L2) | KARDS count controls persist 0–3 quests without granting rewards or activity | 공백 — +/- 0~3 조절 무보상·무활동·재시작 조합 없음. |
| [kards-controls.test.cjs:12](tests/kards-controls.test.cjs#L12) | KARDS minus preserves completed quests and earned rewards until daily reset | 공백 — 마이너스가 완료 퀘스트를 보존하고 다음날 삭제하는 조합 없음. |
| [kards-controls.test.cjs:21](tests/kards-controls.test.cjs#L21) | KARDS reward list is collapsed by default and other games retain their summary | 시각 검사로 부분 대체 — 목록 접힘/게임별 요약 표시의 의미 단언 없음. |
| [kards-controls.test.cjs:28](tests/kards-controls.test.cjs#L28) | KARDS reward buttons complete immediately with the chosen amount | 부분 — UI 보상 실패·재시도 60골드 검사. 최초 50/60 버튼 구성·완료 문구 전체 없음. |
| [reset-all.test.cjs:2](tests/reset-all.test.cjs#L2) | main reset button asks for confirmation and cancellation preserves every game | 공백 — 전체 초기화 확인창 취소 시 모든 상태 불변 없음. |
| [reset-all.test.cjs:9](tests/reset-all.test.cjs#L9) | confirmed all-game reset clears rewards, progress, alerts and backups across restart | 부분 — 사용자 포함 초기화·등록 해제는 검사. 백업 삭제·트레이 유지·모든 필드 freshGame 동일은 없음. |
| [status-rules.test.cjs:5](tests/status-rules.test.cjs#L5) | Snap passive weekly challenge does not warn when nothing is actionable | 대체 — 핵심 E6 무료/일반 임무 완료 후 수동 할 일 없으면 done. |
| [status-rules.test.cjs:16](tests/status-rules.test.cjs#L16) | MTGA ignores weekly wins alone but keeps daily quest and win priorities | 부분 — MTGA 주간 보상 수행/상한 검사. 주간만 남은 색상과 일일 우선순위 명시 단언 없음. |
| [status-rules.test.cjs:27](tests/status-rules.test.cjs#L27) | Direct Might and Hearthstone weekly quests still show yellow | 공백 — Might·HS 직접 주간의 노란색 상태 명시 단언 없음. |
| [storage-commit.test.cjs:5](tests/storage-commit.test.cjs#L5) | KARDS 보상 저장 실패는 진행도와 원장을 되돌리고 재시도할 수 있다 | 대체 — 공통 보상 실패 복구와 KARDS UI 재시도 검사. |
| [render-purity.test.cjs:5](tests/render-purity.test.cjs#L5) | 스냅 화면 렌더링은 주간 보상을 지급하지 않는다 | 공백 — Snap 렌더링 반복 자체가 주간 보상을 지급하지 않음을 별도 단언하지 않음. |
