// app.js — Main application

import { store } from './store.js';
import {
  generateRound,
  getCurrentWeekIndex,
  isRoundComplete,
  recalculateDatesAfterSkip,
  undoSkip,
  formatDateKr,
  formatDateShort,
} from './engine.js';

// ── State ──
let currentView = 'board';

// ── Init ──
async function init() {
  // Show loading
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = '<div class="flex items-center justify-center py-20"><div class="text-content-tertiary text-sm">데이터 로딩 중...</div></div>';

  await store.load();

  // Save status indicator
  store.onSaveStatusChange((status) => {
    const el = document.getElementById('save-status');
    if (!el) return;
    if (status === 'saving') {
      el.textContent = '저장 중...';
      el.className = 'text-xs text-content-tertiary transition-opacity';
    } else if (status === 'saved') {
      el.textContent = '저장됨';
      el.className = 'text-xs text-accent transition-opacity';
      setTimeout(() => { el.style.opacity = '0'; }, 1500);
      setTimeout(() => { el.textContent = ''; el.style.opacity = '1'; }, 2000);
    } else if (status === 'offline') {
      el.textContent = '오프라인';
      el.className = 'text-xs text-yellow-400 transition-opacity';
    }
  });

  if (store.needsFirstRound()) {
    createNewRound();
  }

  // Check if current round is complete
  const round = store.getCurrentRound();
  if (round && isRoundComplete(round)) {
    round.status = 'completed';
    store.updateRound(round);
    createNewRound();
  }

  updateWeekStatuses();
  bindEvents();
  render();
}

function createNewRound() {
  const members = store.getMembers();
  const pairingHistory = store.getPairingHistory();
  const previousRound = store.getPreviousRound();
  const roundNumber = store.getRounds().length + 1;
  const holidays = store.getHolidays();

  const { round, pairIds, freePassMemberId } = generateRound(
    members,
    pairingHistory,
    previousRound,
    roundNumber,
    holidays
  );

  store.addRound(round);
  store.addPairingRecord(roundNumber, pairIds);

  if (freePassMemberId) {
    const member = store.getMember(freePassMemberId);
    if (member) {
      store.updateMember(freePassMemberId, {
        freePassCount: member.freePassCount + 1,
        lastFreePassRound: roundNumber,
      });
    }
  }

  const allMembers = store.getActiveMembers();
  if (allMembers.length > 0 && allMembers.every((m) => m.freePassCount > 0)) {
    allMembers.forEach((m) => store.updateMember(m.id, { freePassCount: 0 }));
  }

  store.addChangelogEntry({
    type: 'round_created',
    message: `Round ${roundNumber} 생성됨 (${round.totalWeeks}주)`,
    detail: freePassMemberId
      ? `프리패스: ${store.getMember(freePassMemberId)?.nickname}`
      : '프리패스 없음',
  });
}

function updateWeekStatuses() {
  const round = store.getCurrentRound();
  if (!round) return;

  const currentIdx = getCurrentWeekIndex(round);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  round.weeks.forEach((week, i) => {
    if (week.isSkipped) {
      week.status = 'skipped';
    } else if (i < currentIdx) {
      week.status = 'done';
    } else if (i === currentIdx) {
      const weekDate = new Date(week.date + 'T00:00:00');
      const nextWeek = new Date(weekDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      week.status = today >= weekDate && today < nextWeek ? 'active' : (today < weekDate ? 'upcoming' : 'done');
    } else {
      week.status = 'upcoming';
    }
  });

  store.updateRound(round);
}

// ── Events ──
function bindEvents() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.tab;
      updateTabUI();
      render();
    });
  });

  document.getElementById('btn-admin')?.addEventListener('click', () => {
    currentView = 'admin';
    updateTabUI();
    render();
  });
}

function updateTabUI() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const isActive = btn.dataset.tab === currentView;
    btn.classList.toggle('text-accent', isActive);
    btn.classList.toggle('border-b-2', isActive);
    btn.classList.toggle('border-accent', isActive);
    btn.classList.toggle('text-content-secondary', !isActive);
  });
}

// ── Render ──
function render() {
  const main = document.getElementById('main-content');
  if (!main) return;

  switch (currentView) {
    case 'board':
      main.innerHTML = renderBoard();
      bindBoardEvents();
      break;
    case 'checklist':
      main.innerHTML = renderChecklist();
      bindChecklistEvents();
      break;
    case 'changelog':
      main.innerHTML = renderChangelog();
      document.querySelectorAll('[data-delete-log]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.deleteLog, 10);
          if (!confirm('이 로그를 삭제하시겠습니까?')) return;
          store.removeChangelogEntry(idx);
          render();
        });
      });
      break;
    case 'guide':
      main.innerHTML = renderGuide();
      break;
    case 'admin':
      main.innerHTML = renderAdmin();
      bindAdminEvents();
      break;
  }
}

// ── Board View ──
function renderBoard() {
  const round = store.getCurrentRound();
  if (!round) return '<p class="text-content-secondary p-8">라운드 데이터가 없습니다.</p>';

  const currentIdx = getCurrentWeekIndex(round);
  const currentWeek = round.weeks[currentIdx];
  if (!currentWeek) return '<p class="text-content-secondary p-8">현재 주차를 찾을 수 없습니다.</p>';
  const members = store.getMembers();

  const getMember = (id) => members.find((m) => m.id === id);
  const member1 = getMember(currentWeek.memberIds[0]);
  const member2 = getMember(currentWeek.memberIds[1]);
  const freePassMember = round.freePassId ? getMember(round.freePassId) : null;

  const template = store.getChecklistTemplate();
  const allItems = template.flatMap((c) => c.items);
  const checked = allItems.filter((item) => currentWeek.checklistStatus[item.id]).length;

  const nextWeek = round.weeks.find((w, i) => i > currentIdx && !w.isSkipped);
  const next1 = nextWeek ? getMember(nextWeek.memberIds[0]) : null;
  const next2 = nextWeek ? getMember(nextWeek.memberIds[1]) : null;

  return `
    <!-- Hero Card -->
    <div class="border border-accent/50 bg-surface-secondary rounded-2xl p-6 sm:p-8">
      <div class="flex items-center justify-between mb-6">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent">이번 주 당번</span>
        <span class="text-xs font-mono text-content-tertiary">Round ${round.number} · W${currentWeek.weekNumber}</span>
      </div>

      <div class="flex items-center justify-center gap-6 sm:gap-10 mb-6">
        <div class="text-center">
          <div class="w-16 h-16 rounded-full bg-surface-tertiary flex items-center justify-center text-3xl mb-2">${member1?.avatarEmoji || '👤'}</div>
          <p class="text-lg font-semibold text-content-primary">${member1?.nickname || '?'}</p>
          <p class="text-sm text-content-secondary">${member1?.nameEn || ''}</p>
        </div>
        <span class="text-content-tertiary text-sm font-mono">&</span>
        <div class="text-center">
          <div class="w-16 h-16 rounded-full bg-surface-tertiary flex items-center justify-center text-3xl mb-2">${member2?.avatarEmoji || '👤'}</div>
          <p class="text-lg font-semibold text-content-primary">${member2?.nickname || '?'}</p>
          <p class="text-sm text-content-secondary">${member2?.nameEn || ''}</p>
        </div>
      </div>

      <div class="flex items-center justify-center gap-4 text-sm text-content-secondary mb-5">
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          ${formatDateKr(currentWeek.date)}
        </span>
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          16:00 - 17:00
        </span>
      </div>

      <div class="mb-5">
        <div class="flex items-center justify-between text-xs text-content-tertiary mb-1.5">
          <span>체크리스트</span><span class="font-mono">${checked}/${allItems.length}</span>
        </div>
        <div class="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div class="h-full bg-accent rounded-full transition-all duration-300" style="width:${allItems.length ? (checked / allItems.length) * 100 : 0}%"></div>
        </div>
      </div>

      <div class="flex gap-3">
        <button data-tab="checklist" class="board-link flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm text-content-secondary border border-line hover:border-line-hover hover:bg-surface-tertiary transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          체크리스트
        </button>
        <button id="btn-swap" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm text-content-secondary border border-line hover:border-line-hover hover:bg-surface-tertiary transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M8 3l4 4-4 4"/><path d="M16 21l-4-4 4-4"/><path d="M12 7h7a2 2 0 012 2v2"/><path d="M12 17H5a2 2 0 01-2-2v-2"/></svg>
          대체 요청
        </button>
      </div>
    </div>

    ${nextWeek ? `
      <div class="mt-4 flex items-center gap-3 px-4 py-3 bg-surface-secondary/50 rounded-xl border border-line/50">
        <span class="text-xs text-content-tertiary whitespace-nowrap">다음 주</span>
        <div class="flex items-center gap-2">
          <span class="text-base">${next1?.avatarEmoji || '👤'}</span>
          <span class="text-sm text-content-secondary">${next1?.nickname}</span>
          <span class="text-content-tertiary text-xs">&</span>
          <span class="text-base">${next2?.avatarEmoji || '👤'}</span>
          <span class="text-sm text-content-secondary">${next2?.nickname}</span>
        </div>
      </div>` : ''}

    <!-- Round schedule -->
    <div class="mt-6 bg-surface-secondary rounded-xl border border-line">
      <div class="px-5 py-4 border-b border-line">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-content-primary flex items-center gap-2">
            <svg class="w-4 h-4 text-content-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            Round ${round.number} 스케줄
          </h2>
          <span class="text-xs font-mono text-content-tertiary">${round.totalWeeks}주</span>
        </div>
      </div>

      <div class="divide-y divide-line">
        ${round.weeks.map((week, i) => {
          const w1 = getMember(week.memberIds[0]);
          const w2 = getMember(week.memberIds[1]);
          const isCurrent = i === currentIdx && !week.isSkipped;
          const isDone = week.status === 'done';
          const isSkipped = week.isSkipped;
          return `
          <div class="flex items-center px-5 py-3 ${isCurrent ? 'bg-accent/5' : ''} ${isSkipped ? 'opacity-40' : ''} hover:bg-surface-tertiary/50 transition-colors">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              ${isCurrent ? '<div class="w-0.5 h-8 bg-accent rounded-full -ml-1 mr-2"></div>' : ''}
              <span class="text-xs font-mono ${isCurrent ? 'text-accent font-semibold' : isDone ? 'text-content-tertiary' : 'text-content-secondary'} w-7 shrink-0">W${week.weekNumber}</span>
              <span class="text-xs font-mono ${isDone || isSkipped ? 'text-content-tertiary' : 'text-content-secondary'} w-12 shrink-0">${formatDateShort(week.date)}</span>
              <div class="flex items-center gap-1.5 min-w-0 ${isDone ? 'opacity-50' : ''}">
                <span class="text-sm">${w1?.avatarEmoji || '👤'}</span>
                <span class="text-sm ${isCurrent ? 'text-content-primary font-medium' : isDone || isSkipped ? 'text-content-tertiary' : 'text-content-secondary'} truncate">${isSkipped ? `<s>${w1?.nickname}</s>` : w1?.nickname}</span>
                <span class="text-content-tertiary text-xs mx-0.5">&</span>
                <span class="text-sm">${w2?.avatarEmoji || '👤'}</span>
                <span class="text-sm ${isCurrent ? 'text-content-primary font-medium' : isDone || isSkipped ? 'text-content-tertiary' : 'text-content-secondary'} truncate">${isSkipped ? `<s>${w2?.nickname}</s>` : w2?.nickname}</span>
              </div>
            </div>
            <div class="shrink-0 ml-2">
              ${isSkipped ? '<span class="text-xs px-2 py-0.5 rounded-full bg-surface-tertiary text-content-tertiary">스킵</span>'
                : isCurrent ? '<span class="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent">이번 주</span>'
                : isDone ? '<svg class="w-4 h-4 text-content-tertiary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>'
                : ''}
            </div>
          </div>`;
        }).join('')}
      </div>

      ${freePassMember ? `
        <div class="px-5 py-3 border-t border-line flex items-center gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-freepass/15 text-freepass">
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5zM5 12a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 00-2-2H5z"/></svg>
            프리패스
          </span>
          <span class="text-sm">${freePassMember.avatarEmoji}</span>
          <span class="text-sm text-freepass">${freePassMember.nickname}</span>
          <span class="text-xs text-content-tertiary ml-1">다음 라운드 W1 우선 배정</span>
        </div>` : ''}
    </div>
  `;
}

function bindBoardEvents() {
  document.querySelectorAll('.board-link[data-tab="checklist"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentView = 'checklist';
      updateTabUI();
      render();
    });
  });
  document.getElementById('btn-swap')?.addEventListener('click', () => openSwapModal());
}

// ── Swap Modal ──
function openSwapModal() {
  const round = store.getCurrentRound();
  if (!round) return;
  const currentIdx = getCurrentWeekIndex(round);
  const currentWeek = round.weeks[currentIdx];
  const members = store.getMembers();
  const getMember = (id) => members.find((m) => m.id === id);

  const currentMembers = currentWeek.memberIds.map(getMember);
  const otherWeeks = round.weeks
    .filter((w, i) => i > currentIdx && !w.isSkipped)
    .map((w) => ({
      weekNumber: w.weekNumber,
      date: w.date,
      members: w.memberIds.map(getMember),
    }));

  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4';
  backdrop.id = 'swap-modal';
  backdrop.innerHTML = `
    <div class="bg-surface-elevated w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-line max-h-[80vh] flex flex-col">
      <div class="px-5 py-4 border-b border-line flex items-center justify-between shrink-0">
        <h3 class="font-semibold text-content-primary">대체자 변경</h3>
        <button id="close-swap" class="text-content-tertiary hover:text-content-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-5 overflow-y-auto">
        <p class="text-sm text-content-secondary mb-4">
          W${currentWeek.weekNumber} 당번 (${currentMembers.map((m) => m?.nickname).join(' & ')})을 교환할 주차를 선택하세요.
        </p>
        ${otherWeeks.length ? otherWeeks.map((w) => `
            <button data-swap-week="${w.weekNumber}" class="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-line hover:border-line-hover hover:bg-surface-tertiary transition-colors mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono text-content-tertiary w-7">W${w.weekNumber}</span>
                <span class="text-xs font-mono text-content-secondary">${formatDateShort(w.date)}</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-sm">${w.members[0]?.avatarEmoji}</span>
                  <span class="text-sm text-content-secondary">${w.members[0]?.nickname}</span>
                  <span class="text-content-tertiary text-xs">&</span>
                  <span class="text-sm">${w.members[1]?.avatarEmoji}</span>
                  <span class="text-sm text-content-secondary">${w.members[1]?.nickname}</span>
                </div>
              </div>
              <svg class="w-4 h-4 text-content-tertiary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M8 3l4 4-4 4"/><path d="M16 21l-4-4 4-4"/></svg>
            </button>`).join('')
          : '<p class="text-sm text-content-tertiary">교환 가능한 주차가 없습니다.</p>'}
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector('#close-swap')?.addEventListener('click', () => backdrop.remove());

  backdrop.querySelectorAll('[data-swap-week]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetWeekNum = parseInt(btn.dataset.swapWeek);
      performSwap(currentIdx, targetWeekNum - 1);
      backdrop.remove();
      render();
    });
  });
}

function performSwap(weekIdx1, weekIdx2) {
  const round = store.getCurrentRound();
  if (!round) return;
  const members = store.getMembers();
  const getMember = (id) => members.find((m) => m.id === id);

  const temp = [...round.weeks[weekIdx1].memberIds];
  round.weeks[weekIdx1].memberIds = [...round.weeks[weekIdx2].memberIds];
  round.weeks[weekIdx2].memberIds = temp;

  store.updateRound(round);
  store.addChangelogEntry({
    type: 'swap',
    message: `W${round.weeks[weekIdx1].weekNumber} ↔ W${round.weeks[weekIdx2].weekNumber} 교환`,
    detail: `${getMember(temp[0])?.nickname} & ${getMember(temp[1])?.nickname} ↔ ${getMember(round.weeks[weekIdx1].memberIds[0])?.nickname} & ${getMember(round.weeks[weekIdx1].memberIds[1])?.nickname}`,
  });
}

// ── Checklist View ──
function renderChecklist() {
  const round = store.getCurrentRound();
  if (!round) return '<p class="text-content-secondary p-8">라운드 데이터가 없습니다.</p>';

  const currentIdx = getCurrentWeekIndex(round);
  const week = round.weeks[currentIdx];
  if (!week) return '<p class="text-content-secondary p-8">현재 주차를 찾을 수 없습니다.</p>';
  const template = store.getChecklistTemplate();
  const members = store.getMembers();
  const getMember = (id) => members.find((m) => m.id === id);
  const m1 = getMember(week.memberIds[0]);
  const m2 = getMember(week.memberIds[1]);

  const allItems = template.flatMap((c) => c.items);
  const checked = allItems.filter((item) => week.checklistStatus[item.id]).length;

  return `
    <div class="bg-surface-secondary rounded-xl border border-line">
      <div class="px-5 py-4 border-b border-line">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-content-primary">W${week.weekNumber} 청소 체크리스트</h2>
          <span class="text-xs font-mono text-content-tertiary">${checked}/${allItems.length}</span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-sm">${m1?.avatarEmoji}</span>
          <span class="text-sm text-content-secondary">${m1?.nickname}</span>
          <span class="text-content-tertiary text-xs">&</span>
          <span class="text-sm">${m2?.avatarEmoji}</span>
          <span class="text-sm text-content-secondary">${m2?.nickname}</span>
          <span class="text-xs text-content-tertiary ml-2">${formatDateKr(week.date)}</span>
        </div>
        <div class="mt-3 w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div class="h-full bg-accent rounded-full transition-all duration-300" style="width:${allItems.length ? (checked / allItems.length) * 100 : 0}%"></div>
        </div>
      </div>
      <div class="p-5 space-y-6">
        ${template.map((cat) => `
          <div>
            <h3 class="text-sm font-medium text-content-secondary mb-3">${cat.category}</h3>
            <div class="space-y-1">
              ${cat.items.map((item) => {
                const isChecked = week.checklistStatus[item.id];
                return `
                <label data-check-id="${item.id}" class="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-tertiary/50 cursor-pointer transition-colors group">
                  <div class="mt-0.5 w-5 h-5 rounded border ${isChecked ? 'bg-accent border-accent' : 'border-line group-hover:border-line-hover'} flex items-center justify-center shrink-0 transition-colors">
                    ${isChecked ? '<svg class="w-3 h-3 text-surface-primary" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>' : ''}
                  </div>
                  <span class="text-sm ${isChecked ? 'text-content-tertiary line-through' : 'text-content-primary'} transition-colors">${item.label}</span>
                  ${!item.required ? '<span class="text-xs text-content-tertiary ml-auto shrink-0">선택</span>' : ''}
                </label>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>
    ${checked === allItems.length ? `
      <div class="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-xl text-center">
        <p class="text-accent font-medium">모든 항목을 완료했습니다! 수고하셨습니다 🎉</p>
      </div>` : ''}`;
}

function bindChecklistEvents() {
  document.querySelectorAll('[data-check-id]').forEach((label) => {
    label.addEventListener('click', (e) => {
      e.preventDefault();
      const itemId = label.dataset.checkId;
      const round = store.getCurrentRound();
      if (!round) return;
      const currentIdx = getCurrentWeekIndex(round);
      const week = round.weeks[currentIdx];
      week.checklistStatus[itemId] = !week.checklistStatus[itemId];
      store.updateRound(round);
      render();
    });
  });
}

// ── Changelog View ──
function renderChangelog() {
  const log = store.getChangelog();
  if (!log.length) {
    return '<div class="bg-surface-secondary rounded-xl border border-line p-8 text-center"><p class="text-content-tertiary">변경 이력이 없습니다.</p></div>';
  }

  return `
    <div class="bg-surface-secondary rounded-xl border border-line">
      <div class="px-5 py-4 border-b border-line">
        <h2 class="text-base font-semibold text-content-primary flex items-center gap-2">
          <svg class="w-4 h-4 text-content-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
          변경 로그
        </h2>
      </div>
      <div class="divide-y divide-line">
        ${log.map((entry, idx) => {
          const d = new Date(entry.timestamp);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          const icon = entry.type === 'round_created' ? '🔄' : entry.type === 'swap' ? '🔀'
            : entry.type === 'member_added' ? '➕' : entry.type === 'member_removed' ? '➖'
            : entry.type === 'skip' ? '⏭️' : entry.type === 'skip_undo' ? '↩️' : '📝';
          return `
          <div class="px-5 py-3 group">
            <div class="flex items-start gap-3">
              <span class="text-base mt-0.5">${icon}</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-content-primary">${entry.message}</p>
                ${entry.detail ? `<p class="text-xs text-content-tertiary mt-0.5">${entry.detail}</p>` : ''}
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-xs font-mono text-content-tertiary">${dateStr} ${timeStr}</span>
                <button data-delete-log="${idx}" class="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-content-tertiary hover:text-red-400 hover:bg-red-500/10 transition-all" title="삭제">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── Guide View ──
function renderGuide() {
  return `
    <div class="bg-surface-secondary rounded-xl border border-line">
      <div class="px-5 py-4 border-b border-line">
        <h2 class="text-base font-semibold text-content-primary">사무실 이용 가이드</h2>
      </div>
      <div class="p-5 space-y-6 text-sm">
        <div>
          <h3 class="font-medium text-content-primary mb-2">♻️ 분리수거</h3>
          <ul class="space-y-1.5 text-content-secondary">
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>개인 쓰레기통 → 일반 쓰레기만</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>캔/병/플라스틱 → 화장실 앞 분리수거함</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>음식물 → 외부 쓰레기통 (사무실 내 금지)</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>목요일 퇴근 전 개인 책상 위 음식물류 정리 필수</li>
          </ul>
        </div>
        <div>
          <h3 class="font-medium text-content-primary mb-2">🧽 회의실 사용 후</h3>
          <ul class="space-y-1.5 text-content-secondary">
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>개인 물품 및 쓰레기 반드시 수거</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>테이블 정리, 의자 밀기는 사용자 직접</li>
          </ul>
        </div>
        <div>
          <h3 class="font-medium text-content-primary mb-2">☕ 공용 공간</h3>
          <ul class="space-y-1.5 text-content-secondary">
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>커피/라면 머신 사용 후 정리 (이물질 닦기, 캡슐 버리기)</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>사용한 컵/텀블러는 개인이 세척</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>공용 물건(청소기, 리모컨 등) 사용 후 제자리</li>
          </ul>
        </div>
        <div>
          <h3 class="font-medium text-content-primary mb-2">🚨 기타</h3>
          <ul class="space-y-1.5 text-content-secondary">
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>바닥 물/음료 흘림 → 즉시 닦기</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>청소 도구는 정해진 위치에 보관, 누구나 사용 가능</li>
            <li class="flex items-start gap-2"><span class="text-content-tertiary mt-0.5">·</span>눈에 보이는 오염/쓰레기는 발견자가 처리하는 문화 만들기</li>
          </ul>
        </div>
      </div>
    </div>`;
}

// ── Admin View ──
function renderAdmin() {
  const members = store.getMembers();
  const active = members.filter((m) => m.isActive && !m.isExempt);
  const exempt = members.filter((m) => m.isActive && m.isExempt);
  const round = store.getCurrentRound();
  const config = store.getConfig();
  const holidays = store.getHolidays();

  return `
    <div class="space-y-6">
      <!-- Member Management -->
      <div class="bg-surface-secondary rounded-xl border border-line">
        <div class="px-5 py-4 border-b border-line">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-content-primary flex items-center gap-2">
              <svg class="w-4 h-4 text-content-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              구성원 관리
            </h2>
            <span class="text-xs text-content-tertiary">${active.length}명 활성${exempt.length ? ` / ${exempt.length}명 면제` : ''}</span>
          </div>
        </div>
        <div class="divide-y divide-line">
          ${members.map((m) => `
            <div class="flex items-center px-5 py-3 hover:bg-surface-tertiary/50 transition-colors">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <span class="text-xl">${m.avatarEmoji}</span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium ${m.isActive ? 'text-content-primary' : 'text-content-tertiary'}">${m.nickname}</span>
                    <span class="text-xs text-content-tertiary">(${m.nameEn})</span>
                    ${m.role ? `<span class="text-xs text-content-tertiary">· ${m.role}</span>` : ''}
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    ${m.isExempt ? '<span class="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">면제</span>'
                      : m.isActive ? '<span class="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">활성</span>'
                      : '<span class="text-xs px-1.5 py-0.5 rounded bg-surface-tertiary text-content-tertiary">비활성</span>'}
                    <span class="text-xs text-freepass">🎫 ×${m.freePassCount}</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button data-edit-member="${m.id}" class="px-2 py-1 text-xs rounded border border-line hover:border-line-hover hover:bg-surface-tertiary text-content-tertiary transition-colors" title="수정">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                ${m.isActive
                  ? `<button data-toggle-exempt="${m.id}" class="px-2 py-1 text-xs rounded border border-line hover:border-line-hover hover:bg-surface-tertiary text-content-secondary transition-colors">${m.isExempt ? '면제 해제' : '면제'}</button>
                     <button data-deactivate="${m.id}" class="px-2 py-1 text-xs rounded border border-line hover:border-red-500/30 hover:text-red-400 text-content-tertiary transition-colors">비활성</button>`
                  : `<button data-activate="${m.id}" class="px-2 py-1 text-xs rounded border border-line hover:border-accent/30 hover:text-accent text-content-tertiary transition-colors">활성화</button>`}
              </div>
            </div>`).join('')}
        </div>
        <div class="px-5 py-4 border-t border-line">
          <button id="btn-add-member" class="flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            멤버 추가
          </button>
        </div>
      </div>

      <!-- Round Management -->
      <div class="bg-surface-secondary rounded-xl border border-line">
        <div class="px-5 py-4 border-b border-line">
          <h2 class="text-base font-semibold text-content-primary flex items-center gap-2">
            <svg class="w-4 h-4 text-content-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            라운드 관리
          </h2>
        </div>
        <div class="p-5">
          ${round ? `
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-content-secondary">현재 라운드</span>
                <span class="text-sm font-mono text-content-primary">Round ${round.number}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-content-secondary">기간</span>
                <span class="text-xs font-mono text-content-tertiary">${round.startDate} ~ ${round.endDate}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-content-secondary">프리패스</span>
                <span class="text-sm text-freepass">${round.freePassId ? store.getMember(round.freePassId)?.nickname || round.freePassId : '없음'}</span>
              </div>
            </div>
            ${round._preSkipSnapshot ? `
            <div class="mt-4 p-3 rounded-lg border border-freepass/30 bg-freepass/5">
              <div class="flex items-center justify-between">
                <span class="text-xs text-freepass">W${round.weeks[round._preSkipSnapshot.weekIndex].weekNumber} 스킵됨</span>
                <button id="btn-undo-skip" class="text-xs px-3 py-1 rounded-lg border border-freepass/40 text-freepass hover:bg-freepass/10 transition-colors">스킵 취소</button>
              </div>
            </div>` : ''}
            <div class="flex gap-2 mt-5">
              <button id="btn-skip-week" class="flex-1 py-2 text-sm rounded-lg border border-line hover:border-line-hover hover:bg-surface-tertiary text-content-secondary transition-colors">이번 주 스킵</button>
              <button id="btn-new-round" class="flex-1 py-2 text-sm rounded-lg bg-accent text-surface-primary font-medium hover:bg-accent-hover transition-colors">새 라운드 생성</button>
            </div>` : '<p class="text-sm text-content-tertiary">라운드 없음</p>'}
        </div>
      </div>

      <!-- Holiday Management -->
      <div class="bg-surface-secondary rounded-xl border border-line">
        <div class="px-5 py-4 border-b border-line">
          <h2 class="text-base font-semibold text-content-primary flex items-center gap-2">
            <svg class="w-4 h-4 text-content-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            공휴일 관리
          </h2>
          <p class="text-xs text-content-tertiary mt-1">목요일이 공휴일이면 라운드 날짜가 자동으로 밀립니다.</p>
        </div>
        <div class="divide-y divide-line max-h-60 overflow-y-auto">
          ${holidays.map((h) => {
            const d = new Date(h.date + 'T00:00:00');
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const isThursday = d.getDay() === 4;
            return `
            <div class="flex items-center justify-between px-5 py-2.5">
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono ${isThursday ? 'text-red-400 font-semibold' : 'text-content-tertiary'} w-24">${h.date}</span>
                <span class="text-xs text-content-tertiary">(${dayNames[d.getDay()]})</span>
                <span class="text-sm text-content-secondary">${h.name}</span>
                ${isThursday ? '<span class="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">목요일</span>' : ''}
              </div>
              <button data-remove-holiday="${h.date}" class="text-content-tertiary hover:text-red-400 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>`;
          }).join('')}
        </div>
        <div class="px-5 py-4 border-t border-line">
          <div class="flex gap-2">
            <input id="new-holiday-date" type="date" class="flex-1 bg-surface-primary border border-line rounded-lg px-3 py-2 text-sm text-content-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
            <input id="new-holiday-name" type="text" placeholder="공휴일 이름" class="flex-1 bg-surface-primary border border-line rounded-lg px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
            <button id="btn-add-holiday" class="px-3 py-2 text-sm rounded-lg bg-accent text-surface-primary font-medium hover:bg-accent-hover transition-colors shrink-0">추가</button>
          </div>
        </div>
      </div>

      <!-- Slack Config -->
      <div class="bg-surface-secondary rounded-xl border border-line">
        <div class="px-5 py-4 border-b border-line">
          <h2 class="text-base font-semibold text-content-primary flex items-center gap-2">
            <svg class="w-4 h-4 text-content-secondary" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            알림 설정
          </h2>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="text-xs text-content-secondary block mb-1.5">Slack Webhook URL</label>
            <input id="input-webhook" type="text" value="${config.slackWebhookUrl}" placeholder="https://hooks.slack.com/services/..." class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div>
            <label class="text-xs text-content-secondary block mb-1.5">공지 채널</label>
            <input id="input-channel" type="text" value="${config.slackChannel}" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div class="flex gap-2">
            <button id="btn-save-config" class="flex-1 py-2.5 text-sm rounded-lg bg-accent text-surface-primary font-medium hover:bg-accent-hover transition-colors">저장</button>
            <button id="btn-test-slack" class="py-2.5 px-4 text-sm rounded-lg border border-line hover:border-line-hover hover:bg-surface-tertiary text-content-secondary transition-colors">테스트 전송</button>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="bg-surface-secondary rounded-xl border border-red-500/20">
        <div class="px-5 py-4 border-b border-red-500/20">
          <h2 class="text-base font-semibold text-red-400">초기화</h2>
        </div>
        <div class="p-5">
          <p class="text-sm text-content-secondary mb-4">모든 데이터를 삭제하고 초기 상태로 되돌립니다.</p>
          <button id="btn-reset" class="py-2 px-4 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">전체 초기화</button>
        </div>
      </div>
    </div>`;
}

function bindAdminEvents() {
  // Toggle exempt
  document.querySelectorAll('[data-toggle-exempt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleExempt;
      const member = store.getMember(id);
      if (!member) return;
      store.updateMember(id, { isExempt: !member.isExempt });
      store.addChangelogEntry({
        type: 'member_updated',
        message: `${member.nickname} ${member.isExempt ? '면제 해제' : '면제 설정'}`,
      });
      render();
    });
  });

  // Deactivate
  document.querySelectorAll('[data-deactivate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deactivate;
      const member = store.getMember(id);
      if (!member || !confirm(`${member.nickname}을(를) 비활성화하시겠습니까?`)) return;
      store.updateMember(id, { isActive: false });
      store.addChangelogEntry({ type: 'member_removed', message: `${member.nickname} 비활성화` });
      render();
    });
  });

  // Activate
  document.querySelectorAll('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.activate;
      const member = store.getMember(id);
      if (!member) return;
      store.updateMember(id, { isActive: true, isExempt: false });
      store.addChangelogEntry({ type: 'member_added', message: `${member.nickname} 활성화` });
      render();
    });
  });

  // Edit member
  document.querySelectorAll('[data-edit-member]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const member = store.getMember(btn.dataset.editMember);
      if (member) openEditMemberModal(member);
    });
  });

  // Add member
  document.getElementById('btn-add-member')?.addEventListener('click', openAddMemberModal);

  // Skip week — now shifts remaining dates
  document.getElementById('btn-skip-week')?.addEventListener('click', () => {
    const round = store.getCurrentRound();
    if (!round) return;
    const currentIdx = getCurrentWeekIndex(round);
    const week = round.weeks[currentIdx];
    if (!confirm(`W${week.weekNumber} (${formatDateKr(week.date)})을 스킵하시겠습니까?\n이후 주차 날짜가 한 주씩 밀립니다.`)) return;

    const holidays = store.getHolidays();
    recalculateDatesAfterSkip(round, currentIdx, holidays);
    store.updateRound(round);
    store.addChangelogEntry({
      type: 'skip',
      message: `W${week.weekNumber} 스킵 — 이후 주차 날짜 이월`,
      detail: `${formatDateKr(week.date)} (사유: 수동 스킵)`,
    });
    updateWeekStatuses();
    render();
  });

  // Undo skip
  document.getElementById('btn-undo-skip')?.addEventListener('click', () => {
    const round = store.getCurrentRound();
    if (!round) return;
    const snapshot = round._preSkipSnapshot;
    if (!snapshot) return;
    const weekNum = round.weeks[snapshot.weekIndex].weekNumber;
    if (!confirm(`W${weekNum} 스킵을 취소하시겠습니까?\n날짜가 원래대로 복원됩니다.`)) return;

    undoSkip(round);
    store.updateRound(round);
    store.addChangelogEntry({
      type: 'skip_undo',
      message: `W${weekNum} 스킵 취소 — 날짜 복원`,
    });
    updateWeekStatuses();
    render();
  });

  // New round
  document.getElementById('btn-new-round')?.addEventListener('click', () => {
    if (!confirm('새 라운드를 생성하시겠습니까? 현재 라운드가 완료 처리됩니다.')) return;
    const round = store.getCurrentRound();
    if (round) {
      round.status = 'completed';
      store.updateRound(round);
    }
    createNewRound();
    render();
  });

  // Save config
  document.getElementById('btn-save-config')?.addEventListener('click', () => {
    const config = store.getConfig();
    config.slackWebhookUrl = document.getElementById('input-webhook')?.value || '';
    config.slackChannel = document.getElementById('input-channel')?.value || '#office-cleaning';
    store.setConfig(config);
    store.addChangelogEntry({ type: 'config', message: '알림 설정 저장됨' });
    showToast('설정이 저장되었습니다.');
  });

  // Test Slack webhook
  document.getElementById('btn-test-slack')?.addEventListener('click', async () => {
    const webhookUrl = document.getElementById('input-webhook')?.value?.trim();
    if (!webhookUrl) {
      showToast('Webhook URL을 먼저 입력해주세요.');
      return;
    }

    const btn = document.getElementById('btn-test-slack');
    btn.textContent = '전송 중...';
    btn.disabled = true;

    try {
      const round = store.getCurrentRound();
      const currentIdx = round ? getCurrentWeekIndex(round) : -1;
      const week = round?.weeks[currentIdx];
      const m1 = week ? store.getMember(week.memberIds[0]) : null;
      const m2 = week ? store.getMember(week.memberIds[1]) : null;

      const text = [
        '🧹 *[테스트] 청소 당번 알림*',
        '',
        `이번 주 당번: ${m1?.nickname || '미정'} & ${m2?.nickname || '미정'}`,
        `날짜: ${week ? formatDateKr(week.date) : '미정'}`,
        '',
        '_이 메시지는 Cleaning Board에서 보낸 테스트 알림입니다._',
      ].join('\n');

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        showToast('테스트 메시지가 전송되었습니다!');
      } else {
        showToast(`전송 실패 (HTTP ${res.status})`);
      }
    } catch (e) {
      showToast(`전송 실패: ${e.message}`);
    } finally {
      btn.textContent = '테스트 전송';
      btn.disabled = false;
    }
  });

  // Holiday management
  document.querySelectorAll('[data-remove-holiday]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const date = btn.dataset.removeHoliday;
      store.removeHoliday(date);
      render();
    });
  });

  document.getElementById('btn-add-holiday')?.addEventListener('click', () => {
    const dateInput = document.getElementById('new-holiday-date');
    const nameInput = document.getElementById('new-holiday-name');
    const date = dateInput?.value;
    const name = nameInput?.value?.trim();
    if (!date || !name) {
      showToast('날짜와 이름을 입력해주세요.');
      return;
    }
    store.addHoliday({ date, name });
    showToast(`${name} (${date}) 추가됨`);
    render();
  });

  // Reset
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (!confirm('정말 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    if (!confirm('마지막 확인: 모든 라운드, 체크리스트, 변경 이력이 삭제됩니다.')) return;
    store.reset();
    location.reload();
  });
}

function openAddMemberModal() {
  const emojis = ['😀', '😎', '🤖', '👻', '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐸', '🌟', '⚡', '🔥', '💎', '🎯'];

  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4';
  backdrop.id = 'add-member-modal';
  backdrop.innerHTML = `
    <div class="bg-surface-elevated w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-line">
      <div class="px-5 py-4 border-b border-line flex items-center justify-between">
        <h3 class="font-semibold text-content-primary">멤버 추가</h3>
        <button id="close-add" class="text-content-tertiary hover:text-content-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">닉네임 (한글)</label>
          <input id="new-nickname" type="text" placeholder="예: 노아" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">이름 (영문)</label>
          <input id="new-name-en" type="text" placeholder="예: Noah" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">이름 (한글)</label>
          <input id="new-name-kr" type="text" placeholder="예: 홍길동" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">역할</label>
          <input id="new-role" type="text" placeholder="예: 디자이너 (선택)" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">아바타 이모지</label>
          <div class="flex flex-wrap gap-2">
            ${emojis.map((e, i) => `<button data-emoji="${e}" class="emoji-btn w-10 h-10 rounded-lg border ${i === 0 ? 'border-accent bg-accent/15' : 'border-line hover:border-line-hover hover:bg-surface-tertiary'} flex items-center justify-center text-lg transition-colors">${e}</button>`).join('')}
          </div>
        </div>
        <button id="btn-confirm-add" class="w-full py-2.5 text-sm rounded-lg bg-accent text-surface-primary font-medium hover:bg-accent-hover transition-colors mt-2">추가</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedEmoji = emojis[0];
  backdrop.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      backdrop.querySelectorAll('.emoji-btn').forEach((b) => {
        b.classList.remove('border-accent', 'bg-accent/15');
        b.classList.add('border-line');
      });
      btn.classList.add('border-accent', 'bg-accent/15');
      btn.classList.remove('border-line');
      selectedEmoji = btn.dataset.emoji;
    });
  });

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector('#close-add')?.addEventListener('click', () => backdrop.remove());

  backdrop.querySelector('#btn-confirm-add')?.addEventListener('click', () => {
    const nickname = document.getElementById('new-nickname')?.value.trim();
    const nameEn = document.getElementById('new-name-en')?.value.trim();
    const nameKr = document.getElementById('new-name-kr')?.value.trim();
    const role = document.getElementById('new-role')?.value.trim() || '';

    if (!nickname || !nameEn || !nameKr) {
      showToast('닉네임, 영문 이름, 한글 이름은 필수입니다.');
      return;
    }

    const id = nameEn.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (store.getMember(id)) {
      showToast('이미 존재하는 ID입니다.');
      return;
    }

    store.addMember({
      id, nickname, nameEn, nameKr, role,
      isActive: true, isExempt: false, exemptReason: '',
      joinedAt: new Date().toISOString().split('T')[0],
      avatarEmoji: selectedEmoji,
      freePassCount: 0, lastFreePassRound: null, lastCleaningRound: null, lastCleaningWeek: null,
    });

    store.addChangelogEntry({
      type: 'member_added',
      message: `${nickname} (${nameEn}) 추가됨`,
      detail: '다음 라운드부터 참여',
    });

    backdrop.remove();
    render();
    showToast(`${nickname}이(가) 추가되었습니다.`);
  });
}

function openEditMemberModal(member) {
  const emojis = ['😀', '😎', '🤖', '👻', '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐸', '🌟', '⚡', '🔥', '💎', '🎯',
    '🦸', '👦', '🎨', '🌿', '🎸', '🌸', '🌊', '🎮', '🏄', '🦋', '🌙', '💫', '☄️', '🧸', '🌈'];

  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4';
  backdrop.innerHTML = `
    <div class="bg-surface-elevated w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-line">
      <div class="px-5 py-4 border-b border-line flex items-center justify-between">
        <h3 class="font-semibold text-content-primary">멤버 수정</h3>
        <button id="close-edit" class="text-content-tertiary hover:text-content-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">닉네임 (한글)</label>
          <input id="edit-nickname" type="text" value="${member.nickname}" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">이름 (영문)</label>
          <input id="edit-name-en" type="text" value="${member.nameEn}" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">이름 (한글)</label>
          <input id="edit-name-kr" type="text" value="${member.nameKr}" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">역할</label>
          <input id="edit-role" type="text" value="${member.role || ''}" class="w-full bg-surface-primary border border-line rounded-lg px-3 py-2.5 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-colors" />
        </div>
        <div>
          <label class="text-xs text-content-secondary block mb-1.5">아바타 이모지</label>
          <div class="flex flex-wrap gap-2">
            ${[...new Set([member.avatarEmoji, ...emojis])].map((e) => `<button data-emoji="${e}" class="emoji-btn w-10 h-10 rounded-lg border ${e === member.avatarEmoji ? 'border-accent bg-accent/15' : 'border-line hover:border-line-hover hover:bg-surface-tertiary'} flex items-center justify-center text-lg transition-colors">${e}</button>`).join('')}
          </div>
        </div>
        <button id="btn-confirm-edit" class="w-full py-2.5 text-sm rounded-lg bg-accent text-surface-primary font-medium hover:bg-accent-hover transition-colors mt-2">저장</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedEmoji = member.avatarEmoji;
  backdrop.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      backdrop.querySelectorAll('.emoji-btn').forEach((b) => {
        b.classList.remove('border-accent', 'bg-accent/15');
        b.classList.add('border-line');
      });
      btn.classList.add('border-accent', 'bg-accent/15');
      btn.classList.remove('border-line');
      selectedEmoji = btn.dataset.emoji;
    });
  });

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.querySelector('#close-edit')?.addEventListener('click', () => backdrop.remove());

  backdrop.querySelector('#btn-confirm-edit')?.addEventListener('click', () => {
    const nickname = document.getElementById('edit-nickname')?.value.trim();
    const nameEn = document.getElementById('edit-name-en')?.value.trim();
    const nameKr = document.getElementById('edit-name-kr')?.value.trim();
    const role = document.getElementById('edit-role')?.value.trim() || '';

    if (!nickname || !nameEn || !nameKr) {
      showToast('닉네임, 영문 이름, 한글 이름은 필수입니다.');
      return;
    }

    store.updateMember(member.id, { nickname, nameEn, nameKr, role, avatarEmoji: selectedEmoji });
    store.addChangelogEntry({
      type: 'member_updated',
      message: `${member.nickname} 정보 수정`,
      detail: `닉네임: ${nickname}, 영문: ${nameEn}, 역할: ${role || '없음'}`,
    });

    backdrop.remove();
    render();
    showToast(`${nickname} 정보가 수정되었습니다.`);
  });
}

// ── Toast ──
function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 bg-surface-elevated border border-line rounded-lg px-4 py-2.5 text-sm text-content-primary shadow-lg z-50 transition-opacity';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ── Start ──
document.addEventListener('DOMContentLoaded', () => init());
