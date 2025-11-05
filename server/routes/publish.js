const express = require('express');
const { query } = require('../lib/db');
const { ensureTopic, publishToTopic } = require('../lib/snsClient');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'School Admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

async function requireStaffForCourse(userId, courseId) {
  const q = `SELECT 1 FROM course_staff cs
             JOIN staff st ON st.id = cs.staff_id
             WHERE cs.course_id=$1 AND st.user_id=$2`;
  const r = await query(q, [courseId, userId]);
  return !!r.rows[0];
}

router.post('/course', requireAuth, async (req, res) => {
  const { courseId, audience = 'students', type = 'notification', payload } = req.body || {};
  if (!courseId || !payload) return res.status(400).json({ error: 'Missing courseId or payload' });
  const isStaff = await requireStaffForCourse(req.session.user.id, courseId);
  if (!isStaff) return res.status(403).json({ error: 'Forbidden' });

  const topics = [];
  if (audience === 'students' || audience === 'both') topics.push(`course:${courseId}:notification`);
  if (audience === 'guardians' || audience === 'both') {
    if (type === 'attendance') topics.push(`course:${courseId}:attendance`);
    else if (type === 'grade') topics.push(`course:${courseId}:grade`);
    else topics.push(`course:${courseId}:notification`);
  }

  const ensured = await Promise.all(topics.map((slug) => ensureTopic(slug, slug)));
  const results = [];
  for (const arn of ensured) {
    const id = await publishToTopic(arn, payload);
    results.push({ topicArn: arn, messageId: id });
  }
  res.json({ published: results });
});

router.post('/role', requireAuth, requireAdmin, async (req, res) => {
  const { role, payload } = req.body || {};
  if (!role || !payload) return res.status(400).json({ error: 'Missing role or payload' });
  const slug = `school:role:${role}`;
  const arn = await ensureTopic(slug, slug);
  const messageId = await publishToTopic(arn, payload);
  res.json({ topicArn: arn, messageId });
});

module.exports = router;


