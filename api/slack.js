module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { webhookUrl, text } = req.body || {};
  if (!webhookUrl || !text) {
    return res.status(400).json({ error: 'webhookUrl and text are required' });
  }

  // Basic validation: only allow Slack webhook URLs
  if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
    return res.status(400).json({ error: 'Invalid webhook URL' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      return res.status(200).json({ ok: true });
    } else {
      const body = await response.text();
      return res.status(response.status).json({ error: body });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
