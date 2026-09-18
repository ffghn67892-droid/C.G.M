// Default game names and preset data. No state mutation or UI handlers.
const GAMES = [
  ['kards', 'KARDS', 'K', 'lime'], ['mtga', '매직 더 게더링 아레나', 'M', 'blue'], ['snap', '마블스냅', 'S', 'coral'], ['might-magic', '마이트앤매직 더 카드 게임', 'M', 'violet'], ['shadowverse', '섀도우버스 월드비욘즈', 'W', 'gold'], ['hearthstone', '하스스톤', 'H', 'blue'], ['master-duel', '유희왕 마스터 듀얼', 'M', 'coral'], ['duel-links', '유희왕 듀얼링크스', 'D', 'lime'], ['pokemon-pocket', '포켓몬 TCG 포켓', 'P', 'yellow']
];
const SNAP_ID = 'snap';
const MIGHT_ID = 'might-magic';
const MTGA_ID = 'mtga';
const SHADOWVERSE_REWARDS = [
  { id: 'basic', label: '기본', rupies: 70, redEther: 50 },
  { id: 'intermediate', label: '중급', rupies: 100, redEther: 70 },
  { id: 'advanced', label: '상급', rupies: 150, redEther: 80 },
  { id: 'highest', label: '최상급', rupies: 200, redEther: 100 }
];
const WEEKLY_REWARDS = [{ count: 5, credits: 100, reward: '100 크레딧 · 10 골드 · 100 시즌 패스 경험치' }, { count: 10, credits: 200, reward: '200 크레딧 · 15 골드 · 200 시즌 패스 경험치' }, { count: 15, credits: 250, reward: '250 크레딧 · 25 골드 · 300 시즌 패스 경험치' }, { count: 20, credits: 300, reward: '300 크레딧 · 50 골드 · 500 시즌 패스 경험치' }, { count: 25, credits: 500, reward: '500 크레딧 · 100 골드 · 900 시즌 패스 경험치' }];
const MTGA_WIN_REWARDS = [['1승', '250 골드', '250', '25'], ['2승', '100 골드', '350', '50'], ['3승', '100 골드', '450', '75'], ['4승', '100 골드', '550', '100'], ['5승', '카드 1장 (ICR)', '550', '125'], ['6승', '50 골드', '600', '150'], ['7승', '카드 1장 (ICR)', '600', '175'], ['8승', '50 골드', '650', '200'], ['9승', '카드 1장 (ICR)', '650', '225'], ['10승', '50 골드', '700', '250'], ['11승', '카드 1장 (ICR)', '700', '250'], ['12승', '25 골드', '725', '250'], ['13승', '카드 1장 (ICR)', '725', '250'], ['14승', '25 골드', '750', '250'], ['15승', '카드 1장 (ICR)', '750', '250']];
const MASTER_DUEL_QUESTS = [
  '랭킹 듀얼에서 승리하기 (1회)', '듀얼 진행하기 (3회)', '몬스터 특수 소환하기 (5회)',
  '마법 카드 발동하기 (3회)', '함정 카드 발동하기 (3회)', '몬스터 일반 소환 / 세트하기 (3회)',
  '상대 몬스터 파괴하기 (5회)', '솔로 모드에서 듀얼하기 (3회)', '라이브 2D 듀얼 관전하기 (1회)'
];
const DUEL_LINKS_WEEKLY_QUESTS = [
  ['모든 주간 미션 완료', '10 젬', 'gems', 10], ['듀얼 10번 승리', '5 젬', 'gems', 5], ['PvP 듀얼 5번 완료', '10 젬', 'gems', 10],
  ['마법/함정 카드를 20번 사용', 'R 보옥 × 10', 'rJewels', 10], ['링크 소환을 10번 실행', '5 젬', 'gems', 5], ['전설의 듀얼리스트 3번 제압', '파란색 게이트 열쇠 (수량 미등록)', 'blueGateKeys', 0], ['트레이더에서 카드 1번 획득', '5000 골드', 'gold', 5000]
];
const POKEMON_DAILY_MISSIONS = ['로그인하기', '카드팩 1회 개봉하기', '카드팩 2회 개봉하기', '겟 챌린지 1회 진행하기', '카드 1회 찬장 또는 디스플레이보드 1회 감상하기', '숍에서 팩 모래시계 1회 교환하기', '대전(혼자서 대전 또는 대인전) 1회 진행하기'];
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
function mtgaWinGold(win) { const match = MTGA_WIN_REWARDS[win - 1]?.[1].match(/^(\d+) 골드$/); return match ? Number(match[1]) : 0; }
function mtgaWinGoldThrough(wins) { return Array.from({ length: Math.min(15, wins) }, (_, index) => mtgaWinGold(index + 1)).reduce((total, gold) => total + gold, 0); }
function mtgaDailyWinXp(wins) { return Number(MTGA_WIN_REWARDS[Math.min(15, wins) - 1]?.[3] || 0); }
const MIGHT_WEEKS = [
  ['1주차', [['랭킹전 모드 10번 플레이', '3000 XP'], ['한 번의 공격으로 피해 9 이상 가하기 (3회)', '3000 XP'], ['전투 단계에서 주문으로 피해 30 가하기', '3000 XP']], [['수호 또는 신성 방패를 지닌 생물로 5번 공격', '3000 XP'], ['전투 단계 중 생물 10기 소환', '3000 XP'], ['배치 단계 중 생물 효과를 가진 생물 3기 파괴', '3000 XP']]],
  ['2주차', [['한 라운드에 생물 4기 파괴 (5회)', '3000 XP'], ['공격력이 정확히 1인 유닛으로 비용 6 이상 생물 파괴', '3000 XP'], ['주문 한 번으로 생물 3기 파괴 (2회)', '3000 XP']], [['한 라운드에 정확히 생물 1기 시전 (3회)', '3000 XP'], ['수호를 지닌 생물 치유 (10회)', '3000 XP'], ['한 번의 공격으로 피해 20 이상 가하기', '3000 XP']]],
  ['3주차', [['네크로폴리스로 5게임 플레이', '3000 XP'], ['어둠 주문 30번 시전', '3000 XP'], ['상대 생물의 공격력 20 감소', '3000 XP']], [['기절 상태인 생물 10기 파괴', '3000 XP'], ['언데드 생물로 30번 공격', '3000 XP'], ['묘지에서 생물 10기 소환', '3000 XP']]],
  ['4주차', [['지오반디로 1게임 플레이', '3000 XP'], ['뱀파이어 생물 10기 시전', '3000 XP'], ['생명력 흡수로 캐릭터를 40만큼 치유', '3000 XP']], [['뱀파이어 생물의 공격력 30 증가', '3000 XP'], ['영웅을 50 치유', '3000 XP'], ['한 라운드에 뱀파이어 생물로 2번 공격 (3회)', '3000 XP']]]
];
const PARK_DAILY_QUESTS = [
  { id: 'enter', title: '파크에 입장', keys: 1, points: 0 },
  { id: 'table', title: '대전 테이블에서 대전하기 (조기 항복 불가)', keys: 1, points: 0 }
];
const PARK_WEEKLY_QUESTS = [
  { id: 'enter-three', title: '파크에 3일 입장', points: 20 },
  { id: 'battle-five', title: '파크에서 랜덤전 또는 대전 테이블에서 5회 대전하기 (조기 항복 불가)', points: 40 },
  { id: 'friend-battle', title: '친구나 길드원과 대전 테이블에서 대전하기', points: 30 },
  { id: 'message', title: '친구나 길드원에게 메시지 보내기', points: 10 },
  { id: 'spectate', title: '파크에서 관전하기', points: 10 },
  { id: 'ace', title: '로비에서 에이스와 대전하기 (항복 불가)', points: 20 }
];
const PARK_MILESTONES = [
  { points: 20, resource: 'keys', amount: 3, label: '보물 상자 열쇠 3개' },
  { points: 40, resource: 'redEther', amount: 200, label: '레드에테르 200개' },
  { points: 60, resource: 'keys', amount: 3, label: '보물 상자 열쇠 3개' },
  { points: 80, resource: 'rupies', amount: 250, label: '250 루피' },
  { points: 100, resource: 'keys', amount: 4, label: '보물 상자 열쇠 4개' }
];
