const { kv } = require('@vercel/kv');

const KEY = 'cleaning_board_data';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV_NOT_CONFIGURED' });
  }

  try {
    if (req.method === 'GET') {
      const data = await kv.get(KEY);
      return res.status(200).json(data || null);
    }

    if (req.method === 'PUT') {
      await kv.set(KEY, req.body);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('KV Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
