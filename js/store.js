// store.js — localStorage-based data store

const PREFIX = 'cleaning_';

const INITIAL_MEMBERS = [
  { id: 'iron', nickname: '아이언', nameEn: 'Iron', nameKr: '신성철', role: 'CEO', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🦸', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'dave', nickname: '데이브', nameEn: 'Dave', nameKr: '진대연', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '👦', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'jiny', nickname: '지니', nameEn: 'Jiny', nameKr: '김동진', role: 'UI/UX 디자이너', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🎨', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'eva', nickname: '이바', nameEn: 'Eva', nameKr: '서보람', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🌿', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'jimmy', nickname: '지미', nameEn: 'Jimmy', nameKr: '김병우', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🎸', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'anna', nickname: '안나', nameEn: 'Anna', nameKr: '안나경', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🌸', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'marine', nickname: '마린', nameEn: 'Marine', nameKr: '조아라', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🌊', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'con', nickname: '콘', nameEn: 'Con', nameKr: '박상수', role: '백엔드 개발자', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🎮', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'jake', nickname: '제이크', nameEn: 'Jake', nameKr: '김기철', role: '프론트엔드 개발자', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🏄', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'sophie', nickname: '소피', nameEn: 'Sophie', nameKr: '이소민', role: 'Operation Team', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🦋', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'chloe', nickname: '클로이', nameEn: 'Chloe', nameKr: '이혜주', role: 'Operation Team', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🌙', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'monica', nickname: '모니카', nameEn: 'Monica', nameKr: '함가연', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '💫', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'comet', nickname: '코멧', nameEn: 'Comet', nameKr: '김윤환', role: '백엔드', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '☄️', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'teddy', nickname: '테디', nameEn: 'Teddy', nameKr: '이용현', role: '', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🧸', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
  { id: 'lael', nickname: '라엘', nameEn: 'Lael', nameKr: '배소명', role: '크리에이터 마케팅', isActive: true, isExempt: false, exemptReason: '', joinedAt: '2025-07-28', avatarEmoji: '🌈', freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null },
];

const CHECKLIST_TEMPLATE = [
  {
    category: '바닥 청소',
    items: [
      { id: 'floor-1', label: '진공청소기로 사무실 전체 바닥 청소', required: true },
      { id: 'floor-2', label: '물걸레질', required: true },
    ],
  },
  {
    category: '쓰레기 정리',
    items: [
      { id: 'trash-1', label: '개인 책상 쓰레기통 비우기 + 비닐 교체', required: true },
      { id: 'trash-2', label: '공용 쓰레기통(회의실) 비우기 + 비닐 교체', required: true },
      { id: 'trash-3', label: '큰 쓰레기봉투에 모아 공용 쓰레기통 투입', required: true },
    ],
  },
  {
    category: '회의실 정리',
    items: [
      { id: 'meeting-1', label: '책상 위 쓰레기 치우기 + 물티슈로 닦기', required: true },
      { id: 'meeting-2', label: '책상/의자/모니터/보드 원위치 정리', required: true },
      { id: 'meeting-3', label: '화이트보드 지우기', required: false },
    ],
  },
  {
    category: '공용 집기 정리',
    items: [
      { id: 'common-1', label: '커피머신, 라면머신, 냉장고 외관 닦기', required: false },
      { id: 'common-2', label: '컵/캡슐 트레이, 물통, 냉장고 내부 확인', required: false },
      { id: 'common-3', label: '냉장고 음료 채우기', required: false },
    ],
  },
];

const DEFAULT_CONFIG = {
  slackWebhookUrl: '',
  slackChannel: '#office-cleaning',
  weeklyNotifyDay: 4, // Thursday
  weeklyNotifyTime: '10:00',
  reminderTime: '15:30',
  cleaningDay: 4, // Thursday
  cleaningStartTime: '16:00',
  cleaningEndTime: '17:00',
};

// --- helpers ---
function get(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function set(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

// --- public API ---
export const store = {
  // Members
  getMembers() {
    return get('members') || [];
  },
  setMembers(members) {
    set('members', members);
  },
  getMember(id) {
    return this.getMembers().find((m) => m.id === id);
  },
  updateMember(id, updates) {
    const members = this.getMembers();
    const idx = members.findIndex((m) => m.id === id);
    if (idx !== -1) {
      members[idx] = { ...members[idx], ...updates };
      this.setMembers(members);
    }
  },
  addMember(member) {
    const members = this.getMembers();
    members.push(member);
    this.setMembers(members);
  },
  getActiveMembers() {
    return this.getMembers().filter((m) => m.isActive && !m.isExempt);
  },

  // Rounds
  getRounds() {
    return get('rounds') || [];
  },
  addRound(round) {
    const rounds = this.getRounds();
    rounds.push(round);
    set('rounds', rounds);
  },
  updateRound(round) {
    const rounds = this.getRounds();
    const idx = rounds.findIndex((r) => r.id === round.id);
    if (idx !== -1) {
      rounds[idx] = round;
      set('rounds', rounds);
    }
  },
  getCurrentRound() {
    const rounds = this.getRounds();
    return rounds.find((r) => r.status === 'active') || rounds[rounds.length - 1] || null;
  },
  getPreviousRound() {
    const rounds = this.getRounds();
    const completed = rounds.filter((r) => r.status === 'completed');
    return completed[completed.length - 1] || null;
  },

  // Pairing history
  getPairingHistory() {
    return get('pairing_history') || [];
  },
  addPairingRecord(roundNumber, pairs) {
    const history = this.getPairingHistory();
    pairs.forEach(([a, b]) => {
      history.push({ roundNumber, memberA: a, memberB: b });
    });
    set('pairing_history', history);
  },

  // Changelog
  getChangelog() {
    return get('changelog') || [];
  },
  addChangelogEntry(entry) {
    const log = this.getChangelog();
    log.unshift({ ...entry, timestamp: new Date().toISOString() });
    set('changelog', log);
  },

  // Config
  getConfig() {
    return get('config') || DEFAULT_CONFIG;
  },
  setConfig(config) {
    set('config', config);
  },

  // Initialization
  isInitialized() {
    return get('initialized') === true;
  },
  initialize() {
    if (this.isInitialized()) return false;
    this.setMembers(INITIAL_MEMBERS);
    this.setConfig(DEFAULT_CONFIG);
    set('initialized', true);
    return true;
  },

  // Reset
  reset() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  },

  // Constants
  getChecklistTemplate() {
    return CHECKLIST_TEMPLATE;
  },
  getInitialMembers() {
    return INITIAL_MEMBERS;
  },
};
