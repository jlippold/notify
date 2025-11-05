const express = require('express');
const { query } = require('../lib/db');
const { ensureTopic, subscribeDeviceToTopic, unsubscribeDeviceFromTopic } = require('../lib/snsClient');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'School Admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.post('/ensure', requireAuth, async (req, res) => {
  const { slug, name } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  const arn = await ensureTopic(slug, name);
  res.json({ topicArn: arn, slug });
});

router.get('/list', requireAuth, async (req, res) => {
  const result = await query('SELECT slug, name, sns_topic_arn FROM topics ORDER BY slug');
  res.json(result.rows);
});

router.post('/subscribe', requireAuth, async (req, res) => {
  const { deviceId, endpointArn, slug } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  const topicArn = await ensureTopic(slug, slug);
  let endpoint = endpointArn;
  if (!endpoint && deviceId) {
    const d = await query('SELECT sns_endpoint_arn FROM devices WHERE id=$1 AND user_id=$2', [deviceId, req.session.user.id]);
    if (!d.rows[0]) return res.status(404).json({ error: 'Device not found' });
    endpoint = d.rows[0].sns_endpoint_arn;
  }
  if (!endpoint) return res.status(400).json({ error: 'Missing endpointArn or deviceId' });
  const subArn = await subscribeDeviceToTopic(endpoint, topicArn);

  const topicRow = await query('SELECT id FROM topics WHERE slug=$1', [slug]);
  await query(
    'INSERT INTO subscriptions(device_id, topic_id, sns_subscription_arn) VALUES ($1,$2,$3) ON CONFLICT (device_id, topic_id) DO UPDATE SET sns_subscription_arn=EXCLUDED.sns_subscription_arn',
    [deviceId, topicRow.rows[0].id, subArn]
  );
  res.json({ subscriptionArn: subArn });
});

router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { deviceId, slug } = req.body || {};
  if (!deviceId || !slug) return res.status(400).json({ error: 'Missing deviceId or slug' });
  const sub = await query(
    `SELECT s.id, s.sns_subscription_arn FROM subscriptions s
     JOIN topics t ON t.id=s.topic_id
     WHERE s.device_id=$1 AND t.slug=$2`,
    [deviceId, slug]
  );
  if (!sub.rows[0]) return res.status(404).json({ error: 'Subscription not found' });
  if (sub.rows[0].sns_subscription_arn) await unsubscribeDeviceFromTopic(sub.rows[0].sns_subscription_arn);
  await query('DELETE FROM subscriptions WHERE id=$1', [sub.rows[0].id]);
  res.json({ ok: true });
});

module.exports = router;


