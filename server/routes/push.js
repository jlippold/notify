const express = require('express');
const { query } = require('../lib/db');
const { createOrGetEndpoint, ensureTopic, subscribeDeviceToTopic } = require('../lib/snsClient');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

router.post('/register', requireAuth, async (req, res) => {
  const { platform, deviceToken } = req.body || {};
  if (!platform || !deviceToken) return res.status(400).json({ error: 'Missing platform or deviceToken' });

  const endpointArn = await createOrGetEndpoint({ platform, deviceToken });

  const upsertSql = `
    INSERT INTO devices(user_id, platform, device_token, sns_endpoint_arn, enabled, last_seen_at)
    VALUES ($1,$2,$3,$4,true,now())
    ON CONFLICT (platform, device_token)
    DO UPDATE SET user_id=EXCLUDED.user_id, sns_endpoint_arn=EXCLUDED.sns_endpoint_arn, enabled=true, last_seen_at=now()
    RETURNING id, sns_endpoint_arn
  `;
  const result = await query(upsertSql, [req.session.user.id, platform, deviceToken, endpointArn]);
  const deviceId = result.rows[0].id;

  // Auto-subscribe based on role and relationships
  const role = (req.session.user.role || '').toLowerCase();
  const slugs = new Set();
  if (role) slugs.add(`school:role:${role}`);

  if (role === 'school admin' || role === 'school staff') {
    const cs = await query(
      `SELECT cs.course_id FROM course_staff cs
       JOIN staff st ON st.id=cs.staff_id
       WHERE st.user_id=$1`,
      [req.session.user.id]
    );
    cs.rows.forEach(r => slugs.add(`course:${r.course_id}:notification`));
  }

  if (role === 'student') {
    const en = await query(
      `SELECT e.course_id FROM enrollments e
       JOIN students s ON s.id=e.student_id
       WHERE s.user_id=$1`,
      [req.session.user.id]
    );
    en.rows.forEach(r => slugs.add(`course:${r.course_id}:notification`));
  }

  if (role === 'guardian') {
    const en = await query(
      `SELECT e.course_id FROM guardian_students gs
       JOIN guardians g ON g.id=gs.guardian_id
       JOIN enrollments e ON e.student_id=gs.student_id
       WHERE g.user_id=$1`,
      [req.session.user.id]
    );
    en.rows.forEach(r => {
      slugs.add(`course:${r.course_id}:notification`);
      slugs.add(`course:${r.course_id}:attendance`);
      slugs.add(`course:${r.course_id}:grade`);
    });
  }

  const endpoint = result.rows[0].sns_endpoint_arn;
  for (const slug of slugs) {
    const topicArn = await ensureTopic(slug, slug);
    const subArn = await subscribeDeviceToTopic(endpoint, topicArn);
    const topicRow = await query('SELECT id FROM topics WHERE slug=$1', [slug]);
    await query(
      'INSERT INTO subscriptions(device_id, topic_id, sns_subscription_arn) VALUES ($1,$2,$3) ON CONFLICT (device_id, topic_id) DO UPDATE SET sns_subscription_arn=EXCLUDED.sns_subscription_arn',
      [deviceId, topicRow.rows[0].id, subArn]
    );
  }

  res.json({ endpointArn: endpoint, deviceId });
});

module.exports = router;


