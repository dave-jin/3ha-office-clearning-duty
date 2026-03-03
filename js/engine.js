// engine.js — Round assignment engine with holiday support

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePairKey(idA, idB) {
  return [idA, idB].sort().join('::');
}

function selectFreePassMember(members, previousRound) {
  const minCount = Math.min(...members.map((m) => m.freePassCount));
  let candidates = members.filter((m) => m.freePassCount === minCount);

  if (previousRound?.freePassId) {
    const filtered = candidates.filter((m) => m.id !== previousRound.freePassId);
    if (filtered.length > 0) candidates = filtered;
  }

  candidates.sort((a, b) => {
    const aRound = a.lastCleaningRound || 0;
    const bRound = b.lastCleaningRound || 0;
    return bRound - aRound;
  });

  const topRound = candidates[0]?.lastCleaningRound || 0;
  const topCandidates = candidates.filter(
    (m) => (m.lastCleaningRound || 0) === topRound
  );

  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

function tryGeneratePairs(members, prevFreePassMember, pairingHistory, relaxSoftRules) {
  const shuffled = fisherYatesShuffle(members);

  let ordered;
  if (prevFreePassMember) {
    const rest = shuffled.filter((m) => m.id !== prevFreePassMember.id);
    ordered = [prevFreePassMember, ...rest];
  } else {
    ordered = shuffled;
  }

  const pairs = [];
  for (let i = 0; i < ordered.length; i += 2) {
    pairs.push([ordered[i], ordered[i + 1]]);
  }

  const lastRoundPairs = new Set();
  const roundNumbers = [...new Set(pairingHistory.map((p) => p.roundNumber))];
  const lastRoundNum = roundNumbers.length > 0 ? Math.max(...roundNumbers) : null;
  if (lastRoundNum !== null) {
    pairingHistory
      .filter((p) => p.roundNumber === lastRoundNum)
      .forEach((p) => lastRoundPairs.add(makePairKey(p.memberA, p.memberB)));
  }

  for (const [a, b] of pairs) {
    if (lastRoundPairs.has(makePairKey(a.id, b.id))) return null;
  }

  if (!relaxSoftRules) {
    const recentRounds = roundNumbers.sort((a, b) => b - a).slice(0, 3);
    const recentPairs = new Set();
    pairingHistory
      .filter((p) => recentRounds.includes(p.roundNumber))
      .forEach((p) => recentPairs.add(makePairKey(p.memberA, p.memberB)));

    for (const [a, b] of pairs) {
      if (recentPairs.has(makePairKey(a.id, b.id))) return null;
    }
  }

  return pairs;
}

// --- Date helpers ---

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextThursday(fromDate) {
  const d = new Date(fromDate);
  const day = d.getDay();
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThursday);
  return d;
}

function getThisOrNextThursday(fromDate) {
  const d = new Date(fromDate);
  if (d.getDay() === 4) return d;
  return getNextThursday(fromDate);
}

function isHolidayDate(dateStr, holidays) {
  return holidays.some((h) => h.date === dateStr);
}

/**
 * Generate `count` valid Thursday dates starting from `startDate`,
 * skipping any date that falls on a holiday.
 */
function generateScheduleDates(startDate, count, holidays) {
  const dates = [];
  const d = new Date(startDate);

  while (dates.length < count) {
    const ds = formatDate(d);
    if (!isHolidayDate(ds, holidays)) {
      dates.push(ds);
    }
    d.setDate(d.getDate() + 7);
  }

  return dates;
}

// --- Round generation ---

export function generateRound(members, pairingHistory, previousRound, roundNumber, holidays) {
  const activeMembers = members.filter((m) => m.isActive && !m.isExempt);
  const N = activeMembers.length;

  if (N < 4) {
    throw new Error('활성 멤버가 4명 미만입니다.');
  }

  const isOdd = N % 2 !== 0;
  let freePassMember = null;
  let assignMembers = [...activeMembers];

  if (isOdd) {
    freePassMember = selectFreePassMember(activeMembers, previousRound);
    assignMembers = assignMembers.filter((m) => m.id !== freePassMember.id);
  }

  const prevFreePassId = previousRound?.freePassId || null;
  const prevFreePassMember = prevFreePassId
    ? assignMembers.find((m) => m.id === prevFreePassId)
    : null;

  let pairs = null;
  for (let attempt = 0; attempt < 100 && !pairs; attempt++) {
    pairs = tryGeneratePairs(assignMembers, prevFreePassMember, pairingHistory, attempt >= 50);
  }
  if (!pairs) {
    pairs = tryGeneratePairs(assignMembers, prevFreePassMember, [], true);
  }

  // Calculate start date
  const rawStart = previousRound
    ? getNextThursday(
        new Date(new Date(previousRound.endDate + 'T00:00:00').getTime() + 86400000)
      )
    : getThisOrNextThursday(new Date());

  // Generate dates skipping holidays
  const holidayList = holidays || [];
  const dates = generateScheduleDates(rawStart, pairs.length, holidayList);

  const weeks = pairs.map(([a, b], i) => ({
    weekNumber: i + 1,
    date: dates[i],
    memberIds: [a.id, b.id],
    status: 'upcoming',
    isSkipped: false,
    checklistStatus: {},
    substitutions: [],
  }));

  const round = {
    id: `round-${String(roundNumber).padStart(3, '0')}`,
    number: roundNumber,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    totalWeeks: pairs.length,
    status: 'active',
    freePassId: freePassMember?.id || null,
    weeks,
    createdAt: new Date().toISOString(),
  };

  const pairIds = pairs.map(([a, b]) => [a.id, b.id]);
  return { round, pairIds, freePassMemberId: freePassMember?.id || null };
}

// --- Skip & date recalculation ---

/**
 * When a week is skipped, shift all remaining weeks forward.
 * Each shifted week gets the next valid Thursday (skipping holidays).
 * Returns the mutated round object.
 */
export function recalculateDatesAfterSkip(round, skippedWeekIndex, holidays) {
  const holidayList = holidays || [];

  // The skipped week keeps its date but is marked skipped
  round.weeks[skippedWeekIndex].isSkipped = true;
  round.weeks[skippedWeekIndex].status = 'skipped';

  // Shift all subsequent non-skipped weeks forward
  let nextDate = new Date(round.weeks[skippedWeekIndex].date + 'T00:00:00');

  for (let i = skippedWeekIndex + 1; i < round.weeks.length; i++) {
    // Advance by 7 days from current position
    nextDate = new Date(nextDate.getTime() + 7 * 86400000);

    // Skip holidays
    while (isHolidayDate(formatDate(nextDate), holidayList)) {
      nextDate = new Date(nextDate.getTime() + 7 * 86400000);
    }

    round.weeks[i].date = formatDate(nextDate);
  }

  // Update round end date
  const lastWeek = round.weeks[round.weeks.length - 1];
  round.endDate = lastWeek.date;

  return round;
}

// --- Week status helpers ---

export function getCurrentWeekIndex(round) {
  if (!round) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the most recent non-skipped week that has started
  for (let i = round.weeks.length - 1; i >= 0; i--) {
    if (round.weeks[i].isSkipped) continue;
    const weekDate = new Date(round.weeks[i].date + 'T00:00:00');
    if (today >= weekDate) return i;
  }

  // If all past weeks are skipped or round hasn't started, find first non-skipped
  for (let i = 0; i < round.weeks.length; i++) {
    if (!round.weeks[i].isSkipped) return i;
  }

  return 0;
}

export function isRoundComplete(round) {
  if (!round) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find last non-skipped week
  let lastDate = null;
  for (let i = round.weeks.length - 1; i >= 0; i--) {
    if (!round.weeks[i].isSkipped) {
      lastDate = round.weeks[i].date;
      break;
    }
  }
  if (!lastDate) return true; // All weeks skipped

  const endDate = new Date(lastDate + 'T00:00:00');
  endDate.setDate(endDate.getDate() + 7);
  return today >= endDate;
}

export function formatDateKr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = days[d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${dow})`;
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
