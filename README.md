# DECKROOM

> 현재 상태는 [HANDOFF.md](HANDOFF.md)를 참고하십시오.

원하는 게임에 퀘스트·무료 보상·목표·충전 자원·패스·카운터를 조합하는 Windows 데스크톱 관리 앱입니다. 기본 9게임도 같은 범용 형식의 프리셋으로 제공합니다.

## 개발 실행

의존성이 설치된 프로젝트에서 실행합니다.

```powershell
npm.cmd start
# 브라우저 확인
npm.cmd run dev:web
# 핵심 검사 39개
npm.cmd test
# 코드 스타일 정리 (Prettier)
npm.cmd run format
```

최초 설정과 규칙 편집기에서 일정·생성 수·보상·연동·초기 진행도를 관리합니다. 갱신 시각은 KST 기준이고 저장은 localStorage를 사용합니다.

현행 구조는 [ARCHITECTURE.md](ARCHITECTURE.md), 작업 지침은 [HANDOFF.md](HANDOFF.md), 완료 결과는 [REFACTOR_STAGE_G.md](REFACTOR_STAGE_G.md)를 참고하십시오.

설치·배포 작업은 보류 중입니다. 배포 파일 목록은 현재 소스와 동기화했지만, 소스 실행 확인을 설치본 검증으로 간주하지 않습니다.
