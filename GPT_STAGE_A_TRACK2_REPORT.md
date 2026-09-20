# Stage A Track2 구현·검증 보고

작성일: 2026-09-21 KST

상태: 할당된 Track2 구현 및 해당 범위 검증 완료. Stage A 전체의 저장 변환·실행취소 정책 검증 완료를 대신 선언하는 문서는 아니다.

기준: `GPT_TASK_BRIEF_STAGE_A.md`, 공동 기획서 7절, Track1 `44ee683`.

## 구현 결과

- `catalog-editor.js`: 게임 설정에 전체 게임 JSON 내보내기 버튼과 성공/취소/실패 상태를 추가했다. 중복 클릭은 저장 요청 동안 막고, 취소·실패 후 재시도할 수 있다. 일정 직접 대입 대신 실제 `updateResetSchedule()`을 호출한다.
- `catalog-view.js`: `serializeStateForExport()` 반환값을 변경하지 않고 JSON으로 직렬화한다. Electron은 `saveTextFile()`을, 브라우저는 Blob 다운로드를 사용한다. 브라우저에서는 디스크 저장 완료를 알 수 없으므로 “다운로드 요청”으로 안내한다.
- `preload.js` / `desktop-main.js`: `save-text-file` invoke/handle 채널을 추가했다. 기존 `trusted(event)`로 메인 프레임을 확인하고 경로 없는 JSON 파일명·문자열·JSON 유효성을 검사한다. 저장 대화상자에서 사용자가 선택한 경로에만 UTF-8 파일을 쓴다. 기존 트레이·알람·복귀 채널은 수정하지 않았다.
- `catalog-view.js` / `manager.css`: 게임 화면 위에 변환 안내를 표시한다. 안내 문자열을 HTML 이스케이프하고, 닫은 상태는 저장하며, 새 안내 내용이 생기면 다시 표시한다. 최소 창 크기에서 닫기 버튼의 글자·배경 대비를 확인했다.

## Claude에게 전달할 계약

1. `updateResetSchedule(id, schedule)`은 동일 일정 재저장에서도 함께 변경한 패스·알림 설정을 저장해야 한다. 현재 Track1 구현은 `runCatalogAction()`을 통해 이 계약을 충족한다. UI는 변경 전 게임 상태를 보관하고 패스·알림을 준비한 뒤 이 함수를 한 번 호출한다. 실패하면 게임 상태를 원복하고 설정 창을 유지한다. 별도 중첩 저장은 추가하지 않았다. 이후 기존 `renderAll()`의 정상 동기화 저장은 발생할 수 있다.
2. `profile.conversionNotice` 문자열 배열을 소비한다. UI가 추가한 `profile.conversionNoticeAcknowledged`는 확인한 유효 문자열 배열의 JSON 문자열이다. 원본 안내를 삭제하지 않으며 원문이 바뀌면 재표시한다. 이 부가 필드는 진행도나 규칙 판정에 사용하지 않는다.
3. `saveTextFile` 결과는 `{ saved: true }`, `{ canceled: true }`, `{ error: string }` 중 하나다. 내부 경로·오류 상세를 사용자에게 노출하지 않는다.
4. 새 파일 `tests/catalog-export-v2.test.cjs`와 `tests/catalog-export-ipc.test.cjs`를 기본 test 명령에 등록할 것을 요청한다. 공용 패키지 설정의 담당 경계를 지키기 위해 이번 커밋에서는 `package.json`을 변경하지 않았다. 현재 기본 검사와 별도로 실행해야 한다.

## 실행한 검증

| 범위 | 결과 |
|---|---|
| `npm.cmd test` | 55/55 통과: Track1 Stage A 검사 포함 |
| 신규 두 테스트 직접 실행 | 15/15 통과: UI/내보내기 9, IPC 6 |
| 실제 엔진과 설정 UI | 일정·패스·알림을 같은 저장에 반영, 저장 실패 시 디스크/메모리 보존 |
| 실제 Electron 소스 런타임 | Windows 저장 대화상자로 JSON 저장 성공, 두 번째 저장 취소 정상 복귀 |
| 실제 Chromium 웹 경로 | `dev:web` 로컬 HTTP 화면, preload 없는 창에서 Blob 다운로드 후 파일 JSON 확인 |
| 일정 저장 | 실제 API로 시간만 변경 → 요일만 변경 → 동일 값 저장 성공 |
| 변환 안내 | 표시·이스케이프·닫기·새로고침 후 닫힘 유지. 신규 내용 재표시는 단위 검사 |
| 화면 | 1180×760 콘텐츠 크기에서 변환 배너 및 설정 내보내기 영역 확인 |
| 포맷 | 담당 JS/신규 테스트에 Prettier 적용. 비소유 파일 포맷 변경은 커밋에 포함하지 않음 |

신규 검사 명령:

```powershell
node --test tests/catalog-export-v2.test.cjs tests/catalog-export-ipc.test.cjs
```

최초 테스트는 Track1 계약 대체 함수를 사용했다. Track1 `44ee683` 반영 이후 최종 런타임은 대체 함수를 제거하고 실제 API를 사용했다. 격리된 QA 프로필로 실행했으며 기존 사용자 프로필을 수정하지 않았다. 표준 `npm start` 대신 같은 `desktop-main.js`를 로드하는 QA 진입점을 사용해 테스트 프로필을 분리했다. 웹 경로는 독립 Chrome/Edge가 아닌 Electron의 preload 없는 Chromium 창으로 확인했다.

로컬 검증 산출물(커밋 제외):

- `qa/stage-a-track2-runtime.cjs`: 실제 엔진·소스 앱 검증 진입점.
- `qa/stage-a-1789924240709/native-export.json`, `browser-export.json`: 실제 저장/다운로드 파일.
- `qa/stage-a-1789924464388/banner-final.png`, `settings-final.png`: 최종 시각 확인.

## 검증 한계와 제외 범위

옛 저장 전체의 변환 정확도·모든 revision 경계·실사용 저장본 복구는 Track1 책임이며 이 보고서의 런타임 검증으로 대체하지 않는다. 변환 배너의 런타임 입력은 합성 안내였다. 임의 크기의 파일·모든 Windows 파일시스템 오류·Chrome/Edge별 다운로드 설정은 검증하지 않았다.

내보내기 내용은 Track1의 `{ schemaVersion, exportedAt, games }` 계약 그대로다. 최상위 사용자 게임 목록·이름 등 메타데이터와 향후 가져오기 요구의 정합성은 직렬화/가져오기 담당자가 확인해야 한다. 이번 Track2가 별도의 저장 포맷을 만들지 않았다.

B의 알림 의미·입력 검증, C의 가져오기 UI, D의 프리셋 확장, 설치 설정·배포 빌드·설치본 검증은 수행하지 않았다. 기존에 있던 `scripts/*.cjs` 및 `tests/harness.cjs` 미커밋 변경은 이번 작업에 포함하지 않는다.

## 복구

코드 기준점은 Track1 `44ee683`이다. Track2 커밋의 소유 파일 변경만 되돌릴 수 있다. 이번 UI는 변환 안내 확인 상태 외에 새 저장 스키마를 도입하지 않는다. 엔진의 데이터 변환 복구는 Track1의 원본 백업 정책을 따른다. 코드 복구가 데이터 복구를 대신한다고 가정하지 않는다.
