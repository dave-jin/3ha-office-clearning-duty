// engine.js — Round assignment engine

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

  // No consecutive free passes
  if (previousRound?.freePassId) {
    const filtered = candidates.filter((m) => m.id !== previousRound.freePassId);
    if (filtered.length > 0) candidates = filtered;
  }

  // Among ties, prefer member who did duty most recently (give them a break)
  candidates.sort((a, b) => {
    const aRound = a.lastCleaningRound || 0;
    const bRound = b.lastCleaningRound || 0;
    return bRound - aRound; // higher round = more recent = prefer to give free pass
  });

  // Pick from the top tier (all with same lastCleaningRound as the first)
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

  // Hard rule: no duplicate pairs from last round
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

  // Soft rule: avoid pairs from last 3 rounds
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

function getNextThursday(fromDate) {
  const d = new Date(fromDate);
  const day = d.getDay();
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilThursday);
  return d;
}

function getThisOrNextThursday(fromDate) {
  const d = new Date(fromDate);
  if (d.getDay() === 4) return d; // Today is Thursday
  return getNextThursday(fromDate);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateRound(members, pairingHistory, previousRound, roundNumber) {
  const activeMembers = members.filter((m) => m.isActive && !m.isExempt);
  const N = activeMembers.length;

  if (N < 4) {
    throw new Error('활성 멤버가 4명 미만입니다.');
  }

  const isOdd = N % 2 !== 0;
  let freePassMember = null;
  let assignMembers = [...activeMembers];

  // Step 1: Determine free pass
  if (isOdd) {
    freePassMember = selectFreePassMember(activeMembers, previousRound);
    assignMembers = assignMembers.filter((m) => m.id !== freePassMember.id);
  }

  // Step 2: Previous round's free pass member gets Week 1 priority
  const prevFreePassId = previousRound?.freePassId || null;
  const prevFreePassMember = prevFreePassId
    ? assignMembers.find((m) => m.id === prevFreePassId)
    : null;

  // Step 3: Generate pairings with retries
  let pairs = null;
  for (let attempt = 0; attempt < 100 && !pairs; attempt++) {
    pairs = tryGeneratePairs(assignMembers, prevFreePassMember, pairingHistory, attempt >= 50);
  }

  if (!pairs) {
    pairs = tryGeneratePairs(assignMembers, prevFreePassMember, [], true);
  }

  // Step 4: Calculate dates
  const startDate = previousRound
    ? getNextThursday(
        new Date(
          new Date(previousRound.endDate + 'T00:00:00').getTime() + 24 * 60 * 60 * 1000
        )
      )
    : getThisOrNextThursday(new Date());

  const weeks = pairs.map(([a, b], i) => {
    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + i * 7);
    return {
      weekNumber: i + 1,
      date: formatDate(weekDate),
      memberIds: [a.id, b.id],
      status: 'upcoming',
      isSkipped: false,
      checklistStatus: {},
      substitutions: [],
    };
  });

  const endDateObj = new Date(startDate);
  endDateObj.setDate(endDateObj.getDate() + (pairs.length - 1) * 7);

  const round = {
    id: `round-${String(roundNumber).padStart(3, '0')}`,
    number: roundNumber,
    startDate: formatDate(startDate),
    endDate: formatDate(endDateObj),
    totalWeeks: pairs.length,
    status: 'active',
    freePassId: freePassMember?.id || null,
    weeks,
    createdAt: new Date().toISOString(),
  };

  // Return pairs for pairing history recording
  const pairIds = pairs.map(([a, b]) => [a.id, b.id]);

  return { round, pairIds, freePassMemberId: freePassMember?.id || null };
}

export function getCurrentWeekIndex(round) {
  if (!round) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = round.weeks.length - 1; i >= 0; i--) {
    const weekDate = new Date(round.weeks[i].date + 'T00:00:00');
    if (today >= weekDate) return i;
  }
  return 0; // Before round starts, show first week
}

export function isRoundComplete(round) {
  if (!round) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastWeekDate = new Date(round.weeks[round.weeks.length - 1].date + 'T00:00:00');
  const endDate = new Date(lastWeekDate);
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
