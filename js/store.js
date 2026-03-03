// store.js — API-backed data store with in-memory cache

const API_URL = '/api/data';

let _data = null;
let _saveTimer = null;
let _onSaveStatus = null;

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

// 2026 Korean public holidays
const KOREAN_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: '신정' },
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-03-02', name: '삼일절 대체공휴일' },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-05-25', name: '부처님 오신 날 대체공휴일' },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-08-17', name: '광복절 대체공휴일' },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-09-26', name: '추석 연휴' },
  { date: '2026-09-28', name: '추석 대체공휴일' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2026-10-05', name: '개천절 대체공휴일' },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '크리스마스' },
];

const DEFAULT_CONFIG = {
  slackWebhookUrl: '',
  slackChannel: '#office-cleaning',
  weeklyNotifyDay: 4,
  weeklyNotifyTime: '10:00',
  reminderTime: '15:30',
  cleaningDay: 4,
  cleaningStartTime: '16:00',
  cleaningEndTime: '17:00',
  holidays: KOREAN_HOLIDAYS_2026,
};

// --- Persistence helpers ---
function persist() {
  clearTimeout(_saveTimer);
  if (_onSaveStatus) _onSaveStatus('saving');

  // Save to localStorage immediately as cache
  try {
    localStorage.setItem('cleaning_cache', JSON.stringify(_data));
  } catch { /* quota exceeded - ignore */ }

  _saveTimer = setTimeout(async () => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (_onSaveStatus) _onSaveStatus('saved');
    } catch (e) {
      console.warn('Backend save failed (localStorage cache still valid):', e.message);
      if (_onSaveStatus) _onSaveStatus('offline');
    }
  }, 500);
}

function migrateFromOldLocalStorage() {
  const PREFIX = 'cleaning_';
  const keys = ['members', 'rounds', 'config', 'changelog', 'pairing_history'];
  const migrated = {};
  let found = false;

  for (const key of keys) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) {
      try {
        migrated[key] = JSON.parse(raw);
        found = true;
      } catch { /* skip */ }
    }
  }

  if (found) {
    // Clean up old keys
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }

  return found ? migrated : null;
}

// --- Public API ---
export const store = {
  onSaveStatusChange(fn) {
    _onSaveStatus = fn;
  },

  async load() {
    // 1. Try API
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && data.members) {
          _data = data;
          // Ensure holidays exist in config (migration for existing data)
          if (_data.config && !_data.config.holidays) {
            _data.config.holidays = KOREAN_HOLIDAYS_2026;
            persist();
          }
          return;
        }
      }
    } catch (e) {
      console.warn('API fetch failed:', e.message);
    }

    // 2. Try localStorage cache
    try {
      const cached = localStorage.getItem('cleaning_cache');
      if (cached) {
        const data = JSON.parse(cached);
        if (data && data.members) {
          _data = data;
          persist(); // Sync to API
          return;
        }
      }
    } catch { /* skip */ }

    // 3. Try migrating old localStorage format
    const migrated = migrateFromOldLocalStorage();
    if (migrated) {
      _data = {
        members: migrated.members || INITIAL_MEMBERS,
        rounds: migrated.rounds || [],
        config: { ...DEFAULT_CONFIG, ...(migrated.config || {}) },
        changelog: migrated.changelog || [],
        pairing_history: migrated.pairing_history || [],
      };
      persist();
      return;
    }

    // 4. Fresh initialization
    _data = {
      members: INITIAL_MEMBERS,
      rounds: [],
      config: DEFAULT_CONFIG,
      changelog: [],
      pairing_history: [],
    };
    persist();
  },

  isLoaded() {
    return _data !== null;
  },

  // Members
  getMembers() {
    return _data?.members || [];
  },
  setMembers(members) {
    _data.members = members;
    persist();
  },
  getMember(id) {
    return this.getMembers().find((m) => m.id === id);
  },
  updateMember(id, updates) {
    const idx = _data.members.findIndex((m) => m.id === id);
    if (idx !== -1) {
      _data.members[idx] = { ..._data.members[idx], ...updates };
      persist();
    }
  },
  addMember(member) {
    _data.members.push(member);
    persist();
  },
  getActiveMembers() {
    return this.getMembers().filter((m) => m.isActive && !m.isExempt);
  },

  // Rounds
  getRounds() {
    return _data?.rounds || [];
  },
  addRound(round) {
    _data.rounds.push(round);
    persist();
  },
  updateRound(round) {
    const idx = _data.rounds.findIndex((r) => r.id === round.id);
    if (idx !== -1) {
      _data.rounds[idx] = round;
      persist();
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
    return _data?.pairing_history || [];
  },
  addPairingRecord(roundNumber, pairs) {
    pairs.forEach(([a, b]) => {
      _data.pairing_history.push({ roundNumber, memberA: a, memberB: b });
    });
    persist();
  },

  // Changelog
  getChangelog() {
    return _data?.changelog || [];
  },
  addChangelogEntry(entry) {
    _data.changelog.unshift({ ...entry, timestamp: new Date().toISOString() });
    // Keep last 200 entries
    if (_data.changelog.length > 200) {
      _data.changelog = _data.changelog.slice(0, 200);
    }
    persist();
  },
  removeChangelogEntry(index) {
    if (index >= 0 && index < _data.changelog.length) {
      _data.changelog.splice(index, 1);
      persist();
    }
  },

  // Config
  getConfig() {
    return _data?.config || DEFAULT_CONFIG;
  },
  setConfig(config) {
    _data.config = config;
    persist();
  },

  // Holidays (convenience)
  getHolidays() {
    return this.getConfig().holidays || [];
  },
  setHolidays(holidays) {
    const config = this.getConfig();
    config.holidays = holidays;
    this.setConfig(config);
  },
  addHoliday(holiday) {
    const holidays = this.getHolidays();
    holidays.push(holiday);
    holidays.sort((a, b) => a.date.localeCompare(b.date));
    this.setHolidays(holidays);
  },
  removeHoliday(date) {
    this.setHolidays(this.getHolidays().filter((h) => h.date !== date));
  },

  // Initialization check
  needsFirstRound() {
    return this.getRounds().length === 0;
  },

  // Reset — immediately push to API (no debounce) to ensure KV is cleared
  async reset() {
    _data = {
      members: INITIAL_MEMBERS,
      rounds: [],
      config: DEFAULT_CONFIG,
      changelog: [],
      pairing_history: [],
    };
    try { localStorage.removeItem('cleaning_cache'); } catch { /* ignore */ }
    // Immediate save (bypass debounce) so KV is guaranteed cleared before reload
    try {
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_data),
      });
    } catch { /* offline — localStorage already cleared */ }
  },

  // Constants
  getChecklistTemplate() {
    return CHECKLIST_TEMPLATE;
  },
};
