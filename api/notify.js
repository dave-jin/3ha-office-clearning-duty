const { kv } = require('@vercel/kv');

const KEY = 'cleaning_board_data';
const BOARD_URL = 'https://3ha-office-clearning-duty.vercel.app';

// Fun rotating messages for variety
const FUN_INTROS = [
  '오늘의 청소 히어로가 등장했습니다! 🦸‍♂️🦸‍♀️',
  '반짝반짝 사무실 만들기 프로젝트, 오늘의 주인공은?! ✨',
  '두구두구... 🥁 오늘의 청소 당번 발표!',
  '깨끗한 사무실의 수호자가 나타났다! 🛡️',
  '오늘의 미션: 사무실을 빛나게! 🌟',
  '청소 요정이 출동합니다~ 🧚',
];

const FUN_OUTROS = [
  '💪 화이팅! 청소 후 뿌듯함은 덤!',
  '🎵 신나는 음악 틀고 후다닥 끝내버려요!',
  '⚡ 15~20분이면 끝! 가볍게 시작해봐요~',
  '🌈 깨끗한 사무실에서 내일도 화이팅!',
  '🧹 후딱 끝내고 퇴근 고고! 🏃‍♂️💨',
  '🫧 오늘도 세시간전을 빛내주셔서 감사합니다!',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = days[d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${dow})`;
}

function todayStr() {
  // Use KST (UTC+9)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = async function handler(req, res) {
  // Verify this is a legitimate cron call (Vercel sets this header)
  // In production, Vercel Cron sends CRON_SECRET in Authorization header
  // For manual trigger / testing, allow without auth
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow GET without auth for manual testing (but log it)
    console.log('Notify endpoint called without CRON_SECRET auth');
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  try {
    // Read data from KV
    const data = await kv.get(KEY);
    if (!data) {
      return res.status(200).json({ ok: false, reason: 'No data in KV' });
    }

    const { members, rounds, config } = data;
    const webhookUrl = config?.slackWebhookUrl;

    if (!webhookUrl) {
      return res.status(200).json({ ok: false, reason: 'No Slack webhook URL configured' });
    }

    // Find active round
    const activeRound = rounds?.find((r) => r.status === 'active');
    if (!activeRound) {
      return res.status(200).json({ ok: false, reason: 'No active round' });
    }

    // Find today's week
    const today = todayStr();
    const todayWeek = activeRound.weeks.find(
      (w) => w.date === today && !w.isSkipped
    );

    if (!todayWeek) {
      return res.status(200).json({ ok: false, reason: `No cleaning scheduled for today (${today})` });
    }

    // Get member info
    const m1 = members?.find((m) => m.id === todayWeek.memberIds[0]);
    const m2 = members?.find((m) => m.id === todayWeek.memberIds[1]);
    const name1 = m1 ? `${m1.avatarEmoji} ${m1.nickname}` : '미정';
    const name2 = m2 ? `${m2.avatarEmoji} ${m2.nickname}` : '미정';

    // Build checklist summary
    const checklistItems = [
      '바닥 청소 (진공청소기 + 물걸레)',
      '쓰레기통 비우기 + 비닐 교체',
      '회의실 정리 (책상/의자/보드)',
      '공용 집기 닦기',
    ];

    // Build playful Slack message
    const intro = pick(FUN_INTROS);
    const outro = pick(FUN_OUTROS);

    const text = [
      `🧹 *청소합시다!*`,
      '',
      intro,
      '',
      `👥 *오늘의 청소 당번:*  ${name1}  &  ${name2}`,
      `📅 ${formatDate(todayWeek.date)}  |  ⏰ 오후 4:00 ~ 5:00`,
      '',
      `📋 *오늘의 체크리스트:*`,
      ...checklistItems.map((item) => `    • ${item}`),
      '',
      `🔗 <${BOARD_URL}?tab=checklist|체크리스트 확인하고 완료 체크하기>`,
      '',
      outro,
    ].join('\n');

    // Send to Slack
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        icon_emoji: ':broom:',
        username: '세시간전 청소 보드',
      }),
    });

    if (slackRes.ok) {
      return res.status(200).json({ ok: true, message: `Notification sent for ${today}`, members: [name1, name2] });
    } else {
      const errBody = await slackRes.text();
      return res.status(500).json({ ok: false, error: `Slack error: ${errBody}` });
    }
  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
