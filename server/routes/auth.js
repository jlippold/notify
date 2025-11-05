const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../lib/db');

const router = express.Router();

router.get('/login', (req, res) => {
  res.type('html').send(`
    <form method="POST" action="/auth/login">
      <label>Email <input name="email" type="email" required /></label>
      <label>Password <input name="password" type="password" required /></label>
      <button type="submit">Login</button>
    </form>
  `);
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  const userRes = await query('SELECT u.id, u.password_hash, r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=$1', [email]);
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = { id: user.id, role: user.role_name };
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

module.exports = router;


